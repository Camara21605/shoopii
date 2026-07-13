/* ================================================================
 * FICHIER : src/modules/geo/geo.service.ts
 *
 * Service CRUD pour les 6 niveaux du référentiel géographique :
 *   Pays → Région → Préfecture → Commune → Quartier → Zone
 *
 * Chaque méthode findAll enrichit les entités avec le nombre
 * d'enfants directs (colonne virtuelle `enfants`).
 * ================================================================ */

import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

import { GeoPays }       from '../../database/entities/geo/geo-pays.entity';
import { GeoRegion }     from '../../database/entities/geo/geo-region.entity';
import { GeoPrefecture } from '../../database/entities/geo/geo-prefecture.entity';
import { GeoCommune }    from '../../database/entities/geo/geo-commune.entity';
import { GeoQuartier }   from '../../database/entities/geo/geo-quartier.entity';
import { GeoZone }       from '../../database/entities/geo/geo-zone.entity';
import { GeoBaseEntity } from '../../database/entities/geo/geo-base.entity';
import { Admin }         from '../../database/entities/profiles/admin-profile.entity';

import type { CreateGeoItemDto, GeoItemResponse, GeoAllResponse, GeoListParams } from './geo.dto';

/* ── Sérialisation d'une entité vers le DTO frontend ─── */
function serialize(entity: GeoBaseEntity & Record<string, unknown>, enfants: number): GeoItemResponse {
  const { createdAt, updatedAt, ...rest } = entity as any;
  return {
    ...rest,
    enfants,
    createdAt: createdAt instanceof Date ? createdAt.toISOString().slice(0, 10) : String(createdAt ?? ''),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString().slice(0, 10) : String(updatedAt ?? ''),
  };
}

/* ── Comptage des enfants pour une liste d'items ────────── */
async function countChildren<C extends { parentId: string | null; id: string }>(
  childRepo: Repository<C>,
  parentIds: string[],
): Promise<Map<string, number>> {
  if (!parentIds.length) return new Map();
  const rows = await childRepo
    .createQueryBuilder('c')
    .select('c.parentId', 'pid')
    .addSelect('COUNT(c.id)', 'cnt')
    .where('c.parentId IN (:...ids)', { ids: parentIds })
    .groupBy('c.parentId')
    .getRawMany<{ pid: string; cnt: string }>();
  return new Map(rows.map(r => [r.pid, Number(r.cnt)]));
}

/* ── Filtre commun (nom / code / statut) ─────────────────── */
function buildWhere(params?: GeoListParams) {
  const where: Record<string, unknown>[] = [];
  const { search, statut } = params ?? {};

  if (search) {
    where.push(
      { nom:  ILike(`%${search}%`), ...(statut ? { statut } : {}) },
      { code: ILike(`%${search}%`), ...(statut ? { statut } : {}) },
    );
  } else if (statut) {
    where.push({ statut });
  }
  return where.length ? where : undefined;
}

/* ================================================================
 * SERVICE
 * ================================================================ */
