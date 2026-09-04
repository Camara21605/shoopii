/* ============================================================
 * FICHIER : src/modules/commission/services/commission-config.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Charge et expose la configuration de commission depuis la base.
 *
 * DEUX SOURCES DE VÉRITÉ
 * ─────────────────────────────────────────────────────────────
 *  1. PlatformSettings (id=1) — configuration opérationnelle actuelle.
 *     Le Super Admin modifie directement cette table via le dashboard.
 *
 *  2. CommissionRule — snapshot versionné.
 *     À chaque modification de PlatformSettings, une nouvelle CommissionRule
 *     est créée automatiquement par createOrUpdateRule().
 *     Les PaiementDistribution référencent CommissionRule.id pour l'audit.
 *
 * UTILISATION
 * ─────────────────────────────────────────────────────────────
 *  CommissionEngine → getActiveRule() → CommissionRule
 *  CommissionEngine → getSettings()  → PlatformSettings
 *  AdminModule      → createOrUpdateRule() quand settings changent
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Repository<PlatformSettings>
 *  Repository<CommissionRule>
 *  EventEmitter2
 * ============================================================ */

import { Injectable, Logger }    from '@nestjs/common';
import { InjectRepository }      from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { PlatformSettings }  from '../../../database/entities/platform-settings.entity';
import { CommissionRule }    from '../../../database/entities/paiement/commission-rule.entity';
import { CompanySetting }    from '../../company-settings/company-settings.entity';
import { PartnerSetting }    from '../../partner-settings/partner-settings.entity';
import {
  CommissionRuleActivatedEvent,
  CommissionRuleDisabledEvent,
  COMMISSION_EVENTS,
} from '../events/commission.events';
import { CommissionErreur, CommissionErreurType } from '../types/commission.types';
import { CommissionEventBus } from '../events/commission-event-bus.service';

@Injectable()
export class CommissionConfigService {

  private readonly logger = new Logger(CommissionConfigService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    @InjectRepository(CommissionRule)
    private readonly ruleRepo: Repository<CommissionRule>,

    @InjectRepository(CompanySetting)
    private readonly companySettingsRepo: Repository<CompanySetting>,

    @InjectRepository(PartnerSetting)
    private readonly partnerSettingsRepo: Repository<PartnerSetting>,

    private readonly dataSource:    DataSource,
    private readonly eventBus:      CommissionEventBus,
  ) {}

  /**
   * Retourne la config singleton CompanySetting (id=1), ou null si absente
   * (table pas encore initialisée — le calculateur retombe alors sur le
   * taux de rule.tauxCommissionProduit, comportement identique à avant).
   * Lecture toujours fraîche (pas de cache) : contrairement à CommissionRule,
   * CompanySetting n'est pas versionnée — un changement doit s'appliquer
   * immédiatement, comme l'annonce déjà l'UI ("prend effet immédiatement").
   */
  async getCompanySettings(): Promise<CompanySetting | null> {
    return this.companySettingsRepo.findOne({ where: { id: 1 } });
  }

  /**
   * Retourne la config singleton PartnerSetting (id=1), ou null si absente.
   * Même principe que getCompanySettings() — lecture fraîche, pas versionnée.
   */
  async getPartnerSettings(): Promise<PartnerSetting | null> {
    return this.partnerSettingsRepo.findOne({ where: { id: 1 } });
  }

