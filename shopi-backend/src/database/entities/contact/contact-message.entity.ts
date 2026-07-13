/* ============================================================
 * FICHIER  : src/database/entities/contact/contact-message.entity.ts
 * ROLE     : Message reçu depuis le formulaire de contact public Shopi.
 *
 * RESPONSABILITES :
 *   - Stocke les messages envoyés via /contact (visiteurs et utilisateurs).
 *   - Gère l'anti-spam par hash SHA-256 de l'IP (conforme RGPD).
 *   - Permet l'escalade vers un ticket support via supportTicketId.
 *   - updatedAt reflète la date de dernière action (lecture, escalade, archivage).
 *
 * DEPENDANCES :
 *   - Aucune entité liée (FK intentionnellement absente — contact public)
 *   - SupportTicket référencé par UUID sans contrainte FK
 *
 * INDEXES :
 *   - email      → retrouver les messages d'un même expéditeur
 *   - createdAt  → tri par ordre d'arrivée dans la console admin
 *   - status     → file d'attente NEW / READ / REPLIED / ARCHIVED
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/* ── Catégorie du message — détermine la priorité de traitement ── */
export enum ContactMessageType {
  GENERAL     = 'general',     // question générale / aide
  BILLING     = 'billing',     // facturation, abonnement, remboursement
  SECURITY    = 'security',    // signalement de fraude, piratage
  PARTNERSHIP = 'partnership', // demandes de partenariat commercial
  PRESS       = 'press',       // médias, relations presse
  OTHER       = 'other',       // ne rentre dans aucune catégorie
}

/* ── Cycle de vie du message contact ─────────────────────────── */
export enum ContactMessageStatus {
  NEW      = 'new',      // reçu, pas encore lu
  READ     = 'read',     // ouvert par un agent
  REPLIED  = 'replied',  // réponse envoyée par email ou escalade ticket
  ARCHIVED = 'archived', // clôturé, conservé pour l'historique
}

@Entity('contact_messages')
export class ContactMessage {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Expéditeur ──────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /* Email stocké en clair — nécessaire pour répondre.
   * Indexé pour retrouver l'historique d'un expéditeur. */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /* ── Contenu du message ──────────────────────────────────── */

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'enum', enum: ContactMessageType, default: ContactMessageType.GENERAL })
  type!: ContactMessageType;

  /* ── Lien avec l'utilisateur authentifié ─────────────────── */

  /* userId null = message envoyé par un visiteur non authentifié.
   * Pas de FK contrainte — un utilisateur supprimé garde son message. */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /* ── Statut de traitement ────────────────────────────────── */

  @Index()
  @Column({ type: 'enum', enum: ContactMessageStatus, default: ContactMessageStatus.NEW })
  status!: ContactMessageStatus;

  /* UUID du ticket support créé lors de l'escalade.
   * Null = pas encore escaladé.
   * Rempli par ContactEscalationService.escalate(). */
  @Column({ type: 'uuid', nullable: true })
  supportTicketId!: string | null;

  /* ── Anti-spam / RGPD ────────────────────────────────────── */

  /* Hash SHA-256 de l'adresse IP de l'expéditeur.
   * Permet le rate limiting et la détection de spam
   * sans stocker l'IP en clair (conforme RGPD article 25). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ipHash!: string | null;

  /* ── Timestamps ───────────────────────────────────────────── */

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  /* Mis à jour lors de chaque changement de statut (READ, REPLIED, ARCHIVED)
   * ou lors de l'escalade vers un ticket support.
   * Permet de trier les messages par "dernière activité". */
  @UpdateDateColumn()
  updatedAt!: Date;
}
