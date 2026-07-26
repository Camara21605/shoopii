/* ============================================================
 * FICHIER : src/modules/wallet-engine/wallet-engine.module.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Module NestJS autonome du Wallet Engine.
 *
 * AUTONOMIE
 * ------------------------------------------------------------
 * Ce module est totalement indépendant de :
 *   - PaiementModule
 *   - CommandeModule
 *   - CommissionModule
 *   - LivraisonModule
 *
 * Il expose WalletEngine comme seul point d'entrée public.
 * Les autres modules l'importent et injectent WalletEngine.
 *
 * EXPORTS
 * ------------------------------------------------------------
 * - WalletEngine       — orchestrateur (usage PaiementModule, etc.)
 * - WalletHistoryService — lecture des historiques
 * - WalletEventBus     — abonnement aux événements wallet
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ── */
import { Wallet }            from '../../database/entities/wallet.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { WalletLedgerEntry } from '../../database/entities/wallet-ledger-entry.entity';
import { FinancialAuditLog } from '../../database/entities/paiement/financial-audit-log.entity';

/* ── Services ── */
import { WalletEventBus }        from './events/wallet-event-bus.service';
import { WalletValidatorService } from './services/wallet-validator.service';
import { WalletLockService }      from './services/wallet-lock.service';
import { WalletLedgerService }    from './services/wallet-ledger.service';
import { WalletMovementService }  from './services/wallet-movement.service';
import { WalletHistoryService }   from './services/wallet-history.service';
import { WalletAuditService }     from './services/wallet-audit.service';
import { WalletEngine }           from './wallet.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WalletTransaction,
      WalletLedgerEntry,
      FinancialAuditLog,
    ]),
  ],

  providers: [
    WalletEventBus,
    WalletValidatorService,
    WalletLockService,
    WalletLedgerService,
    WalletMovementService,
    WalletHistoryService,
    WalletAuditService,
    WalletEngine,
  ],

  exports: [
    WalletEngine,
    WalletHistoryService,
    WalletEventBus,
  ],
})
export class WalletEngineModule {}
