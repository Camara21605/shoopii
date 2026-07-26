/* ============================================================
 * FICHIER : src/modules/settlement-engine/settlement-engine.module.ts
 *
 * RÔLE    : Module NestJS du Settlement & Payout Engine.
 *
 * EXPORTS : SettlementEngine, SettlementEventBus
 *
 * PROVIDERS DIRECTS :
 *   Les providers de payout sont enregistrés directement ici
 *   (même pattern que ResolutionEngineModule pour PaymentProviderFactory).
 *   WalletEngineModule est importé pour WalletEngine.
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ─────────────────────────────────────────────── */
import { Retrait }          from '../../database/entities/paiement/retrait.entity';
import { SettlementBatch }  from '../../database/entities/paiement/settlement-batch.entity';
import { Wallet }           from '../../database/entities/wallet.entity';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog } from '../../database/entities/paiement/financial-audit-log.entity';
import { Dispute }          from '../../database/entities/paiement/dispute.entity';

/* ── Module WalletEngine (dépendance principale) ─────────── */
import { WalletEngineModule } from '../wallet-engine/wallet-engine.module';

/* ── Providers de payout ────────────────────────────────── */
import { OrangeMoneyPayoutProvider }  from './providers/orange-money-payout.provider';
import { MtnPayoutProvider }          from './providers/mtn-payout.provider';
import { WavePayoutProvider }         from './providers/wave-payout.provider';
import { DjomyPayoutProvider }        from './providers/djomy-payout.provider';
import { BankTransferPayoutProvider } from './providers/bank-transfer-payout.provider';
import { MoovMoneyPayoutProvider }    from './providers/moov-money-payout.provider';
import { PayoutProviderFactory }      from './providers/payout-provider.factory';

/* ── Événements ─────────────────────────────────────────── */
import { SettlementEventBus } from './events/settlement-event-bus.service';

/* ── Services ───────────────────────────────────────────── */
import { EligibilityValidatorService }  from './services/eligibility-validator.service';
import { WithdrawalManagerService }     from './services/withdrawal-manager.service';
import { WithdrawalValidationService }  from './services/withdrawal-validation.service';
import { PayoutManagerService }         from './services/payout-manager.service';
import { SettlementSchedulerService }   from './services/settlement-scheduler.service';
import { SettlementHistoryService }     from './services/settlement-history.service';
import { SettlementAuditService }       from './services/settlement-audit.service';

/* ── Orchestrateur ──────────────────────────────────────── */
import { SettlementEngine } from './settlement.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Retrait,
      SettlementBatch,
      Wallet,
      PlatformSettings,
      FinancialAuditLog,
      Dispute,
    ]),
    WalletEngineModule,
  ],
  providers: [
    /* Providers payout */
    OrangeMoneyPayoutProvider,
    MtnPayoutProvider,
    WavePayoutProvider,
    DjomyPayoutProvider,
    BankTransferPayoutProvider,
    MoovMoneyPayoutProvider,
    PayoutProviderFactory,

    /* Événements */
    SettlementEventBus,

    /* Services */
    EligibilityValidatorService,
    WithdrawalManagerService,
    WithdrawalValidationService,
    PayoutManagerService,
    SettlementSchedulerService,
    SettlementHistoryService,
    SettlementAuditService,

    /* Orchestrateur */
    SettlementEngine,
  ],
  exports: [
    SettlementEngine,
    SettlementEventBus,
  ],
})
export class SettlementEngineModule {}
