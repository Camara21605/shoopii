/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-writer.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Écriture des paramètres financiers dans PlatformSettings.
 *                Orchestre : validation → diff → update DB →
 *                snapshot → CommissionRule → cache invalidation → événements.
 * RESPONSABILITES :
 *   - Appliquer les DTO validés sur PlatformSettings
 *   - Construire le diff avant/après pour le snapshot
 *   - Créer le snapshot versionné (ConfigurationSnapshot)
 *   - Créer un nouveau CommissionRule si section = COMMISSION
 *   - Invalider le cache après toute écriture
 *   - Émettre les événements appropriés (fire-and-forget)
 *   - Déclencher l'audit (fire-and-forget via setImmediate)
 * DEPENDANCES  :
 *   PlatformSettings, ConfigurationSnapshot, CommissionRule (TypeORM)
 *   FinancialConfigCacheService
 *   FinancialConfigValidatorService
 *   FinancialConfigEventBus
 *   FinancialConfigAuditService
 * UTILISE PAR  : FinancialConfigEngine (méthode updateConfig)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { ConfigurationSnapshot, ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';
import { CommissionRule } from '../../../database/entities/paiement/commission-rule.entity';

import { FinancialConfigCacheService }     from './financial-config-cache.service';
import { FinancialConfigValidatorService } from './financial-config-validator.service';
import { FinancialConfigAuditService }     from './financial-config-audit.service';
import { FinancialConfigEventBus }         from '../events/financial-config-event-bus.service';

import {
  ConfigErreur,
  ConfigErreurType,
  ConfigUpdateContext,
  ConfigUpdateResult,
  ConfigRollbackContext,
  SECTION_FIELDS,
} from '../types/financial-config.types';

import {
  FINANCIAL_CONFIG_EVENTS,
  ConfigUpdatedEvent,
  CommissionConfigChangedEvent,
  PaymentConfigChangedEvent,
  WalletConfigChangedEvent,
  SettlementConfigChangedEvent,
  ConfigRolledBackEvent,
} from '../events/financial-config.events';

@Injectable()
export class FinancialConfigWriterService {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo:   Repository<PlatformSettings>,
    @InjectRepository(ConfigurationSnapshot)
    private readonly snapshotRepo:   Repository<ConfigurationSnapshot>,
    @InjectRepository(CommissionRule)
    private readonly commissionRepo: Repository<CommissionRule>,
    private readonly cache:          FinancialConfigCacheService,
    private readonly validator:      FinancialConfigValidatorService,
    private readonly audit:          FinancialConfigAuditService,
    private readonly eventBus:       FinancialConfigEventBus,
    private readonly dataSource:     DataSource,
  ) {}

  /* ----------------------------------------------------------
   * applyUpdate()
   *
   * Point d'entrée principal — applique un DTO sur PlatformSettings.
   * Utilise une transaction SQL pour garantir l'atomicité :
   * si l'une des étapes échoue, tout est rollbacké.
   * ---------------------------------------------------------- */
  async applyUpdate(ctx: ConfigUpdateContext): Promise<ConfigUpdateResult> {
    /* 1. Validation de la justification */
    if (!ctx.justification?.trim()) {
      throw new ConfigErreur(
        ConfigErreurType.JUSTIFICATION_REQUISE,
        'Une justification est obligatoire pour toute modification de configuration.',
      );
    }

    /* 2. Chargement des settings actuels */
    const current = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!current) {
      throw new ConfigErreur(ConfigErreurType.SETTINGS_INTROUVABLE, 'PlatformSettings introuvable.');
    }

    /* 3. Validation métier (lève ConfigErreur si invalide) */
    this.validator.validateSection(ctx.section, ctx.data, current);

    /* 4. Construction du diff (ne retenir que les champs qui changent réellement) */
    const allowedFields = SECTION_FIELDS[ctx.section] as string[];
    const before:  Record<string, unknown> = {};
    const after:   Record<string, unknown> = {};
    const changed: string[] = [];

    for (const field of allowedFields) {
      const incoming = (ctx.data as Record<string, unknown>)[field];
      if (incoming === undefined) continue;
      const currentVal = (current as unknown as Record<string, unknown>)[field];
      /* Compare en string car certaines colonnes decimal sont des strings en DB */
      if (String(currentVal) !== String(incoming)) {
        before[field]  = currentVal;
        after[field]   = incoming;
        changed.push(field);
      }
    }

    /* 5. Si aucun champ n'a changé, on le signale */
    if (changed.length === 0) {
      throw new ConfigErreur(
        ConfigErreurType.AUCUN_CHANGEMENT,
        `Aucun changement détecté pour la section ${ctx.section}.`,
        { section: ctx.section },
      );
    }

    /* 6. Transaction : update settings + snapshot + éventuelle CommissionRule */
    const result = await this.dataSource.transaction(async (em) => {

      /* 6a. Appliquer les changements sur PlatformSettings */
      Object.assign(current, after);
      await em.save(PlatformSettings, current);

      /* 6b. Numéro de version suivant pour cette section */
      const lastSnapshot = await em.findOne(ConfigurationSnapshot, {
        where: { section: ctx.section },
        order: { version: 'DESC' },
      });
      const nextVersion = (lastSnapshot?.version ?? 0) + 1;

      /* 6c. Créer le snapshot */
      const snapshot = em.create(ConfigurationSnapshot, {
        section:             ctx.section,
        version:             nextVersion,
        label:               ctx.label ?? null,
        changedFields:       changed,
        before,
        after,
        justification:       ctx.justification,
        performedByUserId:   ctx.performedByUserId,
        performedByRole:     ctx.performedByRole,
        ipAddress:           ctx.ipAddress ?? null,
        isRollback:          false,
        rolledBackToVersion: null,
      });
      await em.save(ConfigurationSnapshot, snapshot);

      /* 6d. Si section COMMISSION → créer un nouveau CommissionRule */
      let newRuleId: string | undefined;
      if (ctx.section === ConfigSection.COMMISSION) {
        await em.update(CommissionRule, { isActive: true }, {
          isActive:      false,
          deactivatedAt: new Date(),
        });

        const maxVersionRule = await em.findOne(CommissionRule, {
          order: { version: 'DESC' },
        });
        const nextRuleVersion = (maxVersionRule?.version ?? 0) + 1;

        const newRule = em.create(CommissionRule, {
          version:                nextRuleVersion,
          label:                  ctx.label ?? null,
          note:                   ctx.justification,
          isActive:               true,
          activatedAt:            new Date(),
          deactivatedAt:          null,
          createdByUserId:        ctx.performedByUserId,
          tauxCommissionProduit:    +(after['tauxCommissionProduit']   ?? current.tauxCommissionProduit),
          planMultiplierStandard:   1.0,
          planMultiplierPro:        +(after['planMultiplierPro']       ?? current.planMultiplierPro),
          planMultiplierPremium:    +(after['planMultiplierPremium']   ?? current.planMultiplierPremium),
          ratioShopiProduit:        +(after['ratioShopiProduit']       ?? current.ratioShopiProduit),
          ratioPartenaireProduit:   +(after['ratioPartenaireProduit']  ?? current.ratioPartenaireProduit),
          ratioAdminProduit:        +(after['ratioAdminProduit']       ?? current.ratioAdminProduit),
          tauxCommissionLivraison:  +(after['tauxCommissionLivraison'] ?? current.tauxCommissionLivraison),
          ratioShopiLivraison:      +(after['ratioShopiLivraison']     ?? current.ratioShopiLivraison),
          ratioPartenaireLivraison: +(after['ratioPartenaireLivraison']?? current.ratioPartenaireLivraison),
          ratioAdminLivraison:      +(after['ratioAdminLivraison']     ?? current.ratioAdminLivraison),
        });
        const savedRule = await em.save(CommissionRule, newRule);
        newRuleId = savedRule.id;
      }

      return {
        snapshot,
        newRuleId,
        nextVersion,
      };
    });

    /* 7. Invalider le cache — garantit que la prochaine lecture recharge depuis DB */
    this.cache.invalidateAll();

    /* 8. Émettre les événements (fire-and-forget, hors transaction) */
    setImmediate(() => {
      const now = new Date();
      const baseEvent = new ConfigUpdatedEvent(
        ctx.section, result.nextVersion, result.snapshot.id,
        changed, ctx.performedByUserId, now,
      );
      this.eventBus.emit(FINANCIAL_CONFIG_EVENTS.CONFIG_UPDATED, baseEvent);

      /* Événements spécifiques par section */
      if (ctx.section === ConfigSection.COMMISSION && result.newRuleId) {
        this.eventBus.emit(
          FINANCIAL_CONFIG_EVENTS.CONFIG_COMMISSION_CHANGED,
          new CommissionConfigChangedEvent(
            result.snapshot.id, result.newRuleId, after,
            ctx.performedByUserId, now,
          ),
        );
      } else if (ctx.section === ConfigSection.PAYMENT) {
        const activeProviders = {
          orangeMoney: Boolean((after['orangeMoneyEnabled'] ?? current.orangeMoneyEnabled)),
          mtnMoney:    Boolean((after['mtnMoneyEnabled']    ?? current.mtnMoneyEnabled)),
          wave:        Boolean((after['waveEnabled']        ?? current.waveEnabled)),
          moovMoney:   Boolean((after['moovMoneyEnabled']   ?? current.moovMoneyEnabled)),
          djomy:       Boolean((after['djomyEnabled']       ?? current.djomyEnabled)),
        };
        this.eventBus.emit(
          FINANCIAL_CONFIG_EVENTS.CONFIG_PAYMENT_CHANGED,
          new PaymentConfigChangedEvent(result.snapshot.id, activeProviders, ctx.performedByUserId, now),
        );
      } else if (ctx.section === ConfigSection.WALLET) {
        this.eventBus.emit(
          FINANCIAL_CONFIG_EVENTS.CONFIG_WALLET_CHANGED,
          new WalletConfigChangedEvent(result.snapshot.id, after, ctx.performedByUserId, now),
        );
      } else if (ctx.section === ConfigSection.SETTLEMENT) {
        this.eventBus.emit(
          FINANCIAL_CONFIG_EVENTS.CONFIG_SETTLEMENT_CHANGED,
          new SettlementConfigChangedEvent(result.snapshot.id, after, ctx.performedByUserId, now),
        );
      }
    });

    /* 9. Audit fire-and-forget */
    setImmediate(() => {
      this.audit.logConfigUpdate({
        section:           ctx.section,
        snapshotId:        result.snapshot.id,
        version:           result.nextVersion,
        changedFields:     changed,
        before,
        after,
        justification:     ctx.justification,
        performedByUserId: ctx.performedByUserId,
        performedByRole:   ctx.performedByRole,
        ipAddress:         ctx.ipAddress ?? null,
      }).catch(() => { /* audit ne doit jamais faire échouer la requête */ });
    });

    return {
      success:              true,
      snapshotId:           result.snapshot.id,
      version:              result.nextVersion,
      section:              ctx.section,
      changedFields:        changed,
      updatedAt:            result.snapshot.createdAt,
      commissionRuleCreated: !!result.newRuleId,
    };
  }

  /* ----------------------------------------------------------
   * applyRollback()
   *
   * Restaure une section à un état antérieur en créant un
   * nouveau snapshot marqué isRollback = true.
   *
   * Le rollback crée une NOUVELLE version (il n'écrase pas
   * l'historique) — l'auditeur peut voir qu'un rollback a eu lieu.
   * ---------------------------------------------------------- */
  async applyRollback(ctx: ConfigRollbackContext): Promise<ConfigUpdateResult> {
    if (!ctx.justification?.trim()) {
      throw new ConfigErreur(
        ConfigErreurType.JUSTIFICATION_REQUISE,
        'Une justification est obligatoire pour le rollback.',
      );
    }

    /* 1. Charger le snapshot cible */
    const targetSnapshot = await this.snapshotRepo.findOne({
      where: { section: ctx.section, version: ctx.targetVersion },
    });
    if (!targetSnapshot) {
      throw new ConfigErreur(
        ConfigErreurType.SNAPSHOT_INTROUVABLE,
        `Snapshot version ${ctx.targetVersion} introuvable pour la section ${ctx.section}.`,
        { section: ctx.section, targetVersion: ctx.targetVersion },
      );
    }

    /* 2. Les valeurs à restaurer = "after" du snapshot cible */
    const rollbackData = targetSnapshot.after;

    /* 3. Appeler applyUpdate avec les valeurs restaurées */
    const result = await this.applyUpdate({
      section:           ctx.section,
      data:              rollbackData as Record<string, unknown>,
      justification:     ctx.justification,
      performedByUserId: ctx.performedByUserId,
      performedByRole:   ctx.performedByRole,
      ipAddress:         ctx.ipAddress,
      label:             `Rollback vers v${ctx.targetVersion}`,
    });

    /* 4. Marquer le nouveau snapshot comme rollback */
    await this.snapshotRepo.update(
      { id: result.snapshotId },
      { isRollback: true, rolledBackToVersion: ctx.targetVersion },
    );

    /* 5. Événement rollback */
    setImmediate(() => {
      this.eventBus.emit(
        FINANCIAL_CONFIG_EVENTS.CONFIG_ROLLED_BACK,
        new ConfigRolledBackEvent(
          ctx.section, ctx.targetVersion, result.version,
          result.snapshotId, ctx.performedByUserId, new Date(),
        ),
      );
    });

    return result;
  }
}
