/* ============================================================
 * FICHIER : src/modules/validation-config/validation-config.service.ts
 *
 * RÔLE    : Moteur de configuration des validations Shopi.
 *
 *   getConfig()        → singleton global (lecture ou création)
 *   updateConfig(dto)  → mise à jour du singleton
 *   getStats(userId)   → statistiques scopées à l'admin connecté :
 *                         uniquement les acteurs liés à CET admin,
 *                         pas ceux des autres admins ni du super-admin.
 *
 * SCOPING des stats :
 *   - Partner      → partenaires.adminId = admin.id
 *   - Company      → entreprises.adminId = admin.id
 *   - Delivery     → livreurs.adminId    = admin.id
 *   - Correspondent→ correspondants.partnerId IN
 *                     (SELECT id FROM partenaires WHERE adminId = admin.id)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { ValidationConfig, ActorRule } from './validation-config.entity';
import { UpdateValidationConfigDto }    from './validation-config.dto';
import { Admin }                        from '../../database/entities/profiles/admin-profile.entity';

/* ── Règles par défaut ─────────────────────────────────────── */

export const DEFAULT_ACTOR_RULES: Record<string, ActorRule> = {
  company: {
    auto: false, delaiH: 48, scoreMin: 80, actif: true,
    docs: ['RCCM', 'CNI', 'Contrat Shopi'],
  },
  partner: {
    auto: false, delaiH: 24, scoreMin: 75, actif: true,
    docs: ['CNI', 'Justificatif local'],
  },
  delivery: {
    auto: true, delaiH: 12, scoreMin: 70, actif: true,
    docs: ['CNI', 'Permis de conduire'],
  },
  correspondent: {
    auto: true, delaiH: 6, scoreMin: 65, actif: true,
    docs: ['CNI'],
  },
};

const ACTOR_LABELS: Record<string, string> = {
  partner:       'Partenaires',
  company:       'Entreprises',
  delivery:      'Livreurs',
  correspondent: 'Correspondants',
};

/* ── Requêtes SQL scopées par admin ────────────────────────── *
 *
 * Chaque requête suit la chaîne complète :
 *   Admin → Partenaire → Entreprise / Livreur / Correspondant
 *
 * Règles de scoping :
 *   - Partenaire    : adminId = admin.id  (créé directement par l'admin)
 *   - Entreprise    : adminId = admin.id
 *                     OU partnerId IN (partenaires de l'admin)
 *   - Livreur       : adminId = admin.id
 *                     OU partnerId IN (partenaires de l'admin)
 *                     OU companyId IN (entreprises de l'admin ou de ses partenaires)
 *   - Correspondant : partnerId IN (partenaires de l'admin)
 *                     OU companyId IN (entreprises de l'admin ou de ses partenaires)
 * ─────────────────────────────────────────────────────────── */

