/* ============================================================
 * FICHIER      : src/modules/company-team/services/team-plan-config.service.ts
 * MODULE       : Company Team
 * ROLE         : Gestion des configurations de plans et des limites de membres.
 *
 * RESPONSABILITES :
 *   - Fournit la limite de membres pour une entreprise donnée.
 *   - Consulte d'abord CompanyPlanAssignment, puis TeamPlanConfig,
 *     puis PlatformSettings en dernier recours.
 *   - Permet au Super Admin d'assigner/modifier le plan d'une entreprise.
 *
 * RÈGLE MÉTIER :
 *   - maxMembers = -1 signifie "illimité" → on retourne Infinity.
 *   - Si aucune assignation n'existe, on utilise le plan STANDARD (5).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TeamPlanConfig, CompanyPlan } from '../../../database/entities/company-team/team-plan-config.entity';
import { CompanyPlanAssignment }       from '../../../database/entities/company-team/company-plan-assignment.entity';
import { PlatformSettings }            from '../../../database/entities/platform-settings.entity';

/** Limite appliquée si toute autre résolution échoue */
const ABSOLUTE_FALLBACK_LIMIT = 5;

@Injectable()
export class TeamPlanConfigService {

  private readonly logger = new Logger(TeamPlanConfigService.name);

  constructor(
    @InjectRepository(TeamPlanConfig)
    private readonly planConfigRepo: Repository<TeamPlanConfig>,

    @InjectRepository(CompanyPlanAssignment)
    private readonly assignmentRepo: Repository<CompanyPlanAssignment>,

    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
  ) {}

  // ════════════════════════════════════════════════════════════
  // LIMITE POUR UNE ENTREPRISE
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne la limite maximale de membres pour une entreprise.
   *
   * Ordre de priorité :
   * 1. Plan assigné à cette entreprise (CompanyPlanAssignment)
   * 2. Valeur globale de PlatformSettings.maxTeamMembersPerCompany
   * 3. ABSOLUTE_FALLBACK_LIMIT (5)
   *
   * Retourne Infinity pour le plan Enterprise (maxMembers = -1).
   */
  async getLimitForCompany(companyId: string): Promise<number> {
    try {
      /* 1 — Chercher l'assignation spécifique */
      const assignment = await this.assignmentRepo.findOne({ where: { companyId } });

      if (assignment) {
        const config = await this.planConfigRepo.findOne({
          where: { planSlug: assignment.planSlug as CompanyPlan, isActive: true },
        });

        if (config) {
          return config.maxMembers === -1 ? Infinity : config.maxMembers;
        }
      }

      /* 2 — Fallback : PlatformSettings */
      const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
      return settings?.maxTeamMembersPerCompany ?? ABSOLUTE_FALLBACK_LIMIT;

    } catch (err) {
      this.logger.error(`Erreur lors de la résolution de la limite — companyId=${companyId}`, err);
      return ABSOLUTE_FALLBACK_LIMIT;
    }
  }

  /**
   * Retourne le plan actif d'une entreprise.
   * Retourne le slug STANDARD si aucune assignation n'existe.
   */
  async getCompanyPlan(companyId: string): Promise<CompanyPlan> {
    const assignment = await this.assignmentRepo.findOne({ where: { companyId } });
    return (assignment?.planSlug as CompanyPlan) ?? CompanyPlan.STANDARD;
  }

  // ════════════════════════════════════════════════════════════
  // GESTION DES PLANS (Super Admin)
  // ════════════════════════════════════════════════════════════

  /** Retourne tous les plans actifs (pour l'affichage dans le dashboard admin) */
  async getAllConfigs(): Promise<TeamPlanConfig[]> {
    return this.planConfigRepo.find({ order: { maxMembers: 'ASC' } });
  }

  /** Retourne la configuration d'un plan spécifique */
  async getConfig(planSlug: CompanyPlan): Promise<TeamPlanConfig> {
    const config = await this.planConfigRepo.findOne({ where: { planSlug } });
    if (!config) throw new NotFoundException(`Plan "${planSlug}" introuvable.`);
    return config;
  }

  /**
   * Assigne (ou met à jour) le plan d'une entreprise.
   * Utilisé par le Super Admin pour upgrader/downgrader.
   */
  async setCompanyPlan(
    companyId: string,
    planSlug: CompanyPlan,
    adminId?: string,
    note?: string,
  ): Promise<CompanyPlanAssignment> {
    /* Vérifier que le plan existe */
    await this.getConfig(planSlug);

    /* Upsert — un seul enregistrement par entreprise */
    let assignment = await this.assignmentRepo.findOne({ where: { companyId } });

    if (assignment) {
      assignment.planSlug         = planSlug;
      assignment.assignedByAdminId = adminId;
      assignment.note              = note;
    } else {
      assignment = this.assignmentRepo.create({
        companyId,
        planSlug,
        assignedByAdminId: adminId,
        note,
      });
    }

    return this.assignmentRepo.save(assignment);
  }

  /**
   * Met à jour la configuration d'un plan (nombre de membres max, etc.).
   * Super Admin uniquement.
   */
  async updateConfig(
    planSlug: CompanyPlan,
    updates: Partial<Pick<TeamPlanConfig, 'maxMembers' | 'name' | 'description' | 'features' | 'isActive'>>,
  ): Promise<TeamPlanConfig> {
    const config = await this.getConfig(planSlug);
    Object.assign(config, updates);
    return this.planConfigRepo.save(config);
  }
}
