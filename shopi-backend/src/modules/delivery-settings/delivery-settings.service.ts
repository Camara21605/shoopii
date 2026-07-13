/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.service.ts
 *
 * RÔLE    : Moteur de configuration des livreurs Shopi.
 *
 *   getSettings()    → config singleton (crée si absente)
 *   updateSettings() → mise à jour du singleton
 *   getStats()       → stats livreurs scopées à l'admin
 *
 * SCOPING stats :
 *   Livreurs dont adminId = admin.id
 *   OU companyId IN (entreprises de l'admin)
 *   OU partnerId IN (partenaires de l'admin)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  DeliverySetting,
  BonusRule, PenaltyRule, VehicleRule,
} from './delivery-settings.entity';
import { UpdateDeliverySettingsDto } from './delivery-settings.dto';
import { Admin } from '../../database/entities/profiles/admin-profile.entity';

/* ── Valeurs par défaut ─────────────────────────────────────── */

const DEFAULT_SCORE_WEIGHTS: Record<string, number> = {
  ponctualite:      30,
  noteClients:      25,
  tauxReussite:     20,
  volumeLivraisons: 15,
  absenceIncidents: 10,
};

const DEFAULT_BONUS_RULES: BonusRule[] = [
  { id: 'daily_20',    label: 'Bonus journalier',   type: 'daily',   deliveriesRequired: 20,  bonusAmount: 5_000,   enabled: true  },
  { id: 'weekly_100',  label: 'Bonus hebdomadaire',  type: 'weekly',  deliveriesRequired: 100, bonusAmount: 30_000,  enabled: true  },
  { id: 'monthly_400', label: 'Bonus mensuel',        type: 'monthly', deliveriesRequired: 400, bonusAmount: 150_000, enabled: true  },
];

const DEFAULT_PENALTY_RULES: PenaltyRule[] = [
  { id: 'refus_3',   trigger: 'Refus répétés',          threshold: 3, action: 'warning',        value: 0,  enabled: true },
  { id: 'retard_5',  trigger: 'Retards répétés',         threshold: 5, action: 'score_reduction', value: 10, enabled: true },
  { id: 'abandon_2', trigger: 'Abandon de commande',     threshold: 2, action: 'suspend_temp',    value: 7,  enabled: true },
  { id: 'fraude_1',  trigger: 'Fraude / Faux GPS',       threshold: 1, action: 'suspend_perm',    value: 0,  enabled: true },
  { id: 'plainte_5', trigger: 'Plaintes clients',         threshold: 5, action: 'score_reduction', value: 15, enabled: true },
];

const DEFAULT_VEHICLE_RULES: VehicleRule[] = [
  { type: 'moto',     icon: '🛵', label: 'Moto',     maxWeightKg: 30,   maxDistanceKm: 50,  enabled: true  },
  { type: 'voiture',  icon: '🚗', label: 'Voiture',  maxWeightKg: 100,  maxDistanceKm: 100, enabled: true  },
  { type: 'velo',     icon: '🚲', label: 'Vélo',     maxWeightKg: 15,   maxDistanceKm: 15,  enabled: true  },
  { type: 'tricycle', icon: '🛺', label: 'Tricycle', maxWeightKg: 200,  maxDistanceKm: 30,  enabled: true  },
  { type: 'camion',   icon: '🚚', label: 'Camion',   maxWeightKg: 2000, maxDistanceKm: 200, enabled: false },
  { type: 'pieton',   icon: '🚶', label: 'À pied',   maxWeightKg: 10,   maxDistanceKm: 5,   enabled: false },
];

const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  deliveryAssigned:  true,
  deliveryCompleted: true,
  deliverySuspended: true,
  bonusEarned:       true,
  penaltyApplied:    true,
  scoreChanged:      false,
  paymentSent:       true,
  newZone:           true,
};

/* ── Type retourné normalisé ─────────────────────────────────── */

type NormalizedSettings = DeliverySetting & {
  scoreWeights:    Record<string, number>;
  bonusRules:      BonusRule[];
  penaltyRules:    PenaltyRule[];
  vehicleRules:    VehicleRule[];
  notifEventsConfig: Record<string, boolean>;
};

