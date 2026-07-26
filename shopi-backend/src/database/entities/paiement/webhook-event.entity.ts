/* ============================================================
 * FICHIER : src/database/entities/paiement/webhook-event.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Journal de tous les webhooks entrants reçus des providers
 * de paiement (FedaPay, CinetPay, etc.).
 *
 * POURQUOI CETTE ENTITÉ
 * ─────────────────────────────────────────────────────────────
 * 1. DÉDUPLICATION : chaque webhook a un eventId unique fourni
 *    par le provider. Si le provider ré-envoie le même webhook
 *    (comportement normal selon la spec), on détecte le doublon
 *    grâce à l'index unique sur (provider, eventId).
 *
 * 2. REJEU : en cas de bug dans le traitement, on peut rejouer
 *    un webhook depuis la DB sans attendre le provider.
 *
 * 3. AUDIT : preuve légale de la réception des confirmations
 *    de paiement. En cas de litige avec le provider, on peut
 *    prouver exactement ce qui a été reçu et quand.
 *
 * 4. DIAGNOSTIC : les webhooks FAILED peuvent être analysés
 *    pour corriger les bugs de traitement.
 *
 * FLUX
 * ─────────────────────────────────────────────────────────────
 * 1. POST /paiement/webhook/:provider reçu
 * 2. Signature HMAC-SHA256 vérifiée
 * 3. WebhookEvent créé avec status=RECEIVED
 * 4. Traitement métier (confirmation paiement, etc.)
 * 5. WebhookEvent.status mis à jour → PROCESSED ou FAILED
 *
 * IDEMPOTENCE
 * ─────────────────────────────────────────────────────────────
 * Avant tout traitement, le service vérifie :
 *   SELECT * FROM webhook_events WHERE provider=$1 AND eventId=$2
 *
 * Si PROCESSED → skip (doublon)
 * Si RECEIVED/FAILED → traitement normal ou retry
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule   → créé à chaque appel webhook
 *  AdminModule      → consultation, rejeu manuel
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/webhook-event.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Statut du traitement du webhook.
 *
 * Transitions :
 *   RECEIVED → PROCESSED (traitement réussi)
 *   RECEIVED → FAILED    (erreur de traitement)
 *   FAILED   → PROCESSED (après retry réussi)
 */
export enum WebhookEventStatus {
  /** Reçu et signé, traitement en cours */
  RECEIVED  = 'received',
  /** Traitement métier complété avec succès */
  PROCESSED = 'processed',
  /** Traitement échoué (erreur dans le service) */
  FAILED    = 'failed',
  /** Doublon détecté et ignoré délibérément */
  SKIPPED   = 'skipped',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_webhook_provider', ['provider'])
@Index('IDX_webhook_status', ['status'])
@Index('IDX_webhook_received_at', ['receivedAt'])
@Index('IDX_webhook_session', ['sessionId'])

/**
 * Unicité provider + eventId : garantit qu'un même événement
 * provider n'est traité qu'une seule fois, même si le provider
 * l'envoie plusieurs fois.
 */
@Unique('UQ_webhook_provider_event', ['provider', 'eventId'])

@Entity('webhook_events')
export class WebhookEvent {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * SOURCE
   * ========================================================== */

  /**
   * Identifiant du provider ayant envoyé ce webhook.
   * Correspond à l'enum PaymentProvider (FEDAPAY, CINETPAY, etc.).
   * Partie de la contrainte unique (provider, eventId).
   */
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  /**
   * Identifiant unique de l'événement côté provider.
   * Fourni par le provider dans le payload du webhook.
   * Utilisé pour la déduplication.
   * Ex FedaPay : "evt_01J4XXXXXXXXXX"
   * Ex CinetPay : "cpm_12345678"
   */
  @Column({ type: 'varchar', length: 255 })
  eventId: string;

  /**
   * Type d'événement selon la nomenclature du provider.
   * Ex FedaPay : "transaction.approved", "transaction.declined"
   * Ex CinetPay : "payment.success", "payment.failed"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  eventType: string | null;

  /* ==========================================================
   * LIEN INTERNE
   * ========================================================== */

  /**
   * UUID de la PaiementSession Shopi associée.
   * Résolu depuis le payload du webhook (ex: via transaction.metadata.sessionId).
   * NULL si la résolution a échoué (sessionId non trouvé dans le payload).
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  /* ==========================================================
   * PAYLOAD
   * ========================================================== */

  /**
   * Corps brut du webhook reçu, tel quel (JSON complet).
   * Conservé intégralement pour permettre le rejeu et l'audit.
   * Ne jamais parser ce champ pour des décisions métier sans valider
   * la signature d'abord.
   */
  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  /**
   * Headers HTTP reçus avec le webhook (sélectifs).
   * Inclut : X-FedaPay-Signature, Content-Type, User-Agent.
   * Utile pour vérifier la signature en cas de rejeu.
   */
  @Column({ type: 'json', nullable: true })
  headers: Record<string, string> | null;

  /* ==========================================================
   * VÉRIFICATION
   * ========================================================== */

  /**
   * Signature HMAC-SHA256 extraite du header du webhook.
   * Stockée pour l'audit et le rejeu.
   * NULL si le provider n'envoie pas de signature.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  signature: string | null;

  /**
   * Si la signature a été vérifiée avec succès.
   * Un webhook non signé ou à signature invalide peut quand même
   * être logué (status=FAILED) mais NE DOIT PAS être traité.
   */
  @Column({ type: 'boolean', default: false })
  signatureValid: boolean;

  /* ==========================================================
   * STATUT & TRAITEMENT
   * ========================================================== */

  /** Statut du traitement de ce webhook. */
  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.RECEIVED,
  })
  status: WebhookEventStatus;

  /**
   * Nombre de tentatives de traitement.
   * 1 = premier traitement, 2+ = retries.
   */
  @Column({ type: 'int', default: 1 })
  attempts: number;

  /**
   * Raison de l'échec du traitement.
   * NULL si status != FAILED.
   * Ex : "PaiementSession not found", "HMAC mismatch"
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Stack trace complète de l'erreur (pour le débogage).
   * NULL si pas d'erreur.
   */
  @Column({ type: 'text', nullable: true })
  errorStack: string | null;

  /* ==========================================================
   * RÉSEAU
   * ========================================================== */

  /**
   * Adresse IP source du webhook.
   * Les providers ont des plages IP connues ; une IP hors plage
   * est un signal d'alerte (webhook forgé).
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  sourceIp: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  /**
   * Date exacte de réception du webhook par Shopi.
   * Immuable — sert de référence pour l'audit.
   */
  @CreateDateColumn({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  /** Date du dernier traitement (ou retry). */
  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
