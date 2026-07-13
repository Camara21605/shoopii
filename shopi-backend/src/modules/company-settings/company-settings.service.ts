/* ============================================================
 * FICHIER : src/modules/company-settings/company-settings.service.ts
 *
 * RÔLE    : Moteur de configuration des entreprises Shopi.
 *
 *   getSettings()        → config singleton (crée si absente)
 *   updateSettings(dto)  → mise à jour du singleton
 *   getStats(userId)     → stats entreprises scopées à l'admin
 *   getCategoriesList()  → catégories actives depuis la DB
 *
 * SCOPING stats :
 *   Entreprises dont adminId = admin.id
 *   OU partnerId IN (partenaires de l'admin)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  CompanySetting,
  CommissionBracket,
  RequiredDocument,
  CategoryRule,
} from './company-settings.entity';
import { UpdateCompanySettingsDto } from './company-settings.dto';
import { Admin }    from '../../database/entities/profiles/admin-profile.entity';
import { Category } from '../../database/entities/entreprise.table/category.entity';

/* ── Defaults ───────────────────────────────────────────────── */

export const DEFAULT_DOCUMENTS: RequiredDocument[] = [
  { id: 'rccm',    label: 'RCCM',                    description: 'Registre du Commerce et du Crédit Mobilier',    required: true  },
  { id: 'cni',     label: 'CNI / Passeport',          description: "Pièce d'identité du représentant légal",       required: true  },
  { id: 'contrat', label: 'Contrat Shopi',             description: 'Contrat signé avec Shopi Guinée',              required: true  },
  { id: 'nif',     label: 'NIF / Attestation fiscale', description: "Numéro d'Identification Fiscale",             required: false },
  { id: 'photo',   label: 'Photo du commerce',         description: 'Photo extérieure du point de vente',          required: false },
  { id: 'banque',  label: 'Coordonnées bancaires',     description: 'RIB ou compte Mobile Money de réception',     required: false },
];

export const DEFAULT_BRACKETS: CommissionBracket[] = [
  { from: 0,          to: 1_000_000,  rate: 8 },
  { from: 1_000_000,  to: 5_000_000,  rate: 6 },
  { from: 5_000_000,  to: null,        rate: 4 },
];

const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  newEnterprise:         true,
  enterpriseValidated:   true,
  enterpriseSuspended:   true,
  documentSubmitted:     true,
  documentExpired:       true,
  orderThresholdReached: false,
  inactivityWarning:     true,
  suspensionAutoTrigger: true,
};

/* ══════════════════════════════════════════════════════════ */

@Injectable()
export class CompanySettingsService {

  private readonly logger = new Logger(CompanySettingsService.name);

