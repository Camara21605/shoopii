/* ============================================================
 * FICHIER : src/modules/payment-engine/payment.engine.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Orchestrateur principal du Payment Engine de Shopi.
 * Point d'entrée UNIQUE pour toutes les opérations de paiement.
 *
 * PIPELINE
 * ------------------------------------------------------------
 *  traiterWebhook()      → PaymentWebhookProcessorService.handleWebhook()
 *  confirmerPaiement()   → PaymentWebhookProcessorService.confirmerPaiement()
 *  rembourser()          → PaymentRefundService.rembourser()
 *  activerProvider()     → PaymentProviderConfigService.activer()
 *  desactiverProvider()  → PaymentProviderConfigService.desactiver()
 *  listerSessions()      → PaymentSessionManagerService.lister()
 *  expiresSessions()     → PaymentSessionManagerService.expireSessionsExpirees()
 *
 * DÉLÉGATIONS
 * ------------------------------------------------------------
 * - EscrowEngine   → via PaymentWebhookProcessorService
 * - WalletEngine   → via EscrowEngine
 * - ProviderFactory → via PaymentWebhookProcessorService
 * - PaymentAuditService → fire-and-forget
 *
 * EXPORTS DU MODULE
 * ------------------------------------------------------------
 * PaymentEngine, PaymentEventBus
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  PaiementSession,
} from '../../database/entities/paiement/paiement-session.entity';
import { WebhookEvent } from '../../database/entities/paiement/webhook-event.entity';
import { ProviderConfig } from '../../database/entities/paiement/provider-config.entity';
import { PaiementProvider } from '../../database/entities/paiement/paiement-session.entity';

import { PaymentProviderConfigService }   from './services/payment-provider-config.service';
import { PaymentSessionManagerService }   from './services/payment-session-manager.service';
import { PaymentWebhookProcessorService } from './services/payment-webhook-processor.service';
import { PaymentRefundService }           from './services/payment-refund.service';
import { PaymentAuditService }            from './services/payment-audit.service';
import { PaymentEventBus }                from './events/payment-event-bus.service';

import {
  PaymentRefundContext,
  PaymentRefundResult,
  PaymentSessionFilter,
  PaymentSessionPage,
} from './types/payment-engine.types';

@Injectable()
export class PaymentEngine {

  private readonly logger = new Logger(PaymentEngine.name);

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,

    private readonly providerConfigSvc:  PaymentProviderConfigService,
    private readonly sessionManagerSvc:  PaymentSessionManagerService,
    private readonly webhookProcessorSvc: PaymentWebhookProcessorService,
    private readonly refundSvc:          PaymentRefundService,
    private readonly auditSvc:           PaymentAuditService,
    readonly         eventBus:           PaymentEventBus,
  ) {}

  /* ==========================================================
   * WEBHOOKS
   * ========================================================== */

  /**
   * Point d'entrée principal pour les webhooks provider.
   * Délègue à PaymentWebhookProcessorService.
   */
  async traiterWebhook(
    providerName: string,
    rawBody:      string,
    headers:      Record<string, string>,
    sourceIp?:    string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`[Engine] traiterWebhook() — provider: ${providerName}`);
    return this.webhookProcessorSvc.handleWebhook(providerName, rawBody, headers, sourceIp);
  }

  /**
   * Confirmation directe d'un paiement (ex: mode interne, tests).
   * Idempotente : si déjà CONFIRMED, no-op.
   */
  async confirmerPaiement(
    sessionId:             string,
    providerTransactionId: string,
    montantConfirme:       number,
    idempotencyKey:        string,
    providerName:          string,
    webhookRawBody?:       string,
  ): Promise<void> {
    this.logger.log(`[Engine] confirmerPaiement() — session: ${sessionId}`);
    return this.webhookProcessorSvc.confirmerPaiement(
      sessionId,
      providerTransactionId,
      montantConfirme,
      idempotencyKey,
      providerName,
      webhookRawBody,
    );
  }

  /* ==========================================================
   * REMBOURSEMENTS
   * ========================================================== */

  async rembourser(ctx: PaymentRefundContext): Promise<PaymentRefundResult> {
    this.logger.log(
      `[Engine] rembourser() — session: ${ctx.sessionId} ` +
      `montant: ${ctx.montant ?? 'total'} total: ${ctx.total ?? false}`,
    );
    const result = await this.refundSvc.rembourser(ctx);

    this.auditSvc.logRemboursementConfirme({
      sessionId:        result.sessionId,
      commandeId:       result.commandeId,
      montantRembourse: result.montantRembourse,
      providerRefundId: result.providerRefundId,
    });

    return result;
  }

  /* ==========================================================
   * CONFIGURATION DES PROVIDERS
   * ========================================================== */

  async getProviderConfig(provider: PaiementProvider): Promise<ProviderConfig | null> {
    return this.providerConfigSvc.findByProvider(provider);
  }

  async listerProviderConfigs(): Promise<ProviderConfig[]> {
    return this.providerConfigSvc.findAll();
  }

  async activerProvider(provider: PaiementProvider, adminUserId: string): Promise<ProviderConfig> {
    this.logger.log(`[Engine] activerProvider() — provider: ${provider} admin: ${adminUserId}`);
    return this.providerConfigSvc.activer(provider, adminUserId);
  }

  async desactiverProvider(provider: PaiementProvider, adminUserId: string): Promise<ProviderConfig> {
    this.logger.log(`[Engine] desactiverProvider() — provider: ${provider} admin: ${adminUserId}`);
    return this.providerConfigSvc.desactiver(provider, adminUserId);
  }

  async upsertProviderConfig(
    provider: PaiementProvider,
    data: Partial<Omit<ProviderConfig, 'id' | 'provider' | 'createdAt' | 'updatedAt'>>,
    adminUserId?: string,
  ): Promise<ProviderConfig> {
    return this.providerConfigSvc.upsert(provider, data, adminUserId);
  }

  /* ==========================================================
   * SESSIONS
   * ========================================================== */

  async getSession(sessionId: string): Promise<PaiementSession> {
    return this.sessionManagerSvc.findById(sessionId);
  }

  async getSessionsByCommande(commandeId: string): Promise<PaiementSession[]> {
    return this.sessionManagerSvc.findByCommandeId(commandeId);
  }

  async listerSessions(
    filter: PaymentSessionFilter,
    page  = 1,
    limit = 20,
  ): Promise<PaymentSessionPage> {
    return this.sessionManagerSvc.lister(filter, page, limit);
  }

  /* ==========================================================
   * WEBHOOKS EVENTS (historique)
   * ========================================================== */

  async getWebhookEvents(sessionId: string): Promise<WebhookEvent[]> {
    return this.webhookEventRepo.find({
      where: { sessionId },
      order: { receivedAt: 'DESC' },
    });
  }

  /* ==========================================================
   * SCHEDULER — expirations
   * ========================================================== */

  async expireSessionsExpirees(): Promise<number> {
    return this.sessionManagerSvc.expireSessionsExpirees();
  }
}
