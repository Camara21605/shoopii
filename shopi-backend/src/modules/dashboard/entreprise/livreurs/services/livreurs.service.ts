/* ============================================================
 * FICHIER : src/modules/livreurs/services/livreurs.service.ts
 *
 * RÔLE    : Gestion CRUD des livreurs.
 *
 * ─── MÉTHODES ────────────────────────────────────────────────
 *
 *  findAll()         → GET /livreurs            (grille + liste)
 *  findOne()         → GET /livreurs/:id        (ModalProfil)
 *  getStats()        → GET /livreurs/stats      (4 KPI cards)
 *  getZoneStats()    → GET /livreurs/zones      (panneau latéral)
 *  getRecentActivity() → GET /livreurs/activite-recente
 *  update()          → PATCH /livreurs/:id
 *  suspendre()       → PATCH /livreurs/:id/suspendre
 *  reactiver()       → PATCH /livreurs/:id/reactiver
 *  valider()         → PATCH /livreurs/:id/valider  (pending → active)
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *
 *  Une entreprise (COMPANY) ne voit QUE ses propres livreurs
 *  (filtrés par companyId résolu depuis le JWT).
 *  ADMIN et SUPER_ADMIN voient tous les livreurs.
 *
 * ============================================================ */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Delivery,
  DeliveryStatus,
  DeliveryAvailability,
  VehicleType,
} from 'src/database/entities/profiles/livreur-profile.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }
  from 'src/database/entities/user.entity';
import { UserRole }
  from 'src/common/enums/user-role.enum';

import {
  FilterLivreursDto,
  UpdateLivreurDto,
} from '../dto/livreur.dto';

// ─────────────────────────────────────────────────────────────
// INTERFACES DE RÉPONSE — alignées sur LivreursPage.tsx
// ─────────────────────────────────────────────────────────────

export interface LivreurResponse {
  id:                   string;
  fullName:             string;
  email:                string;        // depuis users.email
  phone:                string | null;
  zone:                 string | null;
  VehicleType:          string;
  vehiculePlaque:         string | null;
  vehiculeEmoji:         string;
  status:               string;
  availability:         string;
  avatarEmoji:          string;        // emoji statique selon le vehicleType
  averageRating:        number;
  totalDeliveries:      number;
  successfulDeliveries: number;
  todayDeliveries:      number;        // v1: 0 (pas de dénormalisation yet)
  totalEarnings:        number;
  joinedAt:             string;
  lastActivity:         string;
  lastActivityAt:       string;
  companyId:            string | null;
  userId:               string;
}

export interface LivreurStats {
  total:       number;
  actifs:      number;
  disponibles: number;
  enCourse:    number;
  horsLigne:   number;
  enAttente:   number;
  livrAuj:     number;   // v1: somme des totalDeliveries
}

export interface ZoneStat {
  zone:   string;
  orders: number;
  pct:    number;
  color:  string;
}

// Emoji selon véhicule
const VEHICLE_EMOJI: Record<string, string> = {
  moto:     '🛵',
  voiture:  '🚗',
  velo:     '🚲',
  tricycle: '🛺',
  camion:   '🚚',
  pieton:   '🚶',
};

// Emoji avatar selon véhicule (pour la grille)
const AVATAR_EMOJI: Record<string, string> = {
  moto:     '🧑🏿',
  voiture:  '👨🏿',
  velo:     '🚴🏿',
  tricycle: '🧑🏿‍🦲',
  camion:   '👨🏿‍🦱',
  pieton:   '🚶🏿',
};

const ZONE_COLORS = [
  'var(--blue)', 'var(--violet)', 'var(--emerald)',
  'var(--amber)', 'var(--rose)',
];

@Injectable()
export class LivreursService {

