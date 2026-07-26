/* ============================================================
 * FICHIER : src/modules/paiement/providers/internal.provider.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Provider "interne" Shopi — utilisé en développement et staging.
 *
 * ─────────────────────────────────────────────────────────────
 * COMPORTEMENT
 * ─────────────────────────────────────────────────────────────
 *
 * Ce provider simule un paiement instantané :
 *   → createPayment() retourne un ID fictif + redirectUrl null
 *   → Le webhook est déclenché immédiatement par le service
 *     d'initiation sans passer par un provider externe
 *
 * Il ne fait AUCUN appel HTTP externe.
 * Idéal pour les tests end-to-end et le développement local.
 *
 * ─────────────────────────────────────────────────────────────
 * ACTIVATION
 * ─────────────────────────────────────────────────────────────
 *
 * Variable d'environnement : PAYMENT_PROVIDER=internal
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/providers/internal.provider.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';
import type {
  IPaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookPayload,
  RefundResult,
} from './payment-provider.interface';

@Injectable()
export class InternalProvider implements IPaymentProvider {

  private readonly logger = new Logger(InternalProvider.name);

  /** Identifiant unique du provider */
  readonly name = 'internal';

  /** Toutes les méthodes sont supportées en mode simulation */
  readonly supportedMethods: MethodePaiementSession[] = [
    MethodePaiementSession.ORANGE_MONEY,
    MethodePaiementSession.MTN_MONEY,
    MethodePaiementSession.WAVE,
    MethodePaiementSession.CARTE_VISA,
    MethodePaiementSession.CARTE_MC,
    MethodePaiementSession.VIREMENT,
    MethodePaiementSession.WALLET,
    MethodePaiementSession.CASH,
  ];

  /* ── createPayment ──────────────────────────────────────── */

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.logger.log(
      `[Internal] Paiement simulé — commande: ${input.commandeNumero} ` +
      `montant: ${input.montant} ${input.devise}`,
    );

    /* Génère un ID fictif qui ressemble à un ID provider */
    const providerTransactionId = `INTERNAL_${randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

    return {
      providerTransactionId,
      redirectUrl: null,    // Pas de redirection web en mode interne
      ussdCode:    null,    // Pas de USSD en mode interne
      initialStatus: 'initiated',
    };
  }

  /* ── parseWebhook ───────────────────────────────────────── */

  /**
   * En mode interne, le webhook est construit directement par
   * PaiementInitiationService et ne passe jamais par HTTP.
   * Cette méthode n'est appelée qu'en test unitaire.
   */
  async parseWebhook(rawBody: string, _headers: Record<string, string>): Promise<WebhookPayload> {
    try {
      const parsed = JSON.parse(rawBody) as WebhookPayload;
      return { ...parsed, raw: rawBody };
    } catch {
      throw new Error('[Internal] Webhook payload invalide');
    }
  }

  /* ── refund ─────────────────────────────────────────────── */

  async refund(
    providerTransactionId: string,
    montant: number,
    raison: string,
  ): Promise<RefundResult> {
    this.logger.log(
      `[Internal] Remboursement simulé — tx: ${providerTransactionId} ` +
      `montant: ${montant} raison: "${raison}"`,
    );

    return {
      success:          true,
      providerRefundId: `REFUND_INTERNAL_${randomUUID().replace(/-/g, '').toUpperCase().slice(0, 12)}`,
    };
  }
}