const SCOPED_QUERIES: { role: string; sql: string }[] = [
  {
    role: 'partner',
    sql: `
      SELECT u.status, COUNT(*)::int AS count
      FROM users u
      JOIN partenaires p ON p."userId" = u.id
      WHERE p."adminId" = $1
        AND u."deletedAt" IS NULL
      GROUP BY u.status
    `,
  },
  {
    role: 'company',
    sql: `
      SELECT u.status, COUNT(*)::int AS count
      FROM users u
      JOIN entreprises c ON c."userId" = u.id
      WHERE (
        c."adminId" = $1
        OR c."partnerId" IN (
          SELECT id FROM partenaires WHERE "adminId" = $1
        )
      )
        AND u."deletedAt" IS NULL
      GROUP BY u.status
    `,
  },
  {
    role: 'delivery',
    sql: `
      SELECT u.status, COUNT(*)::int AS count
      FROM users u
      JOIN livreurs d ON d."userId" = u.id
      WHERE (
        d."adminId" = $1
        OR d."partnerId" IN (
          SELECT id FROM partenaires WHERE "adminId" = $1
        )
        OR d."companyId" IN (
          SELECT id FROM entreprises
          WHERE "adminId" = $1
             OR "partnerId" IN (SELECT id FROM partenaires WHERE "adminId" = $1)
        )
      )
        AND u."deletedAt" IS NULL
      GROUP BY u.status
    `,
  },
  {
    role: 'correspondent',
    sql: `
      SELECT u.status, COUNT(*)::int AS count
      FROM users u
      JOIN correspondants cor ON cor."userId" = u.id
      WHERE (
        cor."partnerId" IN (
          SELECT id FROM partenaires WHERE "adminId" = $1
        )
        OR cor."companyId" IN (
          SELECT id FROM entreprises
          WHERE "adminId" = $1
             OR "partnerId" IN (SELECT id FROM partenaires WHERE "adminId" = $1)
        )
      )
        AND u."deletedAt" IS NULL
      GROUP BY u.status
    `,
  },
];

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class ValidationConfigService {

  private readonly logger = new Logger(ValidationConfigService.name);

  constructor(
    @InjectRepository(ValidationConfig)
    private readonly configRepo: Repository<ValidationConfig>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Récupère ou initialise la configuration singleton
   * ────────────────────────────────────────────────────────── */
  async getConfig(): Promise<ValidationConfig & { reglesActeurs: Record<string, ActorRule> }> {
    let cfg = await this.configRepo.findOne({ where: { id: 1 } });

    if (!cfg) {
      cfg = this.configRepo.create({ id: 1 });
      cfg = await this.configRepo.save(cfg);
      this.logger.log('[VALIDATION-CONFIG] Initialisation avec les valeurs par défaut.');
    }

    return {
      ...cfg,
      scoreMinAuto: Number(cfg.scoreMinAuto),
      reglesActeurs: { ...DEFAULT_ACTOR_RULES, ...(cfg.reglesActeurs ?? {}) },
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PUT — Met à jour la configuration complète
   * ────────────────────────────────────────────────────────── */
  async updateConfig(
    dto: UpdateValidationConfigDto,
  ): Promise<ValidationConfig & { reglesActeurs: Record<string, ActorRule> }> {
    const cfg = await this.getConfig();

    if (dto.modeGlobal        !== undefined) cfg.modeGlobal        = dto.modeGlobal;
    if (dto.delaiExpirationH  !== undefined) cfg.delaiExpirationH  = dto.delaiExpirationH;
    if (dto.scoreMinAuto      !== undefined) cfg.scoreMinAuto      = dto.scoreMinAuto;
    if (dto.notifEmailEnabled !== undefined) cfg.notifEmailEnabled = dto.notifEmailEnabled;
    if (dto.notifSmsEnabled   !== undefined) cfg.notifSmsEnabled   = dto.notifSmsEnabled;
    if (dto.notifPushEnabled  !== undefined) cfg.notifPushEnabled  = dto.notifPushEnabled;
    if (dto.notifAdminEnabled !== undefined) cfg.notifAdminEnabled = dto.notifAdminEnabled;
    if (dto.reglesActeurs     !== undefined) cfg.reglesActeurs     = dto.reglesActeurs as Record<string, ActorRule>;

    const saved = await this.configRepo.save(cfg);
    this.logger.log(`[VALIDATION-CONFIG] Mis à jour — mode=${saved.modeGlobal} | délai=${saved.delaiExpirationH}h`);

    return {
      ...saved,
      scoreMinAuto: Number(saved.scoreMinAuto),
      reglesActeurs: { ...DEFAULT_ACTOR_RULES, ...(saved.reglesActeurs ?? {}) },
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET /stats — Statistiques scopées à l'admin connecté
   *
   * Seuls les acteurs rattachés à CET admin sont comptabilisés.
   * Les acteurs d'autres admins ou du super-admin sont exclus.
   * ────────────────────────────────────────────────────────── */
  async getStats(userId: string): Promise<{
    byRole: Array<{
      role:     string;
      label:    string;
      actif:    number;
      pending:  number;
      suspendu: number;
      total:    number;
    }>;
    totaux: { actif: number; pending: number; suspendu: number; total: number };
  }> {
    /* ── 1. Résolution de l'admin depuis le userId JWT ── */
    const admin = await this.adminRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!admin) {
      this.logger.warn(`[VALIDATION-CONFIG/stats] Aucun profil admin trouvé pour userId=${userId}`);
      const empty = Object.keys(ACTOR_LABELS).map(role => ({
        role, label: ACTOR_LABELS[role], actif: 0, pending: 0, suspendu: 0, total: 0,
      }));
      return { byRole: empty, totaux: { actif: 0, pending: 0, suspendu: 0, total: 0 } };
    }

    /* ── 2. Requêtes SQL scopées en parallèle ── */
    const byRole = await Promise.all(
      SCOPED_QUERIES.map(async ({ role, sql }) => {
        const rows = await this.configRepo.query(sql, [admin.id]) as {
          status: string;
          count:  number;
        }[];

        const counts = { actif: 0, pending: 0, suspendu: 0 };
        for (const r of rows) {
          const n = Number(r.count);
          if (r.status === 'active')                               counts.actif    += n;
          if (r.status === 'pending')                              counts.pending  += n;
          if (r.status === 'suspended' || r.status === 'banned')  counts.suspendu += n;
        }

        return {
          role,
          label:    ACTOR_LABELS[role] ?? role,
          actif:    counts.actif,
          pending:  counts.pending,
          suspendu: counts.suspendu,
          total:    counts.actif + counts.pending + counts.suspendu,
        };
      }),
    );

    const totaux = byRole.reduce(
      (acc, r) => ({
        actif:    acc.actif    + r.actif,
        pending:  acc.pending  + r.pending,
        suspendu: acc.suspendu + r.suspendu,
        total:    acc.total    + r.total,
      }),
      { actif: 0, pending: 0, suspendu: 0, total: 0 },
    );

    return { byRole, totaux };
  }
}