/* ── Auteurs réservés au super-admin (items non modifiables par un admin) ── */
const SUPER_ADMIN_AUTHORS = new Set(['Super Admin', 'Système', 'System']);

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(GeoPays)       private paysRepo:   Repository<GeoPays>,
    @InjectRepository(GeoRegion)     private regRepo:    Repository<GeoRegion>,
    @InjectRepository(GeoPrefecture) private prefRepo:   Repository<GeoPrefecture>,
    @InjectRepository(GeoCommune)    private commRepo:   Repository<GeoCommune>,
    @InjectRepository(GeoQuartier)   private quartRepo:  Repository<GeoQuartier>,
    @InjectRepository(GeoZone)       private zoneRepo:   Repository<GeoZone>,
    @InjectRepository(Admin)         private adminRepo:  Repository<Admin>,
  ) {}

  /* ── Vérifie qu'un admin ne touche pas un item du super-admin ── */
  private async assertEditable(auteur: string, callerRole: UserRole, userId?: string): Promise<void> {
    if (callerRole === UserRole.ADMIN && SUPER_ADMIN_AUTHORS.has(auteur)) {
      if (userId) {
        const admin = await this.adminRepo.findOne({ where: { userId } });
        const perms = admin?.permissions as Record<string, boolean> | null;
        if (perms?.geo_modifier_protege) return;
      }
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier les éléments créés par le super-administrateur.',
      );
    }
  }

  /* ── Résout le pays racine d'un item selon son niveau ── */
  private async resolveRootPaysId(
    itemParentId: string | null,
    level: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier' | 'zone',
    itemId?: string,
  ): Promise<string | null> {
    switch (level) {
      case 'pays':       return itemId ?? null;
      case 'region':     return itemParentId;
      case 'prefecture': {
        if (!itemParentId) return null;
        const reg = await this.regRepo.findOne({ where: { id: itemParentId }, select: ['parentId'] as any });
        return reg?.parentId ?? null;
      }
      case 'commune': {
        if (!itemParentId) return null;
        const pref = await this.prefRepo.findOne({ where: { id: itemParentId }, select: ['parentId'] as any });
        if (!pref?.parentId) return null;
        const reg  = await this.regRepo.findOne({ where: { id: pref.parentId }, select: ['parentId'] as any });
        return reg?.parentId ?? null;
      }
      case 'quartier': {
        if (!itemParentId) return null;
        const comm = await this.commRepo.findOne({ where: { id: itemParentId }, select: ['parentId'] as any });
        if (!comm?.parentId) return null;
        const pref = await this.prefRepo.findOne({ where: { id: comm.parentId }, select: ['parentId'] as any });
        if (!pref?.parentId) return null;
        const reg  = await this.regRepo.findOne({ where: { id: pref.parentId }, select: ['parentId'] as any });
        return reg?.parentId ?? null;
      }
      case 'zone': {
        /* parentId des zones = premier couvertureId (commune ou quartier) */
        if (!itemParentId) return null;
        /* On suppose couvertureType = commune (cas le plus courant) —
           traversée comm → pref → reg → pays */
        const comm = await this.commRepo.findOne({ where: { id: itemParentId }, select: ['parentId'] as any });
        if (!comm?.parentId) return null;
        const pref = await this.prefRepo.findOne({ where: { id: comm.parentId }, select: ['parentId'] as any });
        if (!pref?.parentId) return null;
        const reg  = await this.regRepo.findOne({ where: { id: pref.parentId }, select: ['parentId'] as any });
        return reg?.parentId ?? null;
      }
    }
  }

  /* ── Vérifie que l'admin opère dans son pays assigné ── */
  private async assertCountryScope(
    itemParentId: string | null,
    level: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier' | 'zone',
    callerRole: UserRole,
    userId?: string,
    itemId?: string,
  ): Promise<void> {
    if (callerRole !== UserRole.ADMIN || !userId) return;
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin?.paysAssigne) {
      throw new ForbiddenException('Aucun pays assigné à votre compte. Contactez le super-administrateur.');
    }
    const rootPaysId = await this.resolveRootPaysId(itemParentId, level, itemId);
    if (rootPaysId !== admin.paysAssigne) {
      throw new ForbiddenException("Cet élément n'appartient pas à votre pays assigné.");
    }
  }

  /* ── Bascule protection : 'Super Admin' ↔ 'Délégué' ── */
  private async toggleDelegationGeneric<T extends GeoBaseEntity>(
    id: string,
    repo: Repository<T>,
    label: string,
  ): Promise<GeoItemResponse> {
    const item = await repo.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`${label} introuvable.`);
    item.auteur = SUPER_ADMIN_AUTHORS.has(item.auteur) ? 'Délégué' : 'Super Admin';
    const saved = await repo.save(item);
    return serialize(saved as any, 0);
  }

  async toggleDelegationPays(id: string)        { return this.toggleDelegationGeneric(id, this.paysRepo,  'Pays'); }
  async toggleDelegationRegion(id: string)      { return this.toggleDelegationGeneric(id, this.regRepo,   'Région'); }
  async toggleDelegationPrefecture(id: string)  { return this.toggleDelegationGeneric(id, this.prefRepo,  'Préfecture'); }
  async toggleDelegationCommune(id: string)     { return this.toggleDelegationGeneric(id, this.commRepo,  'Commune'); }
  async toggleDelegationQuartier(id: string)    { return this.toggleDelegationGeneric(id, this.quartRepo, 'Quartier'); }
  async toggleDelegationZone(id: string)        { return this.toggleDelegationGeneric(id, this.zoneRepo,  'Zone'); }

  /* ── PAYS ──────────────────────────────────────────────── */

  async findAllPays(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.paysRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.regRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createPays(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.paysRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Un pays avec le code "${dto.code}" existe déjà.`);
    const entity = this.paysRepo.create({
      code: dto.code.toUpperCase(),
      nom: dto.nom,
      description: dto.description ?? '',
      statut: dto.statut ?? 'actif',
      parentId: null,
      auteur: dto.auteur ?? 'Super Admin',
      iso3: dto.iso3 ?? '',
      indicatif: dto.indicatif ?? '',
      devise: dto.devise ?? '',
    });
    const saved = await this.paysRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updatePays(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.paysRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Pays ${id} introuvable.`);
    await this.assertCountryScope(null, 'pays', callerRole, userId, item.id);
    await this.assertEditable(item.auteur, callerRole, userId);
    Object.assign(item, {
      ...(dto.nom         && { nom: dto.nom }),
      ...(dto.code        && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.statut      && { statut: dto.statut }),
      ...(dto.auteur      && { auteur: dto.auteur }),
      ...(dto.iso3        !== undefined && { iso3: dto.iso3 }),
      ...(dto.indicatif   !== undefined && { indicatif: dto.indicatif }),
      ...(dto.devise      !== undefined && { devise: dto.devise }),
    });
    const saved = await this.paysRepo.save(item);
    const childMap = await countChildren(this.regRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removePays(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.paysRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Pays ${id} introuvable.`);
    await this.assertCountryScope(null, 'pays', callerRole, userId, item.id);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.paysRepo.remove(item);
  }

  async togglePays(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.paysRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Pays ${id} introuvable.`);
    await this.assertCountryScope(null, 'pays', callerRole, userId, item.id);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.paysRepo.save(item);
    const childMap = await countChildren(this.regRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── RÉGIONS ───────────────────────────────────────────── */

  async findAllRegions(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.regRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.prefRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createRegion(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.regRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Une région avec le code "${dto.code}" existe déjà.`);
    const entity = this.regRepo.create({
      code:        dto.code.toUpperCase(),
      nom:         dto.nom,
      description: dto.description ?? '',
      statut:      dto.statut ?? 'actif',
      parentId:    dto.parentId ?? null,
      auteur:      dto.auteur ?? 'Super Admin',
      chef_lieu:   dto.chef_lieu ?? '',
    });
    const saved = await this.regRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updateRegion(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.regRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Région ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'region', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    Object.assign(item, {
      ...(dto.nom         && { nom: dto.nom }),
      ...(dto.code        && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.statut      && { statut: dto.statut }),
      ...(dto.parentId    !== undefined && { parentId: dto.parentId || null }),
      ...(dto.auteur      && { auteur: dto.auteur }),
      ...(dto.chef_lieu   !== undefined && { chef_lieu: dto.chef_lieu }),
    });
    const saved = await this.regRepo.save(item);
    const childMap = await countChildren(this.prefRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removeRegion(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.regRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Région ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'region', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.regRepo.remove(item);
  }

  async toggleRegion(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.regRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Région ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'region', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.regRepo.save(item);
    const childMap = await countChildren(this.prefRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── PRÉFECTURES ────────────────────────────────────────── */

  async findAllPrefectures(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.prefRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.commRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createPrefecture(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.prefRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Une préfecture avec le code "${dto.code}" existe déjà.`);
    const entity = this.prefRepo.create({
      code:        dto.code.toUpperCase(),
      nom:         dto.nom,
      description: dto.description ?? '',
      statut:      dto.statut ?? 'actif',
      parentId:    dto.parentId ?? null,
      auteur:      dto.auteur ?? 'Super Admin',
      chef_lieu:   dto.chef_lieu ?? '',
    });
    const saved = await this.prefRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updatePrefecture(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.prefRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Préfecture ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'prefecture', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    Object.assign(item, {
      ...(dto.nom         && { nom: dto.nom }),
      ...(dto.code        && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.statut      && { statut: dto.statut }),
      ...(dto.parentId    !== undefined && { parentId: dto.parentId || null }),
      ...(dto.auteur      && { auteur: dto.auteur }),
      ...(dto.chef_lieu   !== undefined && { chef_lieu: dto.chef_lieu }),
    });
    const saved = await this.prefRepo.save(item);
    const childMap = await countChildren(this.commRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removePrefecture(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.prefRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Préfecture ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'prefecture', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.prefRepo.remove(item);
  }

  async togglePrefecture(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.prefRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Préfecture ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'prefecture', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.prefRepo.save(item);
    const childMap = await countChildren(this.commRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── COMMUNES ───────────────────────────────────────────── */

  async findAllCommunes(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.commRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.quartRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createCommune(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.commRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Une commune avec le code "${dto.code}" existe déjà.`);
    const entity = this.commRepo.create({
      code:        dto.code.toUpperCase(),
      nom:         dto.nom,
      description: dto.description ?? '',
      statut:      dto.statut ?? 'actif',
      parentId:    dto.parentId ?? null,
      auteur:      dto.auteur ?? 'Super Admin',
      type:        dto.type ?? 'urbaine',
    });
    const saved = await this.commRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updateCommune(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.commRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Commune ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'commune', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    Object.assign(item, {
      ...(dto.nom         && { nom: dto.nom }),
      ...(dto.code        && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.statut      && { statut: dto.statut }),
      ...(dto.parentId    !== undefined && { parentId: dto.parentId || null }),
      ...(dto.auteur      && { auteur: dto.auteur }),
      ...(dto.type        && { type: dto.type }),
    });
    const saved = await this.commRepo.save(item);
    const childMap = await countChildren(this.quartRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removeCommune(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.commRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Commune ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'commune', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.commRepo.remove(item);
  }

  async toggleCommune(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.commRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Commune ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'commune', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.commRepo.save(item);
    const childMap = await countChildren(this.quartRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── QUARTIERS ──────────────────────────────────────────── */

  async findAllQuartiers(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.quartRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    /* Les quartiers n'ont pas d'enfants directs — les zones référencent
     * leurs couvertureIds par UUID, pas via parentId. */
    return items.map(i => serialize(i as any, 0));
  }

  async createQuartier(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.quartRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Un quartier avec le code "${dto.code}" existe déjà.`);
    const entity = this.quartRepo.create({
      code:        dto.code.toUpperCase(),
      nom:         dto.nom,
      description: dto.description ?? '',
      statut:      dto.statut ?? 'actif',
      parentId:    dto.parentId ?? null,
      auteur:      dto.auteur ?? 'Super Admin',
      population:  dto.population ?? 0,
    });
    const saved = await this.quartRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updateQuartier(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.quartRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Quartier ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'quartier', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    Object.assign(item, {
      ...(dto.nom         && { nom: dto.nom }),
      ...(dto.code        && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.statut      && { statut: dto.statut }),
      ...(dto.parentId    !== undefined && { parentId: dto.parentId || null }),
      ...(dto.auteur      && { auteur: dto.auteur }),
      ...(dto.population  !== undefined && { population: dto.population }),
    });
    const saved = await this.quartRepo.save(item);
    return serialize(saved as any, 0);
  }

  async removeQuartier(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.quartRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Quartier ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'quartier', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.quartRepo.remove(item);
  }

  async toggleQuartier(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.quartRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Quartier ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'quartier', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.quartRepo.save(item);
    return serialize(saved as any, 0);
  }

  /* ── ZONES DE LIVRAISON ────────────────────────────────── */

  async findAllZones(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.zoneRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    return items.map(i => serialize(i as any, 0));
  }

  async createZone(dto: CreateGeoItemDto): Promise<GeoItemResponse> {
    const existing = await this.zoneRepo.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException(`Une zone avec le code "${dto.code}" existe déjà.`);
    const couvertureIds = dto.couvertureIds ?? [];
    const entity = this.zoneRepo.create({
      code:           dto.code.toUpperCase(),
      nom:            dto.nom,
      description:    dto.description ?? '',
      statut:         dto.statut ?? 'actif',
      parentId:       couvertureIds[0] ?? null,
      auteur:         dto.auteur ?? 'Super Admin',
      couvertureType: dto.couvertureType ?? 'commune',
      couvertureIds,
      rayonKm:        dto.rayonKm ?? 0,
      fraisLivraison: dto.fraisLivraison ?? 0,
      tempsEstime:    dto.tempsEstime ?? 0,
      acteursCover:   0,
    });
    const saved = await this.zoneRepo.save(entity);
    return serialize(saved as any, 0);
  }

  async updateZone(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.zoneRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Zone ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'zone', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    const couvertureIds = dto.couvertureIds ?? item.couvertureIds;
    Object.assign(item, {
      ...(dto.nom             && { nom: dto.nom }),
      ...(dto.code            && { code: dto.code.toUpperCase() }),
      ...(dto.description     !== undefined && { description: dto.description }),
      ...(dto.statut          && { statut: dto.statut }),
      ...(dto.auteur          && { auteur: dto.auteur }),
      ...(dto.couvertureType  && { couvertureType: dto.couvertureType }),
      couvertureIds,
      parentId: couvertureIds[0] ?? item.parentId,
      ...(dto.rayonKm         !== undefined && { rayonKm: dto.rayonKm }),
      ...(dto.fraisLivraison  !== undefined && { fraisLivraison: dto.fraisLivraison }),
      ...(dto.tempsEstime     !== undefined && { tempsEstime: dto.tempsEstime }),
    });
    const saved = await this.zoneRepo.save(item);
    return serialize(saved as any, 0);
  }

  async removeZone(id: string, callerRole: UserRole, userId: string): Promise<void> {
    const item = await this.zoneRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Zone ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'zone', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.zoneRepo.remove(item);
  }

  async toggleZone(id: string, callerRole: UserRole, userId: string): Promise<GeoItemResponse> {
    const item = await this.zoneRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Zone ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'zone', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.zoneRepo.save(item);
    return serialize(saved as any, 0);
  }

  /* ── ALL — charge tout en parallèle pour les sélecteurs en cascade ── */

  async getAll(): Promise<GeoAllResponse> {
    const [pays, regions, prefectures, communes, quartiers, zones] = await Promise.all([
      this.findAllPays(),
      this.findAllRegions(),
      this.findAllPrefectures(),
      this.findAllCommunes(),
      this.findAllQuartiers(),
      this.findAllZones(),
    ]);
    return { pays, regions, prefectures, communes, quartiers, zones };
  }

  /* ── Items publics par niveau géographique ──────────────────────────────── */

  async itemsByNiveau(
    niveau: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier',
  ): Promise<{ id: string; nom: string; code: string }[]> {
    const repoMap: Record<string, Repository<any>> = {
      pays:       this.paysRepo,
      region:     this.regRepo,
      prefecture: this.prefRepo,
      commune:    this.commRepo,
      quartier:   this.quartRepo,
    };
    const repo = repoMap[niveau];
    if (!repo) return [];
    const items: any[] = await repo.find({
      where: { statut: 'actif' },
      select: { id: true, nom: true, code: true, latitude: true, longitude: true } as any,
      order: { nom: 'ASC' },
    });
    return items.map(i => ({
      id: i.id, nom: i.nom, code: i.code,
      latitude:  i.latitude  != null ? Number(i.latitude)  : null,
      longitude: i.longitude != null ? Number(i.longitude) : null,
    }));
  }

  /* ── Villes publiques par indicatif téléphonique ───────────────────────── */

  async villesByIndicatif(indicatif: string): Promise<{ id: string; nom: string; code: string }[]> {
    const pays = await this.paysRepo.findOne({
      where: { indicatif: indicatif.trim(), statut: 'actif' },
      select: ['id'],
    });
    if (!pays) return [];

    const regions = await this.regRepo.find({
      where: { parentId: pays.id, statut: 'actif' },
      select: ['id'],
    });
    if (!regions.length) return [];

    const prefectures = await this.prefRepo.find({
      where: { parentId: In(regions.map(r => r.id)), statut: 'actif' },
      select: ['id', 'nom', 'code'],
      order: { nom: 'ASC' },
    });

    return prefectures.map(p => ({ id: p.id, nom: p.nom, code: p.code }));
  }
}
