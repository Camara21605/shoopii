/* ================================================================
 * FICHIER : src/modules/geo/geo.service.ts
 *
 * Service CRUD pour les 6 niveaux du référentiel géographique :
 *   Pays → Région → Préfecture → Commune → Quartier → Zone
 *
 * Chaque méthode findAll enrichit les entités avec le nombre
 * d'enfants directs (colonne virtuelle `enfants`).
 *
 * Chaque opération de création/modification/suppression/bascule écrit
 * une ligne dans GeoAuditLog (voir logAudit()) — c'est ce journal que
 * consomme GeoAudit.tsx (Journal d'audit) et l'onglet "Historique des
 * imports" de GeoImport.tsx (filtré sur action='import').
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
import { GeoAuditLog, GeoAuditAction, GeoAuditNiveau } from '../../database/entities/geo/geo-audit-log.entity';
import { Admin }         from '../../database/entities/profiles/admin-profile.entity';

import type {
  CreateGeoItemDto, GeoItemResponse, GeoAllResponse, GeoListParams,
  GeoAuditListParams, GeoAuditEntryResponse, GeoImportRowDto, GeoImportResultResponse,
} from './geo.dto';

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

/* ── Colonne(s) "code parent" acceptée(s) dans un CSV d'import, par niveau ── */
const IMPORT_PARENT_COLUMNS: Record<Exclude<GeoAuditNiveau, 'pays'>, string> = {
  region:     'paysCode',
  prefecture: 'regionCode',
  commune:    'prefectureCode',
  quartier:   'communeCode',
  zone:       'communeCode',
};

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(GeoPays)       private paysRepo:   Repository<GeoPays>,
    @InjectRepository(GeoRegion)     private regRepo:    Repository<GeoRegion>,
    @InjectRepository(GeoPrefecture) private prefRepo:   Repository<GeoPrefecture>,
    @InjectRepository(GeoCommune)    private commRepo:   Repository<GeoCommune>,
    @InjectRepository(GeoQuartier)   private quartRepo:  Repository<GeoQuartier>,
    @InjectRepository(GeoZone)       private zoneRepo:   Repository<GeoZone>,
    @InjectRepository(GeoAuditLog)   private auditRepo:  Repository<GeoAuditLog>,
    @InjectRepository(Admin)         private adminRepo:  Repository<Admin>,
  ) {}

  /* ── Journal d'audit — écriture ────────────────────────────
   * Fire-and-forget côté appelant (void this.logAudit(...)) : un
   * incident sur le journal ne doit jamais faire échouer l'opération
   * géo elle-même (même principe que EscrowAuditService). */
  private async logAudit(entry: {
    action:       GeoAuditAction;
    niveau:       GeoAuditNiveau;
    itemId:       string | null;
    itemNom:      string;
    itemCode:     string;
    auteur:       string;
    auteurUserId: string | null;
    details:      string;
  }): Promise<void> {
    try {
      await this.auditRepo.save(this.auditRepo.create(entry));
    } catch {
      /* jamais bloquant */
    }
  }

  /* ── Journal d'audit — lecture ─────────────────────────────
   * GET /geo/audit — utilisé par GeoAudit.tsx (Journal) et par
   * GeoImport.tsx (Historique des imports, filtré action=import). */
  async findAllAudit(params?: GeoAuditListParams): Promise<GeoAuditEntryResponse[]> {
    const qb = this.auditRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(200);
    if (params?.action) qb.andWhere('a.action = :action', { action: params.action });
    if (params?.niveau) qb.andWhere('a.niveau = :niveau', { niveau: params.niveau });
    if (params?.search) {
      qb.andWhere('(a.itemNom ILIKE :s OR a.auteur ILIKE :s OR a.itemCode ILIKE :s)', { s: `%${params.search}%` });
    }
    const rows = await qb.getMany();
    return rows.map(r => ({
      id:       r.id,
      action:   r.action,
      niveau:   r.niveau,
      itemNom:  r.itemNom,
      itemCode: r.itemCode,
      auteur:   r.auteur,
      quand:    r.createdAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      details:  r.details,
    }));
  }

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
    niveau: GeoAuditNiveau,
    actorEmail: string,
    actorUserId: string | null,
  ): Promise<GeoItemResponse> {
    const item = await repo.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`${label} introuvable.`);
    item.auteur = SUPER_ADMIN_AUTHORS.has(item.auteur) ? 'Délégué' : 'Super Admin';
    const saved = await repo.save(item);
    void this.logAudit({
      action: 'update', niveau, itemId: saved.id, itemNom: (saved as any).nom, itemCode: (saved as any).code,
      auteur: actorEmail, auteurUserId: actorUserId,
      details: `Délégation ${label.toLowerCase()} basculée → ${item.auteur}`,
    });
    return serialize(saved as any, 0);
  }

  async toggleDelegationPays(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.paysRepo, 'Pays', 'pays', actorEmail, actorUserId);
  }
  async toggleDelegationRegion(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.regRepo, 'Région', 'region', actorEmail, actorUserId);
  }
  async toggleDelegationPrefecture(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.prefRepo, 'Préfecture', 'prefecture', actorEmail, actorUserId);
  }
  async toggleDelegationCommune(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.commRepo, 'Commune', 'commune', actorEmail, actorUserId);
  }
  async toggleDelegationQuartier(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.quartRepo, 'Quartier', 'quartier', actorEmail, actorUserId);
  }
  async toggleDelegationZone(id: string, actorEmail = 'Super Admin', actorUserId: string | null = null) {
    return this.toggleDelegationGeneric(id, this.zoneRepo, 'Zone', 'zone', actorEmail, actorUserId);
  }

  /* ── PAYS ──────────────────────────────────────────────── */

  async findAllPays(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.paysRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.regRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createPays(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'pays', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouveau pays créé : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updatePays(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'pays', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Pays modifié : ${saved.nom} (${saved.code})`,
    });
    const childMap = await countChildren(this.regRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removePays(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.paysRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Pays ${id} introuvable.`);
    await this.assertCountryScope(null, 'pays', callerRole, userId, item.id);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.paysRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'pays', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Pays supprimé : ${item.nom} (${item.code})`,
    });
  }

  async togglePays(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.paysRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Pays ${id} introuvable.`);
    await this.assertCountryScope(null, 'pays', callerRole, userId, item.id);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.paysRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'pays',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Pays ${saved.statut === 'actif' ? 'activé' : 'désactivé'}`,
    });
    const childMap = await countChildren(this.regRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── RÉGIONS ───────────────────────────────────────────── */

  async findAllRegions(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.regRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.prefRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createRegion(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'region', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouvelle région créée : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updateRegion(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'region', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Région modifiée : ${saved.nom} (${saved.code})`,
    });
    const childMap = await countChildren(this.prefRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removeRegion(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.regRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Région ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'region', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.regRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'region', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Région supprimée : ${item.nom} (${item.code})`,
    });
  }

  async toggleRegion(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.regRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Région ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'region', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.regRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'region',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Région ${saved.statut === 'actif' ? 'activée' : 'désactivée'}`,
    });
    const childMap = await countChildren(this.prefRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── PRÉFECTURES ────────────────────────────────────────── */

  async findAllPrefectures(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.prefRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.commRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createPrefecture(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'prefecture', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouvelle préfecture créée : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updatePrefecture(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'prefecture', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Préfecture modifiée : ${saved.nom} (${saved.code})`,
    });
    const childMap = await countChildren(this.commRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removePrefecture(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.prefRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Préfecture ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'prefecture', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.prefRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'prefecture', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Préfecture supprimée : ${item.nom} (${item.code})`,
    });
  }

  async togglePrefecture(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.prefRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Préfecture ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'prefecture', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.prefRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'prefecture',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Préfecture ${saved.statut === 'actif' ? 'activée' : 'désactivée'}`,
    });
    const childMap = await countChildren(this.commRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  /* ── COMMUNES ───────────────────────────────────────────── */

  async findAllCommunes(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.commRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    const childMap = await countChildren(this.quartRepo, items.map(i => i.id));
    return items.map(i => serialize(i as any, childMap.get(i.id) ?? 0));
  }

  async createCommune(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'commune', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouvelle commune créée : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updateCommune(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'commune', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Commune modifiée : ${saved.nom} (${saved.code})`,
    });
    const childMap = await countChildren(this.quartRepo, [id]);
    return serialize(saved as any, childMap.get(id) ?? 0);
  }

  async removeCommune(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.commRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Commune ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'commune', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.commRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'commune', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Commune supprimée : ${item.nom} (${item.code})`,
    });
  }

  async toggleCommune(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.commRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Commune ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'commune', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.commRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'commune',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Commune ${saved.statut === 'actif' ? 'activée' : 'désactivée'}`,
    });
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

  async createQuartier(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'quartier', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouveau quartier créé : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updateQuartier(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'quartier', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Quartier modifié : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async removeQuartier(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.quartRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Quartier ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'quartier', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.quartRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'quartier', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Quartier supprimé : ${item.nom} (${item.code})`,
    });
  }

  async toggleQuartier(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.quartRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Quartier ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'quartier', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.quartRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'quartier',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Quartier ${saved.statut === 'actif' ? 'activé' : 'désactivé'}`,
    });
    return serialize(saved as any, 0);
  }

  /* ── ZONES DE LIVRAISON ────────────────────────────────── */

  async findAllZones(params?: GeoListParams): Promise<GeoItemResponse[]> {
    const items = await this.zoneRepo.find({ where: buildWhere(params), order: { nom: 'ASC' } });
    return items.map(i => serialize(i as any, 0));
  }

  async createZone(dto: CreateGeoItemDto, actorEmail = 'Super Admin', actorUserId: string | null = null): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'create', niveau: 'zone', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: actorUserId, details: `Nouvelle zone de livraison créée : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async updateZone(id: string, dto: CreateGeoItemDto, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
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
    void this.logAudit({
      action: 'update', niveau: 'zone', itemId: saved.id, itemNom: saved.nom, itemCode: saved.code,
      auteur: actorEmail, auteurUserId: userId, details: `Zone de livraison modifiée : ${saved.nom} (${saved.code})`,
    });
    return serialize(saved as any, 0);
  }

  async removeZone(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<void> {
    const item = await this.zoneRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Zone ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'zone', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    await this.zoneRepo.remove(item);
    void this.logAudit({
      action: 'delete', niveau: 'zone', itemId: id, itemNom: item.nom, itemCode: item.code,
      auteur: actorEmail, auteurUserId: userId, details: `Zone de livraison supprimée : ${item.nom} (${item.code})`,
    });
  }

  async toggleZone(id: string, callerRole: UserRole, userId: string, actorEmail = 'Super Admin'): Promise<GeoItemResponse> {
    const item = await this.zoneRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Zone ${id} introuvable.`);
    await this.assertCountryScope(item.parentId, 'zone', callerRole, userId);
    await this.assertEditable(item.auteur, callerRole, userId);
    item.statut = item.statut === 'actif' ? 'inactif' : 'actif';
    const saved = await this.zoneRepo.save(item);
    void this.logAudit({
      action: saved.statut === 'actif' ? 'activate' : 'deactivate', niveau: 'zone',
      itemId: saved.id, itemNom: saved.nom, itemCode: saved.code, auteur: actorEmail, auteurUserId: userId,
      details: `Zone ${saved.statut === 'actif' ? 'activée' : 'désactivée'}`,
    });
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
    parentId?: string,
  ): Promise<{ id: string; nom: string; code: string; parentId: string | null }[]> {
    const repoMap: Record<string, Repository<any>> = {
      pays:       this.paysRepo,
      region:     this.regRepo,
      prefecture: this.prefRepo,
      commune:    this.commRepo,
      quartier:   this.quartRepo,
    };
    const repo = repoMap[niveau];
    if (!repo) return [];
    const where: Record<string, unknown> = { statut: 'actif' };
    /* Filtre en cascade (ex: communes d'une préfecture donnée) — voir
     * SecZone.tsx (partenaire) qui enchaîne ville → commune → quartier. */
    if (parentId) where.parentId = parentId;
    const items: any[] = await repo.find({
      where,
      select: { id: true, nom: true, code: true, parentId: true, latitude: true, longitude: true } as any,
      order: { nom: 'ASC' },
    });
    return items.map(i => ({
      id: i.id, nom: i.nom, code: i.code, parentId: i.parentId ?? null,
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

  /* ══════════════════════════════════════════════════════════
   * IMPORT MASSIF — POST /geo/:niveau/import
   *
   * Remplace la simulation aléatoire côté frontend (setTimeout +
   * Math.random()) : chaque ligne est réellement créée via la
   * même méthode createXxx() que le formulaire standard (mêmes
   * validations, même unicité de code), le code parent est résolu
   * par recherche du niveau parent (voir IMPORT_PARENT_COLUMNS).
   * ══════════════════════════════════════════════════════════ */

  async importRows(
    niveau: GeoAuditNiveau,
    rows: GeoImportRowDto[],
    actorEmail: string,
    actorUserId: string | null,
  ): Promise<GeoImportResultResponse> {
    const errors: { ligne: number; message: string }[] = [];
    let created = 0;

    /* Repo du niveau PARENT pour résoudre parentCode → parentId */
    const parentRepoMap: Record<string, Repository<GeoBaseEntity> | null> = {
      pays:       null,
      region:     this.paysRepo   as unknown as Repository<GeoBaseEntity>,
      prefecture: this.regRepo    as unknown as Repository<GeoBaseEntity>,
      commune:    this.prefRepo   as unknown as Repository<GeoBaseEntity>,
      quartier:   this.commRepo   as unknown as Repository<GeoBaseEntity>,
      zone:       this.commRepo   as unknown as Repository<GeoBaseEntity>,
    };
    const parentRepo = parentRepoMap[niveau];
    const parentCol  = niveau === 'pays' ? null : IMPORT_PARENT_COLUMNS[niveau as Exclude<GeoAuditNiveau, 'pays'>];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ligne = i + 2; // +1 (1-indexé) +1 (ligne d'en-tête)
      try {
        if (!row.code?.trim() || !row.nom?.trim()) {
          throw new Error('Colonnes "code" et "nom" obligatoires.');
        }

        let parentId: string | undefined;
        if (parentRepo && parentCol) {
          const parentCode = (row as unknown as Record<string, string | undefined>)[parentCol];
          if (!parentCode?.trim()) throw new Error(`Colonne "${parentCol}" obligatoire.`);
          const parent = await parentRepo.findOne({ where: { code: parentCode.trim().toUpperCase() } as any });
          if (!parent) throw new Error(`Parent introuvable pour le code "${parentCode}".`);
          parentId = parent.id;
        }

        const dto: CreateGeoItemDto = {
          code:        row.code.trim(),
          nom:         row.nom.trim(),
          description: row.description ?? '',
          parentId,
          iso2:       row.iso2,
          iso3:       row.iso3,
          indicatif:  row.indicatif,
          devise:     row.devise,
          chef_lieu:  row.chef_lieu,
          type:       row.type as any,
          population: row.population != null ? Number(row.population) : undefined,
          rayonKm:        row.rayonKm != null ? Number(row.rayonKm) : undefined,
          fraisLivraison: row.fraisLivraison != null ? Number(row.fraisLivraison) : undefined,
          tempsEstime:    row.tempsEstime != null ? Number(row.tempsEstime) : undefined,
          couvertureType: niveau === 'zone' ? 'commune' : undefined,
          couvertureIds:  niveau === 'zone' && parentId ? [parentId] : undefined,
        };

        switch (niveau) {
          case 'pays':       await this.createPays(dto, actorEmail, actorUserId);       break;
          case 'region':     await this.createRegion(dto, actorEmail, actorUserId);     break;
          case 'prefecture': await this.createPrefecture(dto, actorEmail, actorUserId); break;
          case 'commune':    await this.createCommune(dto, actorEmail, actorUserId);    break;
          case 'quartier':   await this.createQuartier(dto, actorEmail, actorUserId);   break;
          case 'zone':       await this.createZone(dto, actorEmail, actorUserId);       break;
        }
        created++;
      } catch (err) {
        errors.push({ ligne, message: err instanceof Error ? err.message : 'Erreur inconnue' });
      }
    }

    void this.logAudit({
      action: 'import', niveau, itemId: null,
      itemNom: `${rows.length} ${niveau}${rows.length > 1 ? 's' : ''}`, itemCode: '—',
      auteur: actorEmail, auteurUserId: actorUserId,
      details: `Import CSV — ${created} créé${created > 1 ? 's' : ''}, ${errors.length} erreur${errors.length > 1 ? 's' : ''}`,
    });

    return { total: rows.length, created, updated: 0, skipped: errors.length, errors };
  }
}
