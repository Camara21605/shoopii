/* ============================================================
 * FICHIER : src/modules/paiement/providers/payment-provider.interface.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Contrat abstrait que doit respecter chaque provider de paiement
 * intégré dans Shopi (FedaPay, CinetPay, PayDunya, Wave, etc.).
 *
 * ─────────────────────────────────────────────────────────────
 * PATTERN : Strategy
 * ─────────────────────────────────────────────────────────────
 * Chaque provider implémente cette interface.
 * La Factory résout le bon provider à l'exécution selon
 * la méthode de paiement choisie par le client.
 * Les services métier n'ont connaissance que de cette interface.
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/providers/payment-provider.interface.ts
 * ============================================================ */

import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';

/* ============================================================
 * DTOs internes au provider
 * ============================================================ */

/**
 * Données nécessaires pour initier un paiement chez le provider.
 */
export interface CreatePaymentInput {
  /** Clé d'idempotence générée par notre système (UUID v4) */
  idempotencyKey: string;

  /** Montant en GNF */
  montant: number;

  /** Devise ISO 4217 */
  devise: string;

  /** Numéro de téléphone mobile du client (pour push/USSD) */
  phonePaiement?: string;

  /** Méthode de paiement choisie par le client */
  methode: MethodePaiementSession;

  /** Description affichée sur la page/notification du provider */
  description: string;

  /** Numéro de commande lisible */
  commandeNumero: string;

  /**
   * URL vers laquelle le provider redirige le client après paiement.
   * Doit pointer vers une page du frontend Shopi.
   */
  returnUrl: string;

  /**
   * URL que le provider appelle en POST pour confirmer le paiement.
   * = notre endpoint webhook.
   */
  webhookUrl: string;

  /** Nom du client (pour l'affichage sur la page provider) */
  clientNom?: string;

  /** Email du client */
  clientEmail?: string;
}

/**
 * Réponse de l'initiation de paiement.
 */
export interface CreatePaymentResult {
  /** Identifiant unique de la transaction côté provider */
  providerTransactionId: string;

  /**
   * URL vers laquelle rediriger le client.
   * NULL si le paiement se fait en push/USSD sans redirection web.
   */
  redirectUrl: string | null;

  /**
   * Code USSD à composer (Orange Money sans web).
   * NULL si le paiement se fait via redirection web.
   */
  ussdCode: string | null;

  /** Statut initial retourné par le provider */
  initialStatus: 'pending' | 'initiated';
}

/**
 * Payload analysé d'un webhook provider.
 * Normalisé depuis le format brut de chaque provider.
 */
export interface WebhookPayload {
  /** Identifiant de transaction côté provider */
  providerTransactionId: string;

  /** Clé d'idempotence que nous avions envoyée */
  idempotencyKey: string;

  /** Paiement approuvé */
  approved: boolean;

  /** Montant confirmé par le provider (validation anti-fraude) */
  montantConfirme: number;

  /** Devise */
  devise: string;

  /** Message d'erreur si not approved */
  erreur?: string;

  /** Payload brut original (pour stockage audit) */
  raw: string;
}

/**
 * Résultat d'un remboursement initié via le provider.
 */
export interface RefundResult {
  /** L'opération de remboursement a réussi */
  success: boolean;

  /** Identifiant du remboursement côté provider */
  providerRefundId: string | null;

  /** Message d'erreur si success = false */
  erreur?: string;
}

/* ============================================================
 * INTERFACE PRINCIPAL
 * ============================================================ */

/**
 * Contrat que tout provider de paiement DOIT implémenter.
 * Chaque méthode doit être totalement stateless.
 */
export interface IPaymentProvider {

  /**
   * Nom unique du provider.
   * Doit correspondre à PaiementProvider enum.
   * Ex: 'fedapay', 'internal', 'cinetpay'
   */
  readonly name: string;

  /**
   * Méthodes de paiement supportées par ce provider.
   * Utilisé par la Factory pour router vers le bon provider.
   */
  readonly supportedMethods: MethodePaiementSession[];

  /**
   * Initie une transaction de paiement.
   *
   * @throws Error si la communication avec le provider échoue.
   * @returns Données nécessaires pour rediriger le client.
   */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Vérifie et parse un payload de webhook entrant.
   *
   * Cette méthode :
   *   1. Valide la signature HMAC du payload
   *   2. Extrait les données utiles
   *   3. Retourne un objet normalisé
   *
   * @param rawBody  Corps brut de la requête HTTP (Buffer/string)
   * @param headers  En-têtes HTTP de la requête
   * @throws Error si la signature est invalide
   */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookPayload>;

  /**
   * Initie un remboursement pour une transaction confirmée.
   *
   * @param providerTransactionId ID de la transaction à rembourser
   * @param montant               Montant à rembourser (partiel possible)
   * @param raison                Raison du remboursement
   */
  refund(
    providerTransactionId: string,
    montant: number,
    raison: string,
  ): Promise<RefundResult>;
}
