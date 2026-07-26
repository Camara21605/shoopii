/* ============================================================
 * FICHIER : src/modules/payment-engine/payment-engine.module.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Module NestJS autonome du Payment Engine.
 *
 * AUTONOMIE
 * ------------------------------------------------------------
 * Dépend de :
 *   - EscrowEngineModule   → EscrowEngine (pour verrouillerFonds)
 *   - CommissionModule     → CommissionEngine (pour calculer les parts)
 *   - NotificationsModule  → NotificationEventService
 *   - TypeORM (entités)
 *
 * Ne dépend PAS directement de PaiementModule
 * (PaiementModule IMPORTE PaymentEngineModule).
 *
 * EXPORTS
 * ------------------------------------------------------------
 * - PaymentEngine     → utilisé par PaiementModule (webhook / confirmation)
 * - PaymentEventBus   → abonnement aux événements paiement
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EscrowEngineModule }  from '../escrow-engine/escrow-engine.module';
import { CommissionModule }    from '../commission/commission.module';
import { NotificationsModule } from '../notifications/notifications.module';

/* ── Entités ─────────────────────────────────────────────── */
import { PaiementSession }      from '../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { Commande }             from '../../database/entities/commande/commande.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { WebhookEvent }         from '../../database/entities/paiement/webhook-event.entity';
import { ProviderConfig }       from '../../database/entities/paiement/provider-config.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';
import { Escrow }               from '../../database/entities/paiement/escrow.entity';

/* ── Providers existants (de PaiementModule) ─────────────── */
import { InternalProvider }       from '../paiement/providers/internal.provider';
import { FedaPayProvider }        from '../paiement/providers/fedapay.provider';
import { PaymentProviderFactory } from '../paiement/providers/payment-provider.factory';

/* ── Services du Payment Engine ──────────────────────────── */
import { PaymentEventBus }               from './events/payment-event-bus.service';
import { PaymentProviderConfigService }  from './services/payment-provider-config.service';
import { PaymentSessionManagerService }  from './services/payment-session-manager.service';
import { PaymentWebhookProcessorService } from './services/payment-webhook-processor.service';
import { PaymentRefundService }          from './services/payment-refund.service';
import { PaymentAuditService }           from './services/payment-audit.service';
import { PaymentEngine }                 from './payment.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaiementSession,
      PaiementDistribution,
      Commande,
      Wallet,
      WebhookEvent,
      ProviderConfig,
      FinancialAuditLog,
      Escrow,
    ]),

    /* EscrowEngine — pour créer/verrouiller les séquestres */
    EscrowEngineModule,

    /* CommissionEngine — pour calculer la répartition des fonds */
    CommissionModule,

    /* Notifications — pour alerter les acteurs */
    NotificationsModule,
  ],

  providers: [
    /* Providers de paiement (réutilisés depuis PaiementModule) */
    InternalProvider,
    FedaPayProvider,
    PaymentProviderFactory,

    /* Services internes */
    PaymentEventBus,
    PaymentProviderConfigService,
    PaymentSessionManagerService,
    PaymentWebhookProcessorService,
    PaymentRefundService,
    PaymentAuditService,

    /* Orchestrateur principal */
    PaymentEngine,
  ],

  exports: [
    PaymentEngine,
    PaymentEventBus,
    PaymentProviderConfigService,
  ],
})
export class PaymentEngineModule {}
