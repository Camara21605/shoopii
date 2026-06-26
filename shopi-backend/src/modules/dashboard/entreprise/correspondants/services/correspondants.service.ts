/* ============================================================
 * src/modules/dashboard/entreprise/correspondants/services/correspondants.service.ts
 *
 * CORRECTION :
 *   c.user.phone → TypeError car relation user non chargée.
 *
 *   FIX 1 : toResponse() → c.user?.phone ?? null  (optional chaining)
 *   FIX 2 : findAll() et getRecentActivity() → leftJoinAndSelect user
 *   FIX 3 : findOne() / suspendre() / reactiver() / valider() → relations: ['user']
 *   FIX 4 : update() → c.user?.phone
 *   FIX 5 : email pris directement depuis c.user?.email (plus besoin de loadEmails)
 * ============================================================ */

import {
  ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Correspondent, CorrespondantStatus }
  from 'src/database/entities/profiles/correspondant-profile.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }
  from 'src/database/entities/user.entity';
import { UserRole }
  from 'src/common/enums/user-role.enum';
import {
  FilterCorrespondantsDto, UpdateCorrespondantDto, CorrespondantType,
} from '../dto/correspondant.dto';

export interface CorrespondantResponse {
  id: string; fullName: string; email: string; phone: string | null;
  ville: string; quartier: string; adresse: string | null;
  type: string; status: string; avatarEmoji: string;
  totalMissions: number; thisMonth: number; averageRating: number;
  zone: string | null; joinedAt: string;
  lastActivity: string; lastActivityAt: string;
  companyId: string | null; userId: string;
}

export interface CorrespondantStats {
  total: number; actifs: number; thisMonth: number;
  villes: number; enAttente: number;
}

export interface ZoneStat {
  zone: string; orders: number; pct: number; color: string;
}

const TYPE_EMOJI: Record<string, string> = {
  principal: '🏬', entrepot: '🏭', export: '✈️', relais: '📦',
};

const ZONE_COLORS = [
  'var(--blue)', 'var(--violet)', 'var(--emerald)', 'var(--amber)', 'var(--rose)',
];

@Injectable()
export class CorrespondantsService {

  private readonly logger = new Logger(CorrespondantsService.name);

  constructor(
    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ── Résoudre companyId ── */
  private async resolveCompanyId(user: User): Promise<string | null> {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) return null;
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company.id;
  }

  /* ── Extraire la ville ── */
  private extractVille(c: Correspondent): string {
    if (c.address) {
      const parts = c.address.split(',').map(s => s.trim());
      if (parts.length >= 2) return parts[parts.length - 1];
    }
    if (c.zone) return c.zone.split('·')[0].trim();
    return 'Conakry';
  }

  /* ── Extraire le type ── */
  private extractType(c: Correspondent): string {
  if (c.typeCorrespondant) return c.typeCorrespondant;
  if (c.zone) {
    const z = c.zone.toLowerCase();
    if (z.includes('international'))                       return 'export';
    if (z.includes('entrepôt') || z.includes('entrepot')) return 'entrepot';
    if (z.includes('principal'))                           return 'principal';
  }
  return 'relais';
}

  /* ── Mapper vers la réponse frontend ── */
  private toResponse(c: Correspondent): CorrespondantResponse {
    const type     = this.extractType(c);
    const ville    = this.extractVille(c);
    const quartier = c.zone ? c.zone.split('·')[0].trim() : ville;

    return {
      id:            c.id,
      fullName:      c.fullName,
      /*
       * ✅ FIX — c.user peut être undefined si la relation n'est pas chargée.
       * On utilise optional chaining pour éviter le TypeError.
       * Email récupéré depuis la relation user (chargée via leftJoinAndSelect)
       */
      email:         c.user?.email         ?? '',
      phone:         c.user?.phone         ?? null,
      ville,
      quartier,
      adresse:       c.address,
      type,
      status:        c.status,
      avatarEmoji:   TYPE_EMOJI[type]       ?? '📦',
      totalMissions: c.totalMissions        ?? 0,
      thisMonth:     0,
      averageRating: Number(c.averageRating) || 0,
      zone:          c.zone,
      joinedAt:      c.createdAt?.toISOString() ?? '',
      lastActivity:  'Aucune activité récente',
      lastActivityAt:'',
      companyId:     c.companyId,
      userId:        c.userId,
    };
  }

