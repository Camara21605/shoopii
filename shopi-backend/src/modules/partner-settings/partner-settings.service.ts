/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.service.ts
 *
 * RÔLE    : Moteur de configuration du Partner Management Center.
 *
 *   getSettings()    → config singleton (crée si absente)
 *   updateSettings() → mise à jour du singleton
 *   getStats()       → stats partenaires scopées à l'admin
 *
 * SCOPING stats : partenaires WHERE adminId = admin.id
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  PartnerSetting,
  PartnerTier, PartnerBonusRule,
  PartnerObjective, PartnerRewardRule, PartnerDocument,
} from './partner-settings.entity';
import { UpdatePartnerSettingsDto } from './partner-settings.dto';
import { Admin } from '../../database/entities/profiles/admin-profile.entity';

/* ── Valeurs par défaut ──────────────────────────────────────── */

const DEFAULT_TIERS: PartnerTier[] = [
  {
    id: 'bronze', label: 'Bronze', color: '#cd7f32', icon: 'fa-medal',
    badge: '🥉', description: 'Partenaire débutant — 1 à 49 entreprises recrutées.',
    commission: 5, objectif: 50, bonus: 10_000, minCompanies: 0, enabled: true, order: 1,
  },
  {
    id: 'silver', label: 'Argent', color: '#9aa0a6', icon: 'fa-medal',
    badge: '🥈', description: 'Partenaire confirmé — 50 à 149 entreprises recrutées.',
    commission: 4, objectif: 150, bonus: 25_000, minCompanies: 50, enabled: true, order: 2,
  },
  {
    id: 'gold', label: 'Or', color: '#f7b731', icon: 'fa-crown',
    badge: '🥇', description: 'Partenaire élite — 150 entreprises recrutées ou plus.',
    commission: 3, objectif: 300, bonus: 50_000, minCompanies: 150, enabled: true, order: 3,
  },
];

const DEFAULT_BONUS_RULES: PartnerBonusRule[] = [
  { id: 'monthly_obj',  label: 'Objectif mensuel',    tierId: '*', type: 'monthly',  threshold: 1,  bonusAmount: 0,       enabled: true },
  { id: 'quarter_100', label: 'Cap trimestriel',       tierId: '*', type: 'quarterly',threshold: 100,bonusAmount: 30_000,  enabled: true },
  { id: 'annual_perf', label: 'Prime annuelle',        tierId: '*', type: 'annual',   threshold: 1,  bonusAmount: 100_000, enabled: true },
];

const DEFAULT_OBJECTIVES: PartnerObjective[] = [
  { id: 'companies_monthly', label: 'Entreprises recrutées / mois', metric: 'companies', period: 'monthly',   target: 10, enabled: true },
  { id: 'orders_monthly',    label: 'Commandes générées / mois',    metric: 'orders',    period: 'monthly',   target: 200, enabled: true },
  { id: 'revenue_quarterly', label: 'CA trimestriel (GNF)',         metric: 'revenue',   period: 'quarterly', target: 5_000_000, enabled: false },
];

const DEFAULT_DOCUMENTS: PartnerDocument[] = [
  { id: 'id_card',   label: 'Pièce d\'identité',         description: 'CNI ou passeport en cours de validité.',  required: true  },
  { id: 'proof_addr',label: 'Justificatif de domicile',  description: 'Facture ou attestation récente.',           required: true  },
  { id: 'contract',  label: 'Contrat de partenariat',    description: 'Document signé des deux parties.',          required: true  },
  { id: 'rib',       label: 'RIB / Coordonnées bancaires',description: 'Pour virement des commissions.',           required: false },
];

const DEFAULT_REWARD_RULES: PartnerRewardRule[] = [
  { id: 'first_10',  label: '10 premières entreprises',  type: 'badge',  condition: 'totalCompanies >= 10',  value: 0,      enabled: true },
  { id: 'credit_50', label: 'Crédit à 50 entreprises',   type: 'credit', condition: 'totalCompanies >= 50',  value: 20_000, enabled: true },
  { id: 'vip_150',   label: 'Statut VIP à 150',           type: 'vip',    condition: 'totalCompanies >= 150', value: 0,      enabled: true },
];

const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  partnerRegistered:    true,
  partnerValidated:     true,
  partnerSuspended:     true,
  tierUpgrade:          true,
  tierDowngrade:        false,
  bonusEarned:          true,
  objectiveReached:     true,
  rewardUnlocked:       true,
  paymentSent:          true,
  documentExpired:      true,
};

/* ── Type retourné normalisé ─────────────────────────────────── */

type NormalizedSettings = Omit<PartnerSetting, 'tiers' | 'bonusRules' | 'objectives' | 'rewardRules' | 'requiredDocuments' | 'notifEventsConfig'> & {
  tiers:             PartnerTier[];
  bonusRules:        PartnerBonusRule[];
  objectives:        PartnerObjective[];
  rewardRules:       PartnerRewardRule[];
  requiredDocuments: PartnerDocument[];
  notifEventsConfig: Record<string, boolean>;
  defaultCommissionRate: number;
};

export type PartnerStatsResult = {
  total:              number;
  active:             number;
  pending:            number;
  suspended:          number;
  newThisMonth:       number;
  totalCompaniesRecruited: number;
  totalDeliveries:    number;
  totalCorrespondants:number;
};

/* ══════════════════════════════════════════════════════════════ */

@Injectable()
export class PartnerSettingsService {

  private readonly logger = new Logger(PartnerSettingsService.name);

  constructor(
    @InjectRepository(PartnerSetting)
    private readonly repo: Repository<PartnerSetting>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    private readonly dataSource: DataSource,
  ) {}

