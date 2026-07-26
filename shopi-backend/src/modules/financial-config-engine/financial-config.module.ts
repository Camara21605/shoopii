/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/financial-config.module.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Module NestJS du Financial Configuration Engine.
 *                Centre de pilotage de toutes les règles financières
 *                configurables de la plateforme Shopi.
 * AUTONOMIE    :
 *   Ce module est totalement indépendant des autres moteurs financiers.
 *   Il peut être importé sans risque de dépendance circulaire.
 * EXPORTS      :
 *   FinancialConfigEngine        — orchestrateur (API principale)
 *   FinancialConfigReaderService — lecture config avec cache
 *   FinancialConfigEventBus      — abonnement aux événements de config
 * ENTITÉS UTILISÉES :
 *   PlatformSettings      → source de vérité des paramètres
 *   ConfigurationSnapshot → historique versionné
 *   CommissionRule        → nouvelle règle créée lors de changement commission
 *   FinancialAuditLog     → trace d'audit légale
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ─────────────────────────────────────────────── */
import { PlatformSettings }      from '../../database/entities/platform-settings.entity';
import { ConfigurationSnapshot } from '../../database/entities/paiement/configuration-snapshot.entity';
import { CommissionRule }        from '../../database/entities/paiement/commission-rule.entity';
import { FinancialAuditLog }     from '../../database/entities/paiement/financial-audit-log.entity';

/* ── Événements ─────────────────────────────────────────── */
import { FinancialConfigEventBus } from './events/financial-config-event-bus.service';

/* ── Services ───────────────────────────────────────────── */
import { FinancialConfigCacheService }     from './services/financial-config-cache.service';
import { FinancialConfigReaderService }    from './services/financial-config-reader.service';
import { FinancialConfigValidatorService } from './services/financial-config-validator.service';
import { FinancialConfigWriterService }    from './services/financial-config-writer.service';
import { FinancialConfigHistoryService }   from './services/financial-config-history.service';
import { FinancialConfigAuditService }     from './services/financial-config-audit.service';

/* ── Orchestrateur ───────────────────────────────────────── */
import { FinancialConfigEngine } from './financial-config.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformSettings,
      ConfigurationSnapshot,
      CommissionRule,
      FinancialAuditLog,
    ]),
  ],

  providers: [
    /* Infrastructure */
    FinancialConfigEventBus,
    FinancialConfigCacheService,

    /* Services */
    FinancialConfigReaderService,
    FinancialConfigValidatorService,
    FinancialConfigWriterService,
    FinancialConfigHistoryService,
    FinancialConfigAuditService,

    /* Orchestrateur */
    FinancialConfigEngine,
  ],

  exports: [
    FinancialConfigEngine,
    FinancialConfigReaderService,
    FinancialConfigEventBus,
  ],
})
export class FinancialConfigModule {}
