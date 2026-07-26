/* ============================================================
 * FICHIER : src/modules/paiement/services/paiement-webhook.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Façade légère vers PaymentEngine.
 * Toute la logique métier est dans PaymentWebhookProcessorService
 * (payment-engine module) qui intègre EscrowEngine.
 *
 * POURQUOI UNE FAÇADE
 * ─────────────────────────────────────────────────────────────
 * PaiementController et PaiementInitiationService existants
 * dépendent de PaiementWebhookService. Plutôt que de casser
 * ces dépendances, on délègue vers PaymentEngine.
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/services/paiement-webhook.service.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { PaymentEngine } from '../../payment-engine/payment.engine';

@Injectable()
export class PaiementWebhookService {

  private readonly logger = new Logger(PaiementWebhookService.name);

  constructor(
    private readonly paymentEngine: PaymentEngine,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POST /paiement/webhook/:provider
   ════════════════════════════════════════════════════════ */

  async handleWebhook(
    providerName: string,
    rawBody:      string,
    headers:      Record<string, string>,
  ): Promise<{ received: boolean }> {
    return this.paymentEngine.traiterWebhook(providerName, rawBody, headers);
  }

  /* ════════════════════════════════════════════════════════
   * CONFIRMATION DIRECTE (mode interne / tests)
   ════════════════════════════════════════════════════════ */

  async confirmerPaiement(
    sessionId:             string,
    providerTransactionId: string,
    montantConfirme:       number,
    idempotencyKey:        string,
    webhookRawBody?:       string,
  ): Promise<void> {
    return this.paymentEngine.confirmerPaiement(
      sessionId,
      providerTransactionId,
      montantConfirme,
      idempotencyKey,
      'internal',
      webhookRawBody,
    );
  }
}