  private normalize(cfg: PartnerSetting): NormalizedSettings {
    return {
      ...cfg,
      defaultCommissionRate: Number(cfg.defaultCommissionRate),
      tiers:              cfg.tiers              ?? DEFAULT_TIERS,
      bonusRules:         cfg.bonusRules         ?? DEFAULT_BONUS_RULES,
      objectives:         cfg.objectives         ?? DEFAULT_OBJECTIVES,
      rewardRules:        cfg.rewardRules        ?? DEFAULT_REWARD_RULES,
      requiredDocuments:  cfg.requiredDocuments  ?? DEFAULT_DOCUMENTS,
      notifEventsConfig:  cfg.notifEventsConfig  ?? DEFAULT_NOTIF_EVENTS,
    };
  }

  /* ── GET ────────────────────────────────────────────────────── */

  async getSettings(): Promise<NormalizedSettings> {
    let cfg = await this.repo.findOne({ where: { id: 1 } });
    if (!cfg) {
      cfg = this.repo.create({ id: 1 });
      cfg = await this.repo.save(cfg);
      this.logger.log('[PARTNER-SETTINGS] Initialisation avec les valeurs par défaut.');
    }
    return this.normalize(cfg);
  }

  /* ── PUT ────────────────────────────────────────────────────── */

  async updateSettings(dto: UpdatePartnerSettingsDto): Promise<NormalizedSettings> {
    const cfg = await this.getSettings();

    if (dto.tiers                !== undefined) cfg.tiers                = dto.tiers as PartnerTier[];
    if (dto.commissionMode       !== undefined) cfg.commissionMode       = dto.commissionMode;
    if (dto.defaultCommissionRate !== undefined) cfg.defaultCommissionRate = dto.defaultCommissionRate;
    if (dto.validationMode       !== undefined) cfg.validationMode       = dto.validationMode;
    if (dto.validationDelayH     !== undefined) cfg.validationDelayH     = dto.validationDelayH;
    if (dto.autoRejectExpired    !== undefined) cfg.autoRejectExpired    = dto.autoRejectExpired;
    if (dto.requiredDocuments    !== undefined) cfg.requiredDocuments    = dto.requiredDocuments as PartnerDocument[];
    if (dto.bonusProgramEnabled  !== undefined) cfg.bonusProgramEnabled  = dto.bonusProgramEnabled;
    if (dto.bonusRules           !== undefined) cfg.bonusRules           = dto.bonusRules as PartnerBonusRule[];
    if (dto.objectives           !== undefined) cfg.objectives           = dto.objectives as PartnerObjective[];
    if (dto.rewardProgramEnabled !== undefined) cfg.rewardProgramEnabled = dto.rewardProgramEnabled;
    if (dto.rewardRules          !== undefined) cfg.rewardRules          = dto.rewardRules as PartnerRewardRule[];
    if (dto.paymentFrequency     !== undefined) cfg.paymentFrequency     = dto.paymentFrequency;
    if (dto.autoTierUpgrade      !== undefined) cfg.autoTierUpgrade      = dto.autoTierUpgrade;
    if (dto.autoTierDowngrade    !== undefined) cfg.autoTierDowngrade    = dto.autoTierDowngrade;
    if (dto.notifEventsConfig    !== undefined) cfg.notifEventsConfig    = dto.notifEventsConfig;

    const saved = await this.repo.save(cfg);
    this.logger.log(`[PARTNER-SETTINGS] Mis à jour — mode=${saved.commissionMode} | tiers=${(saved.tiers ?? []).length}`);
    return this.normalize(saved);
  }

  /* ── GET /stats ─────────────────────────────────────────────── */

  async getStats(userId: string): Promise<PartnerStatsResult> {
    const empty: PartnerStatsResult = {
      total: 0, active: 0, pending: 0, suspended: 0, newThisMonth: 0,
      totalCompaniesRecruited: 0, totalDeliveries: 0, totalCorrespondants: 0,
    };

    const admin = await this.adminRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!admin) return empty;

    const [byStatus, newCount, totals] = await Promise.all([
      this.dataSource.query(
        `SELECT p.status, COUNT(*)::int AS count
         FROM partenaires p
         WHERE p."adminId" = $1
         GROUP BY p.status`,
        [admin.id],
      ) as Promise<{ status: string; count: number }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count
         FROM partenaires p
         WHERE p."adminId" = $1
           AND p."createdAt" >= date_trunc('month', NOW())`,
        [admin.id],
      ) as Promise<{ count: number }[]>,

      this.dataSource.query(
        `SELECT
           COALESCE(SUM(p."totalCompanies"),      0)::bigint AS "totalCompanies",
           COALESCE(SUM(p."totalDeliveries"),     0)::bigint AS "totalDeliveries",
           COALESCE(SUM(p."totalCorrespondants"), 0)::bigint AS "totalCorrespondants"
         FROM partenaires p
         WHERE p."adminId" = $1`,
        [admin.id],
      ) as Promise<{ totalCompanies: string; totalDeliveries: string; totalCorrespondants: string }[]>,
    ]);

    const s: Record<string, number> = {};
    for (const r of byStatus) s[r.status] = Number(r.count);

    const t = totals[0];

    return {
      total:               Object.values(s).reduce((a, b) => a + b, 0),
      active:              s['active']    ?? 0,
      pending:             s['pending']   ?? 0,
      suspended:           s['suspended'] ?? 0,
      newThisMonth:        Number(newCount[0]?.count ?? 0),
      totalCompaniesRecruited: Number(t?.totalCompanies    ?? 0),
      totalDeliveries:     Number(t?.totalDeliveries   ?? 0),
      totalCorrespondants: Number(t?.totalCorrespondants ?? 0),
    };
  }
}
