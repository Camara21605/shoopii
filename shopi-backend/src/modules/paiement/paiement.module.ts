/* ============================================================
 * FICHIER : src/modules/paiement/paiement.module.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Module NestJS qui encapsule tout le système de paiement Shopi.
 *
 * ─────────────────────────────────────────────────────────────
 * DÉPENDANCES EXPORTÉES
 * ─────────────────────────────────────────────────────────────
 *
 *  PaiementDistributionService — utilisé par :
 *    • CommandeModule (trigger à DELIVERED)
 *    • JobsModule (trigger à AUTO_DELIVERED)
 *
 * ─────────────────────────────────────────────────────────────
 * ENTITÉS GÉRÉES
 * ─────────────────────────────────────────────────────────────
 *
 *  PaiementSession          → table paiement_sessions
 *  PaiementDistribution     → table paiement_distributions
 *  + entités connexes réutilisées depuis d'autres modules
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/paiement.module.ts
 * ============================================================ */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

/* ── Entités existantes ──────────────────────────────────── */
import { PaiementSession }      from '../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { Commande }             from '../../database/entities/commande/commande.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { WalletTransaction }    from '../../database/entities/wallet-transaction.entity';
import { PlatformSettings }     from '../../database/entities/platform-settings.entity';
import { Company }              from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../database/entities/profiles/correspondant-profile.entity';
import { User }                 from '../../database/entities/user.entity';

/* ── Nouvelles entités financières ──────────────────────── */
import { CommissionRule }       from '../../database/entities/paiement/commission-rule.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';
import { Dispute }              from '../../database/entities/paiement/dispute.entity';
import { DisputeEvidence }      from '../../database/entities/paiement/dispute-evidence.entity';
import { Retrait }              from '../../database/entities/paiement/retrait.entity';
import { SettlementBatch }      from '../../database/entities/paiement/settlement-batch.entity';
import { WebhookEvent }         from '../../database/entities/paiement/webhook-event.entity';

/* ── Modules importés ────────────────────────────────────── */
import { AuthModule }          from '../auth/auth.module';
import { WalletModule }        from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommissionModule }    from '../commission/commission.module';
import { PaymentEngineModule } from '../payment-engine/payment-engine.module';

/* ── Providers ────────────────────────────────────────────── */
import { InternalProvider }             from './providers/internal.provider';
import { FedaPayProvider }              from './providers/fedapay.provider';
import { PaymentProviderFactory }       from './providers/payment-provider.factory';
import { PaiementInitiationService }    from './services/paiement-initiation.service';
import { PaiementWebhookService }       from './services/paiement-webhook.service';
import { PaiementDistributionService }  from './services/paiement-distribution.service';

/* ── Controller ────────────────────────────────────────────── */
import { PaiementController } from './paiement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      /* Existants */
      PaiementSession,
      PaiementDistribution,
      Commande,
      Wallet,
      WalletTransaction,
      PlatformSettings,
      Company,
      Delivery,
      Correspondent,
      User,

      /* Nouvelles entités financières Phase 3 */
      CommissionRule,
      FinancialAuditLog,
      Dispute,
      DisputeEvidence,
      Retrait,
      SettlementBatch,
      WebhookEvent,
    ]),
    AuthModule,
    WalletModule,
    NotificationsModule,
    CommissionModule,

    /* PaymentEngine — logique financière upgradée avec EscrowEngine */
    PaymentEngineModule,
  ],

  controllers: [PaiementController],

  providers: [
    /* Providers de paiement (gardés pour compatibilité PaiementInitiationService) */
    InternalProvider,
    FedaPayProvider,
    PaymentProviderFactory,

    /* Services métier */
    PaiementInitiationService,
    PaiementWebhookService,
    PaiementDistributionService,
  ],

  exports: [
    /* Exporté pour CommandeModule et JobsModule */
    PaiementDistributionService,
    PaiementWebhookService,
  ],
})
export class PaiementModule {}