  constructor(
    @InjectRepository(CompanySetting)
    private readonly settingsRepo: Repository<CompanySetting>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    private readonly dataSource: DataSource,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — config complète avec defaults injectés
   * ────────────────────────────────────────────────────────── */
  async getSettings(): Promise<CompanySetting & {
    requiredDocuments:  RequiredDocument[];
    commissionBrackets: CommissionBracket[];
    notifEventsConfig:  Record<string, boolean>;
  }> {
    let cfg = await this.settingsRepo.findOne({ where: { id: 1 } });

    if (!cfg) {
      cfg = this.settingsRepo.create({ id: 1 });
      cfg = await this.settingsRepo.save(cfg);
      this.logger.log('[COMPANY-SETTINGS] Initialisation avec les valeurs par défaut.');
    }

    return {
      ...cfg,
      commissionValue:    Number(cfg.commissionValue),
      commissionMin:      Number(cfg.commissionMin),
      commissionMax:      Number(cfg.commissionMax),
      requiredDocuments:  cfg.requiredDocuments  ?? DEFAULT_DOCUMENTS,
      commissionBrackets: cfg.commissionBrackets ?? DEFAULT_BRACKETS,
      categoryRules:      cfg.categoryRules      ?? [],
      notifEventsConfig:  cfg.notifEventsConfig  ?? DEFAULT_NOTIF_EVENTS,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PUT — mise à jour complète
   * ────────────────────────────────────────────────────────── */
  async updateSettings(dto: UpdateCompanySettingsDto): Promise<CompanySetting & {
    requiredDocuments:  RequiredDocument[];
    commissionBrackets: CommissionBracket[];
    notifEventsConfig:  Record<string, boolean>;
  }> {
    const cfg = await this.getSettings();

    if (dto.commissionType            !== undefined) cfg.commissionType            = dto.commissionType;
    if (dto.commissionValue           !== undefined) cfg.commissionValue           = dto.commissionValue;
    if (dto.commissionMin             !== undefined) cfg.commissionMin             = dto.commissionMin;
    if (dto.commissionMax             !== undefined) cfg.commissionMax             = dto.commissionMax;
    if (dto.commissionBrackets        !== undefined) cfg.commissionBrackets        = dto.commissionBrackets as CommissionBracket[];
    if (dto.validationMode            !== undefined) cfg.validationMode            = dto.validationMode;
    if (dto.validationDelayH          !== undefined) cfg.validationDelayH          = dto.validationDelayH;
    if (dto.requiredDocuments         !== undefined) cfg.requiredDocuments         = dto.requiredDocuments as RequiredDocument[];
    if (dto.categoryRules             !== undefined) cfg.categoryRules             = dto.categoryRules as CategoryRule[];
    if (dto.monthlyOrderLimit         !== undefined) cfg.monthlyOrderLimit         = dto.monthlyOrderLimit;
    if (dto.dailyOrderLimit           !== undefined) cfg.dailyOrderLimit           = dto.dailyOrderLimit;
    if (dto.maxProducts               !== undefined) cfg.maxProducts               = dto.maxProducts;
    if (dto.maxActivePromotions       !== undefined) cfg.maxActivePromotions       = dto.maxActivePromotions;
    if (dto.maxBranches               !== undefined) cfg.maxBranches               = dto.maxBranches;
    if (dto.allowPhysical             !== undefined) cfg.allowPhysical             = dto.allowPhysical;
    if (dto.allowDigital              !== undefined) cfg.allowDigital              = dto.allowDigital;
    if (dto.allowServices             !== undefined) cfg.allowServices             = dto.allowServices;
    if (dto.allowInternational        !== undefined) cfg.allowInternational        = dto.allowInternational;
    if (dto.autoSuspensionEnabled     !== undefined) cfg.autoSuspensionEnabled     = dto.autoSuspensionEnabled;
    if (dto.suspensionSignalThreshold !== undefined) cfg.suspensionSignalThreshold = dto.suspensionSignalThreshold;
    if (dto.suspensionLitigeThreshold !== undefined) cfg.suspensionLitigeThreshold = dto.suspensionLitigeThreshold;
    if (dto.inactivityDays            !== undefined) cfg.inactivityDays            = dto.inactivityDays;
    if (dto.notifEventsConfig         !== undefined) cfg.notifEventsConfig         = dto.notifEventsConfig;

    const saved = await this.settingsRepo.save(cfg);
    this.logger.log(`[COMPANY-SETTINGS] Mis à jour — commission=${saved.commissionType}:${saved.commissionValue} | mode=${saved.validationMode}`);

    return {
      ...saved,
      commissionValue:    Number(saved.commissionValue),
      commissionMin:      Number(saved.commissionMin),
      commissionMax:      Number(saved.commissionMax),
      requiredDocuments:  saved.requiredDocuments  ?? DEFAULT_DOCUMENTS,
      commissionBrackets: saved.commissionBrackets ?? DEFAULT_BRACKETS,
      categoryRules:      saved.categoryRules      ?? [],
      notifEventsConfig:  saved.notifEventsConfig  ?? DEFAULT_NOTIF_EVENTS,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET /stats — statistiques scopées à l'admin connecté
   * ────────────────────────────────────────────────────────── */
  async getStats(userId: string): Promise<{
    total:        number;
    active:       number;
    pending:      number;
    suspended:    number;
    newThisMonth: number;
    verified:     number;
    premium:      number;
    totalRevenue: number;
    totalOrders:  number;
  }> {
    const admin = await this.adminRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!admin) {
      return {
        total: 0, active: 0, pending: 0, suspended: 0, newThisMonth: 0,
        verified: 0, premium: 0, totalRevenue: 0, totalOrders: 0,
      };
    }

    const BASE = `
      FROM entreprises c
      WHERE (
        c."adminId" = $1
        OR c."partnerId" IN (SELECT id FROM partenaires WHERE "adminId" = $1)
      )
    `;

    const [byStatus, newCount, verifiedResult, premiumResult, financials] = await Promise.all([
      this.dataSource.query(
        `SELECT c.status, COUNT(*)::int AS count ${BASE} GROUP BY c.status`,
        [admin.id],
      ) as Promise<{ status: string; count: number }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count ${BASE} AND c."createdAt" >= date_trunc('month', NOW())`,
        [admin.id],
      ) as Promise<{ count: number }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count ${BASE} AND c."verificationStatus" = 'verified'`,
        [admin.id],
      ) as Promise<{ count: number }[]>,

      this.dataSource.query(
        `SELECT COUNT(*)::int AS count ${BASE} AND c.plan = 'premium'`,
        [admin.id],
      ) as Promise<{ count: number }[]>,

      this.dataSource.query(
        `SELECT COALESCE(SUM(c."totalRevenue"), 0)::numeric AS "totalRevenue",
                COALESCE(SUM(c."totalOrders"),  0)::bigint  AS "totalOrders"
         ${BASE}`,
        [admin.id],
      ) as Promise<{ totalRevenue: string; totalOrders: string }[]>,
    ]);

    const counts = { active: 0, pending: 0, suspended: 0 };
    for (const r of byStatus) {
      const n = Number(r.count);
      if (r.status === 'active')    counts.active    += n;
      if (r.status === 'pending')   counts.pending   += n;
      if (r.status === 'suspended') counts.suspended += n;
    }

    return {
      total:        counts.active + counts.pending + counts.suspended,
      active:       counts.active,
      pending:      counts.pending,
      suspended:    counts.suspended,
      newThisMonth: Number(newCount[0]?.count       ?? 0),
      verified:     Number(verifiedResult[0]?.count  ?? 0),
      premium:      Number(premiumResult[0]?.count   ?? 0),
      totalRevenue: Number(financials[0]?.totalRevenue ?? 0),
      totalOrders:  Number(financials[0]?.totalOrders  ?? 0),
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET /categories-list — catégories actives depuis la DB
   * ────────────────────────────────────────────────────────── */
  async getCategoriesList(): Promise<{
    id:      string;
    nom:     string;
    slug:    string;
    icone:   string | null;
    couleur: string | null;
    actif:   boolean;
  }[]> {
    const cats = await this.categoryRepo.find({
      order: { ordre: 'ASC', nom: 'ASC' },
      select: ['id', 'nom', 'slug', 'icone', 'couleur', 'actif'],
    });
    return cats;
  }
}