type DeliveryStatsResult = {
  total: number; active: number; pending: number; suspended: number; banned: number;
  available: number; onDelivery: number; offline: number; newThisMonth: number;
  totalDeliveries: number; avgRating: number; avgPonctualite: number;
  totalEarnings: number; verified: number;
};

/* ══════════════════════════════════════════════════════════ */

@Injectable()
export class DeliverySettingsService {

  private readonly logger = new Logger(DeliverySettingsService.name);

  constructor(
    @InjectRepository(DeliverySetting)
    private readonly repo: Repository<DeliverySetting>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    private readonly dataSource: DataSource,
  ) {}

  private normalize(cfg: DeliverySetting): NormalizedSettings {
    return {
      ...cfg,
      platformCommissionRate: Number(cfg.platformCommissionRate),
      scoreWeights:     cfg.scoreWeights     ?? DEFAULT_SCORE_WEIGHTS,
      bonusRules:       cfg.bonusRules       ?? DEFAULT_BONUS_RULES,
      penaltyRules:     cfg.penaltyRules     ?? DEFAULT_PENALTY_RULES,
      vehicleRules:     cfg.vehicleRules     ?? DEFAULT_VEHICLE_RULES,
      notifEventsConfig:cfg.notifEventsConfig ?? DEFAULT_NOTIF_EVENTS,
    };
  }

  /* ── GET ────────────────────────────────────────────────────── */
  async getSettings(): Promise<NormalizedSettings> {
    let cfg = await this.repo.findOne({ where: { id: 1 } });
    if (!cfg) {
      cfg = this.repo.create({ id: 1 });
      cfg = await this.repo.save(cfg);
      this.logger.log('[DELIVERY-SETTINGS] Initialisation avec les valeurs par défaut.');
    }
    return this.normalize(cfg);
  }

  /* ── PUT ────────────────────────────────────────────────────── */
  async updateSettings(dto: UpdateDeliverySettingsDto): Promise<NormalizedSettings> {
    const cfg = await this.getSettings();

    if (dto.assignmentStrategy       !== undefined) cfg.assignmentStrategy       = dto.assignmentStrategy;
    if (dto.autoAssignEnabled        !== undefined) cfg.autoAssignEnabled        = dto.autoAssignEnabled;
    if (dto.acceptDeadlineMin        !== undefined) cfg.acceptDeadlineMin        = dto.acceptDeadlineMin;
    if (dto.maxSimultaneousOrders    !== undefined) cfg.maxSimultaneousOrders    = dto.maxSimultaneousOrders;
    if (dto.reassignTimeoutMin       !== undefined) cfg.reassignTimeoutMin       = dto.reassignTimeoutMin;
    if (dto.maxRadiusKm              !== undefined) cfg.maxRadiusKm              = dto.maxRadiusKm;
    if (dto.maxDeliveryDistanceKm    !== undefined) cfg.maxDeliveryDistanceKm    = dto.maxDeliveryDistanceKm;
    if (dto.minScore                 !== undefined) cfg.minScore                 = dto.minScore;
    if (dto.suspensionScoreThreshold !== undefined) cfg.suspensionScoreThreshold = dto.suspensionScoreThreshold;
    if (dto.reactivationScoreThreshold !== undefined) cfg.reactivationScoreThreshold = dto.reactivationScoreThreshold;
    if (dto.scoreWeights             !== undefined) cfg.scoreWeights             = dto.scoreWeights;
    if (dto.bonusProgramEnabled      !== undefined) cfg.bonusProgramEnabled      = dto.bonusProgramEnabled;
    if (dto.bonusRules               !== undefined) cfg.bonusRules               = dto.bonusRules as BonusRule[];
    if (dto.autoPenaltyEnabled       !== undefined) cfg.autoPenaltyEnabled       = dto.autoPenaltyEnabled;
    if (dto.penaltyRules             !== undefined) cfg.penaltyRules             = dto.penaltyRules as PenaltyRule[];
    if (dto.vehicleRules             !== undefined) cfg.vehicleRules             = dto.vehicleRules as VehicleRule[];
    if (dto.paymentFrequency         !== undefined) cfg.paymentFrequency         = dto.paymentFrequency;
    if (dto.platformCommissionRate   !== undefined) cfg.platformCommissionRate   = dto.platformCommissionRate;
    if (dto.notifEventsConfig        !== undefined) cfg.notifEventsConfig        = dto.notifEventsConfig;

    const saved = await this.repo.save(cfg);
    this.logger.log(`[DELIVERY-SETTINGS] Mis à jour — stratégie=${saved.assignmentStrategy} | score_min=${saved.minScore}`);
    return this.normalize(saved);
  }

