/* ============================================================
 * FICHIER : src/modules/paiement/providers/fedapay.provider.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Intégration FedaPay — provider principal pour la Guinée.
 *
 * Supporte :
 *   - Orange Money Guinée
 *   - MTN Mobile Money Guinée
 *   - Wave (en Guinée)
 *
 * ─────────────────────────────────────────────────────────────
 * CONFIGURATION (variables d'environnement)
 * ─────────────────────────────────────────────────────────────
 *
 *   FEDAPAY_API_KEY       → Clé secrète FedaPay (sk_live_... ou sk_test_...)
 *   FEDAPAY_ENV           → 'sandbox' | 'live' (défaut: sandbox)
 *   FEDAPAY_WEBHOOK_SECRET → Secret pour vérification signature webhook
 *
 * ─────────────────────────────────────────────────────────────
 * ACTIVATION
 * ─────────────────────────────────────────────────────────────
 *
 *   PAYMENT_PROVIDER=fedapay dans les variables d'env Render.
 *
 * ─────────────────────────────────────────────────────────────
 * DOCUMENTATION FEDAPAY
 * ─────────────────────────────────────────────────────────────
 *
 *   https://docs.fedapay.com/api/
 *   Base sandbox : https://sandbox-api.fedapay.com/v1
 *   Base live    : https://api.fedapay.com/v1
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/providers/fedapay.provider.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';
import type {
  IPaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookPayload,
  RefundResult,
} from './payment-provider.interface';

/* ─── Correspondance méthode Shopi → customer.type FedaPay ───── */
const FEDAPAY_ACCOUNT_MAP: Partial<Record<MethodePaiementSession, string>> = {
  [MethodePaiementSession.ORANGE_MONEY]: 'mtn-ci',   // Adapter selon la Guinée
  [MethodePaiementSession.MTN_MONEY]:    'mtn-ci',
  [MethodePaiementSession.WAVE]:         'wave-ci',
};

@Injectable()
export class FedaPayProvider implements IPaymentProvider {

  private readonly logger = new Logger(FedaPayProvider.name);

  readonly name = 'fedapay';

  readonly supportedMethods: MethodePaiementSession[] = [
    MethodePaiementSession.ORANGE_MONEY,
    MethodePaiementSession.MTN_MONEY,
    MethodePaiementSession.WAVE,
  ];

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey        = config.get<string>('FEDAPAY_API_KEY') ?? '';
    this.webhookSecret = config.get<string>('FEDAPAY_WEBHOOK_SECRET') ?? '';
    const env          = config.get<string>('FEDAPAY_ENV') ?? 'sandbox';
    this.baseUrl       = env === 'live'
      ? 'https://api.fedapay.com/v1'
      : 'https://sandbox-api.fedapay.com/v1';

    if (!this.apiKey) {
      this.logger.warn('[FedaPay] FEDAPAY_API_KEY non configurée. Les paiements échoueront.');
    }
  }

  /* ── createPayment ──────────────────────────────────────── */

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    /* Construit le corps de la requête FedaPay */
    const body = {
      description: input.description,
      amount:      Math.round(input.montant),
      currency:    { iso: input.devise },
      callback_url: input.returnUrl,
      customer:    {
        firstname: input.clientNom ?? 'Client',
        email:     input.clientEmail ?? '',
        phone_number: input.phonePaiement
          ? { number: input.phonePaiement, country: 'GN' }
          : undefined,
      },
      /* Champ personnalisé pour récupérer notre idempotencyKey dans le webhook */
      metadata: {
        idempotencyKey: input.idempotencyKey,
        commandeNumero: input.commandeNumero,
      },
    };

    const response = await fetch(`${this.baseUrl}/transactions`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur inconnue');
      throw new Error(`[FedaPay] Création transaction échouée: ${response.status} — ${errorText}`);
    }

    const data = await response.json() as {
      v1: {
        transaction: {
          id: number;
          klass: string;
        };
      };
      links: {
        payment_url: string;
      };
    };

    const transactionId = String(data?.v1?.transaction?.id ?? '');
    const redirectUrl   = data?.links?.payment_url ?? null;

    if (!transactionId) {
      throw new Error('[FedaPay] Réponse invalide: transaction ID manquant');
    }

    this.logger.log(`[FedaPay] Transaction créée: ${transactionId} — commande: ${input.commandeNumero}`);

    return {
      providerTransactionId: transactionId,
      redirectUrl,
      ussdCode:              null,
      initialStatus:         'pending',
    };
  }

  /* ── parseWebhook ───────────────────────────────────────── */

  async parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookPayload> {
    /* Vérification de la signature HMAC-SHA256 */
    const signature = headers['x-fedapay-signature'] ?? headers['X-Fedapay-Signature'];
    if (this.webhookSecret && signature) {
      const expected = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (!this.timingSafeCompare(expected, signature)) {
        throw new Error('[FedaPay] Signature webhook invalide — payload ignoré');
      }
    }

    const payload = JSON.parse(rawBody) as {
      name?: string;
      entity?: {
        id?: number;
        amount?: number;
        currency?: { iso?: string };
        status?: string;
        metadata?: { idempotencyKey?: string };
        last_error_code?: string;
      };
    };

    const event      = payload?.name ?? '';
    const entity     = payload?.entity;
    const approved   = event === 'transaction.approved' ||
                       entity?.status === 'approved';
    const transId    = String(entity?.id ?? '');
    const montant    = Number(entity?.amount ?? 0);
    const idKey      = entity?.metadata?.idempotencyKey ?? '';
    const devise     = entity?.currency?.iso ?? 'GNF';
    const erreur     = entity?.last_error_code;

    return {
      providerTransactionId: transId,
      idempotencyKey:        idKey,
      approved,
      montantConfirme:       montant,
      devise,
      ...(erreur ? { erreur } : {}),
      raw: rawBody,
    };
  }

  /* ── refund ─────────────────────────────────────────────── */

  async refund(
    providerTransactionId: string,
    montant: number,
    raison: string,
  ): Promise<RefundResult> {
    this.logger.log(`[FedaPay] Remboursement — tx: ${providerTransactionId} montant: ${montant}`);

    const response = await fetch(`${this.baseUrl}/transactions/${providerTransactionId}/refund`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ reason: raison }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success:          false,
        providerRefundId: null,
        erreur:           `FedaPay refund ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json() as { v1?: { refund?: { id?: number } } };
    return {
      success:          true,
      providerRefundId: String(data?.v1?.refund?.id ?? ''),
    };
  }

  /* ── Helpers privés ─────────────────────────────────────── */

  /**
   * Comparaison de chaînes en temps constant pour éviter
   * les timing attacks lors de la vérification HMAC.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
