/* ============================================================
 * FICHIER : src/modules/escrow-engine/escrow-engine.module.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Module NestJS autonome de l'Escrow Engine.
 *
 * AUTONOMIE
 * ------------------------------------------------------------
 * Dépend de :
 *   - WalletEngineModule (pour WalletEngine)
 *   - TypeORM (entités directes)
 *
 * Ne dépend PAS de :
 *   - PaiementModule (pas d'import)
 *   - CommandeModule (accès direct via TypeORM)
 *   - CommissionModule (commissions déjà calculées dans distributions)
 *
 * EXPORTS
 * ------------------------------------------------------------
 * - EscrowEngine        — orchestrateur (usage PaiementModule, CommandeModule)
 * - EscrowHistoryService — lecture seule
 * - EscrowEventBus      — abonnement aux événements escrow
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WalletEngineModule } from '../wallet-engine/wallet-engine.module';

/* ── Entités ── */
import { Escrow }               from '../../database/entities/paiement/escrow.entity';
import { EscrowHistory }        from '../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { PlatformSettings }     from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';

/* ── Services ── */
import { EscrowEventBus }        from './events/escrow-event-bus.service';
import { EscrowValidatorService } from './services/escrow-validator.service';
import { EscrowManagerService }   from './services/escrow-manager.service';
import { EscrowReleaseService }   from './services/escrow-release.service';
import { EscrowRefundService }    from './services/escrow-refund.service';
import { EscrowHistoryService }   from './services/escrow-history.service';
import { EscrowAuditService }     from './services/escrow-audit.service';
import { EscrowEngine }           from './escrow.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Escrow,
      EscrowHistory,
      PaiementDistribution,
      Wallet,
      PlatformSettings,
      FinancialAuditLog,
    ]),

    /* WalletEngine — nécessaire pour tous les mouvements financiers */
    WalletEngineModule,
  ],

  providers: [
    EscrowEventBus,
    EscrowValidatorService,
    EscrowManagerService,
    EscrowReleaseService,
    EscrowRefundService,
    EscrowHistoryService,
    EscrowAuditService,
    EscrowEngine,
  ],

  exports: [
    EscrowEngine,
    EscrowHistoryService,
    EscrowEventBus,
  ],
})
export class EscrowEngineModule {}
