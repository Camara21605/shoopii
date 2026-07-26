/* ============================================================
 * FICHIER : src/modules/resolution-engine/resolution-engine.module.ts
 *
 * RÔLE    : Module NestJS du Resolution Engine.
 *
 * EXPORTS : ResolutionEngine, ResolutionEventBus
 *           (utilisés par AdminModule, PaiementModule, etc.)
 *
 * NOTE PROVIDERS
 * ─────────────────────────────────────────────────────────────
 * InternalProvider, FedaPayProvider et PaymentProviderFactory
 * sont enregistrés directement ici car PaymentProviderFactory
 * n'est pas exporté par PaiementModule ni PaymentEngineModule.
 * EscrowEngineModule est importé pour EscrowEngine.
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ─────────────────────────────────────────────── */
import { Dispute }          from '../../database/entities/paiement/dispute.entity';
import { DisputeEvidence }  from '../../database/entities/paiement/dispute-evidence.entity';
import { DisputeHistory }   from '../../database/entities/paiement/dispute-history.entity';
import { Commande }         from '../../database/entities/commande/commande.entity';
import { Escrow }           from '../../database/entities/paiement/escrow.entity';
import { PaiementSession }  from '../../database/entities/paiement/paiement-session.entity';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog } from '../../database/entities/paiement/financial-audit-log.entity';

/* ── Modules dépendants ──────────────────────────────────── */
import { EscrowEngineModule } from '../escrow-engine/escrow-engine.module';

/* ── Providers de paiement (pour le refund provider-side) ── */
import { InternalProvider }       from '../paiement/providers/internal.provider';
import { FedaPayProvider }        from '../paiement/providers/fedapay.provider';
import { PaymentProviderFactory } from '../paiement/providers/payment-provider.factory';

/* ── Services Resolution Engine ──────────────────────────── */
import { ResolutionEventBus }        from './events/resolution-event-bus.service';
import { DisputeManagerService }     from './services/dispute-manager.service';
import { EvidenceManagerService }    from './services/evidence-manager.service';
import { DecisionManagerService }    from './services/decision-manager.service';
import { RefundManagerService }      from './services/refund-manager.service';
import { ResolutionHistoryService }  from './services/resolution-history.service';
import { ResolutionAuditService }    from './services/resolution-audit.service';
import { ResolutionEngine }          from './resolution.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispute,
      DisputeEvidence,
      DisputeHistory,
      Commande,
      Escrow,
      PaiementSession,
      PlatformSettings,
      FinancialAuditLog,
    ]),
    EscrowEngineModule,
  ],
  providers: [
    /* Providers de paiement pour le refund provider-side */
    InternalProvider,
    FedaPayProvider,
    PaymentProviderFactory,

    /* Services métier */
    ResolutionEventBus,
    ResolutionHistoryService,
    ResolutionAuditService,
    DisputeManagerService,
    EvidenceManagerService,
    DecisionManagerService,
    RefundManagerService,
    ResolutionEngine,
  ],
  exports: [
    ResolutionEngine,
    ResolutionEventBus,
  ],
})
export class ResolutionEngineModule {}