  /* ──────────────────────────────────────────────────────────
   * getSettings() — charge le singleton PlatformSettings
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne le singleton PlatformSettings (id = 1).
   *
   * @throws CommissionErreur si la table est vide (jamais initialisée)
   */
  async getSettings(): Promise<PlatformSettings> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });

    if (!settings) {
      throw new CommissionErreur(
        CommissionErreurType.REGLE_ABSENTE,
        'PlatformSettings introuvable (id=1). Le système n\'est pas initialisé.',
      );
    }

    return settings;
  }

  /* ──────────────────────────────────────────────────────────
   * getActiveRule() — charge la CommissionRule active
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne la CommissionRule actuellement active.
   *
   * Si aucune règle active n'existe (premier démarrage), crée
   * automatiquement une règle initiale depuis PlatformSettings.
   *
   * @returns CommissionRule active ou null si création impossible
   */
  async getActiveRule(): Promise<CommissionRule | null> {
    const rule = await this.ruleRepo.findOne({ where: { isActive: true } });

    if (!rule) {
      this.logger.warn('[CommissionConfig] Aucune CommissionRule active — initialisation auto');
      try {
        return await this.initializeFirstRule();
      } catch (err) {
        this.logger.error('[CommissionConfig] Impossible de créer la règle initiale:', err);
        return null;
      }
    }

    return rule;
  }

  /* ──────────────────────────────────────────────────────────
   * createOrUpdateRule() — versionnage des taux
   * ────────────────────────────────────────────────────────── */

  /**
   * Crée une nouvelle CommissionRule à partir des settings actuels
   * et désactive l'ancienne.
   *
   * Doit être appelé par le service PlatformSettings chaque fois
   * qu'un champ de commission est modifié.
   *
   * @param changedByUserId UUID du Super Admin ayant fait la modification
   * @param note Raison du changement (obligatoire pour l'audit)
   * @returns La nouvelle CommissionRule active
   */
  async createOrUpdateRule(
    changedByUserId: string,
    note?: string,
  ): Promise<CommissionRule> {
    const settings = await this.getSettings();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      /* 1. Désactiver l'ancienne règle active */
      const currentRule = await qr.manager.findOne(CommissionRule, { where: { isActive: true } });
      const previousRuleId = currentRule?.id ?? null;

      if (currentRule) {
        currentRule.isActive      = false;
        currentRule.deactivatedAt = new Date();
        await qr.manager.save(CommissionRule, currentRule);

        this.logger.log(
          `[CommissionConfig] Règle v${currentRule.version} désactivée (id: ${currentRule.id})`,
        );
      }

      /* 2. Calculer le prochain numéro de version */
      const maxVersion = await qr.manager
        .createQueryBuilder(CommissionRule, 'r')
        .select('MAX(r.version)', 'max')
        .getRawOne<{ max: number | null }>();

      const nextVersion = (maxVersion?.max ?? 0) + 1;

      /* 3. Créer la nouvelle règle */
      const newRule = qr.manager.create(CommissionRule, {
        version:               nextVersion,
        label:                 `Taux v${nextVersion} — ${new Date().toISOString().slice(0, 10)}`,
        isActive:              true,
        note:                  note ?? null,
        createdByUserId:       changedByUserId,
        activatedAt:           new Date(),

        /* Commission produit */
        tauxCommissionProduit:   Number(settings.tauxCommissionProduit),
        planMultiplierStandard:  1.0,
        planMultiplierPro:       Number(settings.planMultiplierPro),
        planMultiplierPremium:   Number(settings.planMultiplierPremium),
        ratioShopiProduit:       Number(settings.ratioShopiProduit),
        ratioPartenaireProduit:  Number(settings.ratioPartenaireProduit),
        ratioAdminProduit:       Number(settings.ratioAdminProduit),

        /* Commission livraison */
        tauxCommissionLivraison:  Number(settings.tauxCommissionLivraison),
        ratioShopiLivraison:      Number(settings.ratioShopiLivraison),
        ratioPartenaireLivraison: Number(settings.ratioPartenaireLivraison),
        ratioAdminLivraison:      Number(settings.ratioAdminLivraison),
      });

      const savedRule = await qr.manager.save(CommissionRule, newRule);
      await qr.commitTransaction();

      this.logger.log(
        `[CommissionConfig] Nouvelle règle v${nextVersion} créée (id: ${savedRule.id})`,
      );

      /* 4. Émettre les événements */
      if (currentRule) {
        this.eventBus.emit(
          COMMISSION_EVENTS.RULE_DISABLED,
          new CommissionRuleDisabledEvent(currentRule.id, currentRule.version, changedByUserId),
        );
      }

      this.eventBus.emit(
        COMMISSION_EVENTS.RULE_ACTIVATED,
        new CommissionRuleActivatedEvent(
          savedRule.id,
          savedRule.version,
          previousRuleId,
          changedByUserId,
        ),
      );

      return savedRule;

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error('[CommissionConfig] Erreur createOrUpdateRule:', err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  /* ──────────────────────────────────────────────────────────
   * getRuleHistory() — liste l'historique des règles
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne toutes les CommissionRules triées par version décroissante.
   * Utilisé par l'interface admin pour l'historique des changements.
   */
  async getRuleHistory(): Promise<CommissionRule[]> {
    return this.ruleRepo.find({
      order: { version: 'DESC' },
    });
  }

  /* ──────────────────────────────────────────────────────────
   * getPlanMultiplier() — multiplicateur selon le plan
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne le multiplicateur de commission pour un plan donné.
   * Les multiplicateurs proviennent de la CommissionRule active.
   *
   * @param plan Plan de l'entreprise (standard | pro | premium)
   * @param rule CommissionRule active
   * @returns Multiplicateur (ex : 0.75 pour PRO)
   */
  getPlanMultiplier(plan: string, rule: CommissionRule): number {
    switch (plan.toLowerCase()) {
      case 'pro':     return Number(rule.planMultiplierPro);
      case 'premium': return Number(rule.planMultiplierPremium);
      default:        return Number(rule.planMultiplierStandard);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * Privé : initializeFirstRule()
   * ────────────────────────────────────────────────────────── */

  /**
   * Crée la première CommissionRule au premier démarrage.
   * Appelé automatiquement si getActiveRule() trouve la table vide.
   */
  private async initializeFirstRule(): Promise<CommissionRule> {
    const settings = await this.getSettings();

    const rule = this.ruleRepo.create({
      version:               1,
      label:                 'Taux initiaux Shopi',
      isActive:              true,
      note:                  'Création automatique au premier démarrage',
      createdByUserId:       null,
      activatedAt:           new Date(),
      tauxCommissionProduit:   Number(settings.tauxCommissionProduit),
      planMultiplierStandard:  1.0,
      planMultiplierPro:       Number(settings.planMultiplierPro),
      planMultiplierPremium:   Number(settings.planMultiplierPremium),
      ratioShopiProduit:       Number(settings.ratioShopiProduit),
      ratioPartenaireProduit:  Number(settings.ratioPartenaireProduit),
      ratioAdminProduit:       Number(settings.ratioAdminProduit),
      tauxCommissionLivraison:  Number(settings.tauxCommissionLivraison),
      ratioShopiLivraison:      Number(settings.ratioShopiLivraison),
      ratioPartenaireLivraison: Number(settings.ratioPartenaireLivraison),
      ratioAdminLivraison:      Number(settings.ratioAdminLivraison),
    });

    const saved = await this.ruleRepo.save(rule);
    this.logger.log(`[CommissionConfig] Règle initiale créée (id: ${saved.id})`);

    return saved;
  }
}