  /* ── GET /stats ─────────────────────────────────────────────── */
  async getStats(userId: string): Promise<DeliveryStatsResult> {
    const empty: DeliveryStatsResult = {
      total: 0, active: 0, pending: 0, suspended: 0, banned: 0,
      available: 0, onDelivery: 0, offline: 0, newThisMonth: 0,
      totalDeliveries: 0, avgRating: 0, avgPonctualite: 0, totalEarnings: 0, verified: 0,
    };

    const admin = await this.adminRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!admin) return empty;

    const BASE = `
      FROM livreurs l
      WHERE (
        l."adminId" = $1
        OR l."companyId" IN (SELECT id FROM entreprises WHERE "adminId" = $1)
        OR l."partnerId" IN (SELECT id FROM partenaires WHERE "adminId" = $1)
      )
    `;

    const [byStatus, byAvail, newCount, financials, verifiedCount] = await Promise.all([
      this.dataSource.query(
        `SELECT l.status, COUNT(*)::int AS count ${BASE} GROUP BY l.status`,
        [admin.id],
      ) as Promise<{ status: string; count: number }[]>,

      this.dataSource.query(
        `SELECT l.availability, COUNT(*)::int AS count ${BASE} AND l.status = 'active' GROUP BY l.availability`,
        [admin.id],
      ) as Promise<{ availability: string; count: number }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count ${BASE} AND l."createdAt" >= date_trunc('month', NOW())`,
        [admin.id],
      ) as Promise<{ count: number }[]>,

      this.dataSource.query(
        `SELECT
           COALESCE(SUM(l."totalDeliveries"),   0)::bigint  AS "totalDeliveries",
           COALESCE(AVG(l."averageRating"),      0)::numeric AS "avgRating",
           COALESCE(AVG(l.ponctualite),          0)::numeric AS "avgPonctualite",
           COALESCE(SUM(l."totalEarnings"),      0)::numeric AS "totalEarnings"
         ${BASE}`,
        [admin.id],
      ) as Promise<{ totalDeliveries: string; avgRating: string; avgPonctualite: string; totalEarnings: string }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count ${BASE} AND l."verificationStatus" = 'verified'`,
        [admin.id],
      ) as Promise<{ count: number }[]>,
    ]);

    const s: Record<string, number> = {};
    for (const r of byStatus) s[r.status] = Number(r.count);

    const av: Record<string, number> = {};
    for (const r of byAvail) av[r.availability] = Number(r.count);

    const f = financials[0];

    return {
      total:          Object.values(s).reduce((a, b) => a + b, 0),
      active:         s['active']    ?? 0,
      pending:        s['pending']   ?? 0,
      suspended:      s['suspended'] ?? 0,
      banned:         s['banned']    ?? 0,
      available:      av['available']   ?? 0,
      onDelivery:     av['on_delivery'] ?? 0,
      offline:        av['offline']     ?? 0,
      newThisMonth:   Number(newCount[0]?.count   ?? 0),
      totalDeliveries:Number(f?.totalDeliveries   ?? 0),
      avgRating:      Number(f?.avgRating          ?? 0),
      avgPonctualite: Number(f?.avgPonctualite     ?? 0),
      totalEarnings:  Number(f?.totalEarnings      ?? 0),
      verified:       Number(verifiedCount[0]?.count ?? 0),
    };
  }
}
