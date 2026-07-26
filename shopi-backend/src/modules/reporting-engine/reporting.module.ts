/* ============================================================
 * FICHIER      : src/modules/reporting-engine/reporting.module.ts
 * MODULE       : ReportingEngine
 * ROLE         : Module NestJS autonome du moteur de reporting financier
 * RESPONSABILITES :
 *   - Déclarer et exporter ReportingEngine (point d'entrée public)
 *   - Enregistrer tous les services spécialisés
 *   - Charger les entités via TypeOrmModule.forFeature (pas de circular imports)
 * DEPENDANCES  :
 *   PaiementSession, PaiementDistribution, Wallet, WalletTransaction,
 *   Retrait, Dispute, FinancialAuditLog
 *   Aucun import d'autres modules moteurs (WalletEngine, CommissionEngine, etc.)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* -- Entités ------------------------------------------------- */
import { PaiementSession }      from '../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { WalletTransaction }    from '../../database/entities/wallet-transaction.entity';
import { Retrait }              from '../../database/entities/paiement/retrait.entity';
import { Dispute }              from '../../database/entities/paiement/dispute.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';

/* -- Orchestrateur ------------------------------------------- */
import { ReportingEngine }        from './reporting.engine';

/* -- Services spécialisés ------------------------------------ */
import { ReportingCacheService }  from './services/reporting-cache.service';
import { KpiEngineService }       from './services/kpi-engine.service';
import { DashboardService }       from './services/dashboard.service';
import { AnalyticsService }       from './services/analytics.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { StatisticsService }      from './services/statistics.service';
import { ExportService }          from './services/export.service';
import { AlertService }           from './services/alert.service';
import { AuditReportService }     from './services/audit-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaiementSession,
      PaiementDistribution,
      Wallet,
      WalletTransaction,
      Retrait,
      Dispute,
      FinancialAuditLog,
    ]),
  ],
  providers: [
    /* Cache partagé — instancié en premier */
    ReportingCacheService,

    /* Services métier — ordre d'instanciation respectant les dépendances */
    KpiEngineService,
    AnalyticsService,
    AlertService,
    DashboardService,
    ReportGeneratorService,
    StatisticsService,
    ExportService,
    AuditReportService,

    /* Orchestrateur public */
    ReportingEngine,
  ],
  exports: [
    ReportingEngine,
  ],
})
export class ReportingModule {}