  /* ═══════════════════════════════════════════════════════════
   * 1. GET ALL
   * ✅ FIX — leftJoinAndSelect('c.user', 'user') ajouté
   ═══════════════════════════════════════════════════════════ */
  async findAll(dto: FilterCorrespondantsDto, user: User): Promise<{
    data: CorrespondantResponse[]; total: number; page: number; pages: number;
  }> {
    const companyId = await this.resolveCompanyId(user);
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.correspondantRepo
      .createQueryBuilder('c')
      /* ✅ Charge la relation user → c.user.phone et c.user.email disponibles */
      .leftJoinAndSelect('c.user', 'user')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (companyId)   qb.where('c.companyId = :companyId', { companyId });
    if (dto.status)  qb.andWhere('c.status = :status', { status: dto.status });

    if (dto.type) {
      qb.andWhere('c.typeCorrespondant = :type', { type: dto.type });
    }

    if (dto.search?.trim()) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(c.fullName LIKE :term OR c.address LIKE :term OR c.zone LIKE :term)',
        { term },
      );
    }

    const [raw, total] = await qb.getManyAndCount();
    return {
      data:  raw.map(c => this.toResponse(c)),
      total, page,
      pages: Math.ceil(total / limit),
    };
  }

  /* ═══════════════════════════════════════════════════════════
   * 2. GET ONE
   * ✅ FIX — relations: ['user'] ajouté
   ═══════════════════════════════════════════════════════════ */
  async findOne(id: string, user: User): Promise<CorrespondantResponse> {
    const companyId = await this.resolveCompanyId(user);
    const c = await this.correspondantRepo.findOne({
      where: { id },
      relations: ['user'], // ✅ charge c.user
    });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);
    if (companyId && c.companyId !== companyId) {
      throw new ForbiddenException('Accès refusé — ce correspondant n\'appartient pas à votre réseau.');
    }
    return this.toResponse(c);
  }

  /* ═══════════════════════════════════════════════════════════
   * 3. STATS
   ═══════════════════════════════════════════════════════════ */
  async getStats(user: User): Promise<CorrespondantStats> {
    const companyId = await this.resolveCompanyId(user);
    const qb = this.correspondantRepo.createQueryBuilder('c');
    if (companyId) qb.where('c.companyId = :companyId', { companyId });
    const all = await qb.getMany();

    return {
      total:     all.length,
      actifs:    all.filter(c => c.status === CorrespondantStatus.ACTIVE).length,
      thisMonth: all.reduce((sum, c) => sum + (c.totalMissions ?? 0), 0),
      villes:    new Set(all.map(c => this.extractVille(c))).size,
      enAttente: all.filter(c => c.status === CorrespondantStatus.PENDING).length,
    };
  }

  /* ═══════════════════════════════════════════════════════════
   * 4. ZONE STATS
   ═══════════════════════════════════════════════════════════ */
  async getZoneStats(user: User): Promise<ZoneStat[]> {
    const companyId = await this.resolveCompanyId(user);
    const qb = this.correspondantRepo.createQueryBuilder('c');
    if (companyId) qb.where('c.companyId = :companyId', { companyId });
    const all = await qb.getMany();

    const zoneMap: Record<string, number> = {};
    for (const c of all) {
      const ville = this.extractVille(c);
      zoneMap[ville] = (zoneMap[ville] ?? 0) + (c.totalMissions ?? 0);
    }

    const total = Object.values(zoneMap).reduce((s, n) => s + n, 0) || 1;

    return Object.entries(zoneMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([zone, orders], i) => ({
        zone, orders,
        pct:   Math.round((orders / total) * 100),
        color: ZONE_COLORS[i % ZONE_COLORS.length],
      }));
  }

  /* ═══════════════════════════════════════════════════════════
   * 5. ACTIVITÉ RÉCENTE
   * ✅ FIX — leftJoinAndSelect('c.user', 'user') ajouté
   ═══════════════════════════════════════════════════════════ */
  async getRecentActivity(user: User): Promise<CorrespondantResponse[]> {
    const companyId = await this.resolveCompanyId(user);

    const qb = this.correspondantRepo
      .createQueryBuilder('c')
      /* ✅ Charge c.user */
      .leftJoinAndSelect('c.user', 'user');

    if (companyId) qb.where('c.companyId = :companyId', { companyId });
    qb.orderBy('c.updatedAt', 'DESC').take(5);

    const recent = await qb.getMany();
    return recent.map(c => this.toResponse(c));
  }

  /* ═══════════════════════════════════════════════════════════
   * 6. UPDATE
   * ✅ FIX — relations: ['user'] + c.user?.phone
   ═══════════════════════════════════════════════════════════ */
  async update(id: string, dto: UpdateCorrespondantDto, user: User): Promise<CorrespondantResponse> {
    const companyId = await this.resolveCompanyId(user);
    const c = await this.correspondantRepo.findOne({
      where: { id },
      relations: ['user'], // ✅
    });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);
    if (companyId && c.companyId !== companyId) throw new ForbiddenException('Accès refusé.');

    Object.assign(c, {
      fullName: dto.fullName ?? c.fullName,
      zone:     dto.zone     ?? c.zone,
      address:  dto.address  ?? c.address,
    });

    await this.correspondantRepo.save(c);
    this.logger.log(`[UPDATE CORRESPONDANT ✅] ID=${id}`);
    return this.findOne(id, user);
  }

  /* ═══════════════════════════════════════════════════════════
   * 7. SUSPENDRE
   * ✅ FIX — relations: ['user']
   ═══════════════════════════════════════════════════════════ */
  async suspendre(id: string, user: User, raison?: string): Promise<CorrespondantResponse> {
    const companyId = await this.resolveCompanyId(user);
    const c = await this.correspondantRepo.findOne({
      where: { id }, relations: ['user'],
    });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);
    if (companyId && c.companyId !== companyId) throw new ForbiddenException('Accès refusé.');
    if (c.status === CorrespondantStatus.SUSPENDED) throw new Error('Ce correspondant est déjà suspendu.');

    await this.correspondantRepo.update(id, { status: CorrespondantStatus.SUSPENDED });
    this.logger.log(`[SUSPENDRE ✅] ID=${id} | Raison=${raison ?? 'N/A'}`);
    return this.findOne(id, user);
  }

  /* ═══════════════════════════════════════════════════════════
   * 8. RÉACTIVER
   * ✅ FIX — relations: ['user']
   ═══════════════════════════════════════════════════════════ */
  async reactiver(id: string, user: User): Promise<CorrespondantResponse> {
    const companyId = await this.resolveCompanyId(user);
    const c = await this.correspondantRepo.findOne({
      where: { id }, relations: ['user'],
    });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);
    if (companyId && c.companyId !== companyId) throw new ForbiddenException('Accès refusé.');

    await this.correspondantRepo.update(id, { status: CorrespondantStatus.ACTIVE });
    this.logger.log(`[REACTIVER ✅] ID=${id}`);
    return this.findOne(id, user);
  }

  /* ═══════════════════════════════════════════════════════════
   * 9. VALIDER
   * ✅ FIX — relations: ['user']
   ═══════════════════════════════════════════════════════════ */
  async valider(id: string, user: User): Promise<CorrespondantResponse> {
    const companyId = await this.resolveCompanyId(user);
    const c = await this.correspondantRepo.findOne({
      where: { id }, relations: ['user'],
    });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);
    if (companyId && c.companyId !== companyId) throw new ForbiddenException('Accès refusé.');
    if (c.status !== CorrespondantStatus.PENDING) {
      throw new Error(`Ce correspondant n'est pas en attente (statut: ${c.status}).`);
    }

    await this.correspondantRepo.update(id, { status: CorrespondantStatus.ACTIVE });
    this.logger.log(`[VALIDER ✅] ID=${id}`);
    return this.findOne(id, user);
  }
}