  private readonly logger = new Logger(LivreursService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  // ══════════════════════════════════════════════════════════
  // PRIVÉ — Résoudre companyId depuis le JWT
  // ══════════════════════════════════════════════════════════

  private async resolveCompanyId(user: User): Promise<string | null> {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return null; // pas de filtre
    }
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) {
      throw new NotFoundException(
        'Profil entreprise introuvable. ' +
        'Vérifiez que le compte a été créé avec le rôle company.',
      );
    }
    return company.id;
  }

  // ══════════════════════════════════════════════════════════
  // PRIVÉ — Charger les emails depuis la table users
  // ══════════════════════════════════════════════════════════

  private async loadEmails(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    const rows = await this.deliveryRepo.manager
      .createQueryBuilder()
      .select(['u.id', 'u.email'])
      .from('users', 'u')
      .where('u.id IN (:...ids)', { ids: userIds })
      .getRawMany();
    return Object.fromEntries(rows.map((u: any) => [u.u_id, u.u_email]));
  }

  // ══════════════════════════════════════════════════════════
  // PRIVÉ — Mapper l'entité → réponse frontend
  // ══════════════════════════════════════════════════════════

  private toResponse(
    d: Delivery & { userEmail?: string },
  ): LivreurResponse {
    const vt = d.VehicleType ?? VehicleType.MOTO;
    return {
      id:                   d.id,
      fullName:             d.fullName,
      email:                d.userEmail ?? '',
      phone:                d.phone,
      zone:                 d.zone,
      VehicleType:          vt,
      vehiculePlaque:        d.vehiculePlaque,
      vehiculeEmoji:         VEHICLE_EMOJI[vt] ?? '🛵',
      status:               d.status,
      availability:         d.availability,
      avatarEmoji:          AVATAR_EMOJI[vt] ?? '🧑🏿',
      averageRating:        Number(d.averageRating) || 0,
      totalDeliveries:      d.totalDeliveries ?? 0,
      successfulDeliveries: d.successfulDeliveries ?? 0,
      todayDeliveries:      0,  // v2: champ dénormalisé mis à jour par CRON
      totalEarnings:        Number(d.totalEarnings) || 0,
      joinedAt:             d.createdAt?.toISOString() ?? '',
      lastActivity:         'Aucune activité récente',
      lastActivityAt:       '',
      companyId:            d.companyId,
      userId:               d.userId,
    };
  }

  // ══════════════════════════════════════════════════════════
  // 1. FIND ALL — GET /livreurs
  // Grille et liste de LivreursPage.tsx
  // ══════════════════════════════════════════════════════════

  async findAll(dto: FilterLivreursDto, user: User): Promise<{
    data:  LivreurResponse[];
    total: number;
    page:  number;
    pages: number;
  }> {
    const companyId = await this.resolveCompanyId(user);
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.deliveryRepo
      .createQueryBuilder('d')
      .orderBy('d.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filtre entreprise — ne voit que SES livreurs
    if (companyId) {
      qb.where('d.companyId = :companyId', { companyId });
    }

    // Filtres optionnels
    if (dto.status) {
      qb.andWhere('d.status = :status', { status: dto.status });
    }
    if (dto.availability) {
      qb.andWhere('d.availability = :avail', { avail: dto.availability });
    }
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(d.fullName LIKE :term OR d.zone LIKE :term OR d.phone LIKE :term)',
        { term },
      );
    }

    const [raw, total] = await qb.getManyAndCount();
    const emailMap = await this.loadEmails(raw.map(d => d.userId));
    const data = raw.map(d => this.toResponse({ ...d, userEmail: emailMap[d.userId] ?? '' }));

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ══════════════════════════════════════════════════════════
  // 2. FIND ONE — GET /livreurs/:id
  // Alimente ModalProfil
  // ══════════════════════════════════════════════════════════

  async findOne(id: string, user: User): Promise<LivreurResponse> {
    const companyId = await this.resolveCompanyId(user);
    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);
    if (companyId && d.companyId !== companyId) {
      throw new ForbiddenException("Accès refusé — ce livreur n'appartient pas à votre entreprise.");
    }
    const emailMap = await this.loadEmails([d.userId]);
    return this.toResponse({ ...d, userEmail: emailMap[d.userId] ?? '' });
  }

  // ══════════════════════════════════════════════════════════
  // 3. GET STATS — GET /livreurs/stats
  // 4 KPI cards de LivreursPage.tsx
  // ══════════════════════════════════════════════════════════

  async getStats(user: User): Promise<LivreurStats> {
    const companyId = await this.resolveCompanyId(user);
    const qb = this.deliveryRepo.createQueryBuilder('d');
    if (companyId) qb.where('d.companyId = :companyId', { companyId });
    const all = await qb.getMany();

    return {
      total:       all.length,
      actifs:      all.filter(d => d.status       === DeliveryStatus.ACTIVE).length,
      disponibles: all.filter(d => d.availability === DeliveryAvailability.AVAILABLE).length,
      enCourse:    all.filter(d => d.availability === DeliveryAvailability.ON_DELIVERY).length,
      horsLigne:   all.filter(d => d.availability === DeliveryAvailability.OFFLINE).length,
      enAttente:   all.filter(d => d.status       === DeliveryStatus.PENDING).length,
      livrAuj:     all.reduce((s, d) => s + (d.totalDeliveries ?? 0), 0),
    };
  }

  // ══════════════════════════════════════════════════════════
  // 4. GET ZONE STATS — GET /livreurs/zones
  // Barres "Couverture par zone" dans le panneau latéral
  // ══════════════════════════════════════════════════════════

  async getZoneStats(user: User): Promise<ZoneStat[]> {
    const companyId = await this.resolveCompanyId(user);
    const qb = this.deliveryRepo.createQueryBuilder('d');
    if (companyId) qb.where('d.companyId = :companyId', { companyId });
    const all = await qb.getMany();

    // Grouper par premier segment de zone (avant "·")
    const zoneMap: Record<string, number> = {};
    for (const d of all) {
      if (!d.zone) continue;
      const zone = d.zone.split('·')[0].trim();
      zoneMap[zone] = (zoneMap[zone] ?? 0) + (d.totalDeliveries ?? 0);
    }

    const total = Object.values(zoneMap).reduce((s, n) => s + n, 0) || 1;

    return Object.entries(zoneMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([zone, orders], i) => ({
        zone,
        orders,
        pct:   Math.round((orders / total) * 100),
        color: ZONE_COLORS[i % ZONE_COLORS.length],
      }));
  }

  // ══════════════════════════════════════════════════════════
  // 5. GET RECENT ACTIVITY — GET /livreurs/activite-recente
  // Panneau latéral "Activité récente"
  // ══════════════════════════════════════════════════════════

  async getRecentActivity(user: User): Promise<LivreurResponse[]> {
    const companyId = await this.resolveCompanyId(user);
    const qb = this.deliveryRepo.createQueryBuilder('d');
    if (companyId) qb.where('d.companyId = :companyId', { companyId });
    qb.orderBy('d.updatedAt', 'DESC').take(5);

    const recent = await qb.getMany();
    const emailMap = await this.loadEmails(recent.map(d => d.userId));
    return recent.map(d => this.toResponse({ ...d, userEmail: emailMap[d.userId] ?? '' }));
  }

  // ══════════════════════════════════════════════════════════
  // 6. UPDATE — PATCH /livreurs/:id
  // Modification du profil livreur
  // ══════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateLivreurDto, user: User): Promise<LivreurResponse> {
    const companyId = await this.resolveCompanyId(user);
    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);
    if (companyId && d.companyId !== companyId) throw new ForbiddenException('Accès refusé.');

    Object.assign(d, {
      fullName:     dto.fullName     ?? d.fullName,
      phone:        dto.phone        ?? d.phone,
      zone:         dto.zone         ?? d.zone,
      VehicleType:  dto.VehicleType  ?? d.VehicleType,
      vehiculePlaque: dto.vehiculePlaque ?? d.vehiculePlaque,
      availability: dto.availability ?? d.availability,
    });

    await this.deliveryRepo.save(d);
    this.logger.log(`[UPDATE LIVREUR ✅] ID=${id}`);
    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════
  // 7. SUSPENDRE — PATCH /livreurs/:id/suspendre
  // Bouton "Confirmer" dans ModalSuspendre
  // ══════════════════════════════════════════════════════════

  async suspendre(id: string, user: User, raison?: string): Promise<LivreurResponse> {
    const companyId = await this.resolveCompanyId(user);
    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);
    if (companyId && d.companyId !== companyId) throw new ForbiddenException('Accès refusé.');
    if (d.status === DeliveryStatus.SUSPENDED) {
      throw new Error('Ce livreur est déjà suspendu.');
    }

    await this.deliveryRepo.update(id, {
      status:       DeliveryStatus.SUSPENDED,
      availability: DeliveryAvailability.OFFLINE,
    });
    this.logger.log(`[SUSPENDRE LIVREUR ✅] ID=${id} | Raison=${raison ?? 'N/A'}`);
    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════
  // 8. RÉACTIVER — PATCH /livreurs/:id/reactiver
  // ══════════════════════════════════════════════════════════

  async reactiver(id: string, user: User): Promise<LivreurResponse> {
    const companyId = await this.resolveCompanyId(user);
    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);
    if (companyId && d.companyId !== companyId) throw new ForbiddenException('Accès refusé.');

    await this.deliveryRepo.update(id, { status: DeliveryStatus.ACTIVE });
    this.logger.log(`[REACTIVER LIVREUR ✅] ID=${id}`);
    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════
  // 9. VALIDER — PATCH /livreurs/:id/valider
  // Bouton "Valider les en attente" dans les actions rapides
  // ══════════════════════════════════════════════════════════

  async valider(id: string, user: User): Promise<LivreurResponse> {
    const companyId = await this.resolveCompanyId(user);
    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);
    if (companyId && d.companyId !== companyId) throw new ForbiddenException('Accès refusé.');
    if (d.status !== DeliveryStatus.PENDING) {
      throw new Error(`Ce livreur n'est pas en attente (statut: ${d.status}).`);
    }

    await this.deliveryRepo.update(id, { status: DeliveryStatus.ACTIVE });
    this.logger.log(`[VALIDER LIVREUR ✅] ID=${id}`);
    return this.findOne(id, user);
  }
}