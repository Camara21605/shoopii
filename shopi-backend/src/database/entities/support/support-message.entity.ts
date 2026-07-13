/* ============================================================
 * FICHIER  : src/database/entities/support/support-message.entity.ts
 * ROLE     : Message individuel dans la conversation d'un ticket de support.
 *
 * RESPONSABILITES :
 *   - Stocke le contenu texte d'un message (user, agent ou système).
 *   - Référence les pièces jointes via la relation OneToMany → Attachment.
 *   - Distingue les notes internes (isInternal) invisibles côté client.
 *   - Soft delete : un message supprimé reste visible comme "[message supprimé]"
 *     pour préserver la cohérence de la conversation.
 *
 * DEPENDANCES :
 *   - SupportTicket (ManyToOne — CASCADE delete)
 *   - Attachment    (OneToMany — les fichiers uploadés pour ce message)
 *
 * INDEXES :
 *   - ticketId   → récupérer tous les messages d'un ticket
 *   - createdAt  → tri chronologique optimisé
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { Attachment } from './attachment.entity';

/* ── Type d'expéditeur du message ──────────────────────────── */
export enum SupportSenderType {
  USER   = 'user',   // client / entreprise / livreur ...
  AGENT  = 'agent',  // agent support ou admin
  SYSTEM = 'system', // message automatique (ouverture, résolution, CSAT ...)
}

@Entity('support_messages')
export class SupportMessage {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Ticket parent ───────────────────────────────────────── */

  @ManyToOne(() => SupportTicket, t => t.messages, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'ticketId' })
  ticket!: SupportTicket;

  @Index()
  @Column({ type: 'uuid' })
  ticketId!: string;

  /* ── Contenu ─────────────────────────────────────────────── */

  /* Texte du message. Quand deletedAt est défini, le service
   * renvoie "[message supprimé]" au lieu du contenu réel. */
  @Column({ type: 'text' })
  content!: string;

  /* ── Expéditeur ──────────────────────────────────────────── */

  @Column({ type: 'enum', enum: SupportSenderType })
  senderType!: SupportSenderType;

  /* userId de l'expéditeur.
   * Pour les messages SYSTEM : UUID fixe 'system' (non null). */
  @Column({ type: 'uuid' })
  senderId!: string;

  @Column({ type: 'varchar', length: 255 })
  senderName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  senderAvatar!: string | null;

  /* ── Pièces jointes ──────────────────────────────────────── */

  /* Relation vers l'entité Attachment — approche enterprise-grade.
   * eager: false → chargé explicitement dans les requêtes qui en ont besoin. */
  @OneToMany(() => Attachment, a => a.message, { cascade: false, eager: false })
  attachments!: Attachment[];

  /* ── Options du message ──────────────────────────────────── */

  /* Note interne : visible uniquement par les agents support.
   * Jamais incluse dans les réponses API client. */
  @Column({ type: 'boolean', default: false })
  isInternal!: boolean;

  /* Marqué true quand l'utilisateur (ou l'agent) a vu ce message.
   * Utilisé pour décrémenter unreadByUser / unreadByAgent sur le ticket. */
  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  /* ── Timestamps ───────────────────────────────────────────── */

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  /* Permet de tracer les éditions de messages agent (correction de fautes).
   * Non exposé côté client dans la v1 — réservé à l'audit interne. */
  @UpdateDateColumn()
  updatedAt!: Date;

  /* Soft delete — le message reste en base mais son contenu est masqué.
   * Preserves la cohérence de la timeline de conversation. */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
