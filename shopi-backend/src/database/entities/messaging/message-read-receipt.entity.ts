/* ============================================================
 * FICHIER : src/database/entities/messaging/message-read-receipt.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Accusés de réception et de lecture des messages Shopi.
 *
 * Permet un tracking GRANULAIRE message par message de qui
 * a reçu et lu quoi, et à quel moment.
 *
 * Fonctionne comme les "vus" de WhatsApp ou Instagram DM :
 *
 *    ✓  envoyé
 *    ✓✓ livré
 *    ✓✓ (bleu) lu
 *
 * ------------------------------------------------------------
 * POURQUOI CETTE TABLE EN PLUS DE message.status ?
 * ------------------------------------------------------------
 *
 * message.status → statut global simplifié (SENT/READ)
 *
 * Cette table → tracking PRÉCIS par acteur :
 *
 *    - Afficher qui a vu un message et quand
 *    - Audit complet des lectures
 *    - Analytics : taux de lecture, délai moyen de réponse
 *    - Préparation aux conversations de GROUPE (v2)
 *      → chaque membre a son propre receipt
 *
 * ⚠️  Cette table est OPTIONNELLE pour une v1.
 *     Si le volume est faible, message.status suffit.
 *     Activer si besoin d'analytics ou de groupes.
 *
 * ------------------------------------------------------------
 * EXEMPLES
 * ------------------------------------------------------------
 *
 * CLIENT A envoie un message à ENTREPRISE B :
 *   → receipt 1 : readerId = entrepriseB.id
 *                 deliveredAt = "14:32:01"
 *                 readAt      = "14:32:15"
 *
 * ENTREPRISE B répond :
 *   → receipt 2 : readerId = clientA.id
 *                 deliveredAt = "14:32:16"
 *                 readAt      = null  (pas encore lu)
 *
 * ------------------------------------------------------------
 * RÈGLES MÉTIER
 * ------------------------------------------------------------
 *
 *  - Contrainte UNIQUE sur (messageId, readerId)
 *    → un acteur ne peut avoir qu'UN receipt par message
 *
 *  - deliveredAt = quand le push/socket est arrivé sur l'appareil
 *  - readAt      = quand l'acteur a ouvert et vu le message
 *
 *  - L'expéditeur n'a PAS de receipt pour son propre message
 *    (seul le/les destinataires ont un receipt)
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 *  MessageReadReceipt ──(ManyToOne)──► Message
 *    → Un receipt appartient à un seul message
 *    → onDelete CASCADE : supprimé avec le message
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  UNIQUE :
 *    (messageId, readerId) → un seul receipt par acteur par message
 *
 *  IDX_receipt_message → messageId
 *    → tous les receipts d'un message (qui a lu ?)
 *
 *  IDX_receipt_reader  → (readerType, readerId)
 *    → tous les messages lus par un acteur
 *
 * ------------------------------------------------------------
 * ⚠️  CORRECTION TYPEORM CRITIQUE
 * ------------------------------------------------------------
 *
 * readerType utilise MessageActorType importé depuis
 * message.entity.ts (source unique de vérité).
 *
 * ✅ FIX : enum: MessageActorType passé explicitement dans
 * le décorateur @Column pour éviter l'erreur TypeORM au boot.
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
  Index, Unique,
} from 'typeorm';
import { Message, MessageActorType } from './message.entity';

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Unique('UQ_receipt_message_reader', ['messageId', 'readerId'])
@Index('IDX_receipt_message', ['messageId'])
@Index('IDX_receipt_reader',  ['readerType', 'readerId'])
@Entity('message_read_receipts')
export class MessageReadReceipt {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * MESSAGE CONCERNÉ
   * ========================================================== */

  /**
   * Message auquel cet accusé de réception est rattaché.
   *
   * onDelete CASCADE :
   *   si le message est supprimé, ses receipts le sont aussi.
   */
  @ManyToOne(() => Message, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column({ name: 'messageId', type: 'uuid' })
  messageId: string;

  /* ==========================================================
   * LECTEUR  (acteur qui a reçu et lu le message)
   * ========================================================== */

  /**
   * Type de l'acteur qui a lu le message.
   *
   * Importé depuis message.entity pour éviter les imports
   * circulaires TypeORM.
   *
   * ✅ FIX : enum: MessageActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: MessageActorType,
  })
  readerType: MessageActorType;

  /**
   * UUID du profil lecteur.
   *
   * Pointe dynamiquement vers la table du type :
   *   client        → clients.id
   *   company       → companies.id
   *   delivery      → deliveries.id
   *   correspondent → correspondants.id
   *   partner       → partners.id
   *
   * Pas de FK TypeORM — résolu dans les SERVICES.
   */
  @Column({ type: 'uuid' })
  readerId: string;

  /* ==========================================================
   * TIMESTAMPS DE LIVRAISON ET LECTURE
   * ========================================================== */

  /**
   * Quand le message a été livré sur l'appareil du lecteur.
   *
   * Renseigné quand :
   *   - La connexion WebSocket de l'acteur était active
   *   - OU la notification push a été confirmée reçue
   *
   * null = acteur hors-ligne au moment de l'envoi.
   *
   * Mis à jour par MessagerieGateway (event 'message_delivered').
   */
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  /**
   * Quand le lecteur a effectivement lu le message.
   *
   * Renseigné quand l'acteur ouvre la conversation et que
   * le message est visible à l'écran.
   *
   * null = message non lu.
   *
   * Mis à jour par MessagerieService.markAsRead() qui reçoit
   * l'event 'mark_read' du MessagerieGateway.
   */
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  /* ==========================================================
   * TIMESTAMP DE CRÉATION
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;
}