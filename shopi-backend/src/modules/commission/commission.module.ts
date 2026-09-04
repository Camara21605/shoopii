/* ============================================================
 * FICHIER : src/modules/commission/commission.module.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Module NestJS autonome pour le moteur de commissions Shopi.
 *
 * Ce module est INDÉPENDANT de PaiementModule.
 * Il est IMPORTÉ par PaiementModule, AdminModule, etc.
 *
 * EXPORTS
 * ─────────────────────────────────────────────────────────────
 *  CommissionEngine          — point d'entrée unique pour les calculs
 *  CommissionConfigService   — pour les modules admin (modification des taux)
 *  CommissionHistoryService  — pour les tableaux de bord
 *
 * ENTITÉS UTILISÉES (en lecture et écriture)
 * ─────────────────────────────────────────────────────────────
 *  CommissionRule        → versionnage des taux
 *  PlatformSettings      → source de vérité des taux actuels
 *  PaiementDistribution  → vérification doublon + historique
 *  FinancialAuditLog     → traces d'audit
 *  Company               → plan et hiérarchie de l'entreprise
 *  Delivery              → hiérarchie du livreur
 *  Correspondent         → hiérarchie du correspondant
 *  Partner               → résolution partenaire → userId
 *  Admin                 → résolution admin → userId
 *  User                  → résolution super_admin (wallet Shopi)
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/commission/commission.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ─────────────────────────────────────────────── */
import { CommissionRule }       from '../../database/entities/paiement/commission-rule.entity';
import { PlatformSettings }     from '../../database/entities/platform-settings.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';
import { Company }              from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../database/entities/profiles/correspondant-profile.entity';
import { Partner }              from '../../database/entities/profiles/partenaire-profile.entity';
import { Admin }                from '../../database/entities/profiles/admin-profile.entity';
import { User }                 from '../../database/entities/user.entity';
import { CompanySetting }       from '../company-settings/company-settings.entity';
import { PartnerSetting }       from '../partner-settings/partner-settings.entity';

/* ── Services ────────────────────────────────────────────── */
import { CommissionConfigService }      from './services/commission-config.service';
import { CommissionValidatorService }   from './services/commission-validator.service';
import { CommissionHierarchyService }   from './services/commission-hierarchy.service';
import { CommissionCalculatorService }  from './services/commission-calculator.service';
import { CommissionDistributorService } from './services/commission-distributor.service';
import { CommissionHistoryService }     from './services/commission-history.service';
import { CommissionAuditService }       from './services/commission-audit.service';
import { CommissionEventBus }           from './events/commission-event-bus.service';

/* ── Orchestrateur ───────────────────────────────────────── */
import { CommissionEngine } from './commission.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommissionRule,
      PlatformSettings,
      PaiementDistribution,
      FinancialAuditLog,
      Company,
      Delivery,
      Correspondent,
      Partner,
      Admin,
      User,
      CompanySetting,
      PartnerSetting,
    ]),
  ],

  providers: [
    CommissionEventBus,
    CommissionConfigService,
    CommissionValidatorService,
    CommissionHierarchyService,
    CommissionCalculatorService,
    CommissionDistributorService,
    CommissionHistoryService,
    CommissionAuditService,
    CommissionEngine,
  ],

  exports: [
    CommissionEngine,
    CommissionConfigService,
    CommissionHistoryService,

    /* Exporté pour les aperçus de revenu net avant paiement — voir
     * resoudreCommissionProduit() dans commission-calculator.service.ts */
    CommissionCalculatorService,
  ],
})
export class CommissionModule {}
