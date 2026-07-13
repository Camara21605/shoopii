/* ============================================================
 * FICHIER  : src/database/entities/support/support-ticket.entity.ts
 * ROLE     : Entité principale des tickets de support Shopi.
 *
 * RESPONSABILITES :
 *   - Représente un ticket de support créé par un utilisateur.
 *   - Gère le cycle de vie : OPEN → IN_PROGRESS → WAITING_USER
 *     → RESOLVED → CLOSED.
 *   - Stocke les métriques SLA (first response, breach, resolution).
 *   - Conserve le score de satisfaction client (CSAT 1–5).
 *   - Soft delete : les tickets ne sont JAMAIS supprimés définitivement.
 *     Un ticket est une pièce d'audit légale.
 *
 * DEPENDANCES :
 *   - SupportMessage (OneToMany, cascade)
 *
 * INDEXES :
 *   - reference (unique)          → lookup par référence humaine SUP-YYYY-NNNNN
 *   - userId (simple)             → liste des tickets d'un utilisateur
 *   - status (simple)             → file d'attente agente par statut
 *   - (userId, status) composite  → requête optimisée : tickets ouverts d'un user
 *   - slaBreachedAt (partial)     → détection rapide des violations SLA
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  OneToMany, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { SupportMessage } from './support-message.entity';

/**
 * Canal de support — identifie quelle "surface produit" a créé le ticket.
 *
 * Distinct du rôle utilisateur (userRole) qui représente la permission JWT :
 * un admin peut ouvrir un ticket INTERNAL, un livreur ouvre un ticket DELIVERY.
 *
 * Ce champ permet de router, filtrer et appliquer des SLA différenciés
 * par audience sans modifier l'architecture du service support.
 * Extensible : ajouter un canal ne requiert aucune migration destructive.
 */
export enum SupportChannel {
  CLIENT    = 'client',     // Acheteurs finaux, e-commerce
  COMPANY   = 'company',    // Vendeurs / entreprises
  PARTNER   = 'partner',    // Partenaires commerciaux
  DELIVERY  = 'delivery',   // Livreurs
  INTERNAL  = 'internal',   // Tickets agents ↔ agents
  ANONYMOUS = 'anonymous',  // Formulaire contact (non authentifié)
}

/* ── Types de tickets — quels problèmes l'utilisateur rencontre ─── */
export enum SupportTicketType {
  BILLING        = 'billing',        // facturation, remboursements
  ACCOUNT        = 'account',        // compte, accès, vérification
  ORDER_PLATFORM = 'order_platform', // commandes passées sur la plateforme
  FRAUD          = 'fraud',          // signalement de fraude ou abus
  TECHNICAL      = 'technical',      // bugs, problèmes techniques
  GENERAL        = 'general',        // demandes générales
  FEEDBACK       = 'feedback',       // suggestions d'amélioration
}

/* ── Cycle de vie du ticket ────────────────────────────────────── */
export enum SupportTicketStatus {
  OPEN          = 'open',           // nouveau, pas encore traité
  IN_PROGRESS   = 'in_progress',    // agent en cours de traitement
  WAITING_USER  = 'waiting_user',   // agent a répondu, attend l'utilisateur
  RESOLVED      = 'resolved',       // problème résolu
  CLOSED        = 'closed',         // fermé sans résolution ou après CSAT
}

/* ── Priorité du ticket ─────────────────────────────────────────── */
export enum SupportTicketPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  HIGH   = 'high',
  URGENT = 'urgent',
}

@Entity('support_tickets')
/* Index composite : tous les tickets ouverts d'un utilisateur —
 * couvre la requête la plus fréquente côté client. */
@Index('IDX_ticket_user_status', ['userId', 'status'])
/* Index SLA breach : filtre rapide pour le cron SLA et le dashboard. */
@Index('IDX_ticket_sla_breach', ['slaBreachedAt'])
export class SupportTicket {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* Référence lisible par les humains, générée à la création.
   * Format : SUP-YYYY-NNNNN (ex: SUP-2026-00042)
   * Unique et indexée — utilisée dans les emails, la recherche,
   * les références croisées avec les commandes. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 25 })
  reference!: string;

  /* ── Auteur du ticket ─────────────────────────────────────── */

  /* userId peut être null pour un ticket créé depuis un formulaire de contact
   * (visiteur non authentifié escaladé vers un ticket). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /* Rôle JWT au moment de la création — conservé pour l'historique
   * même si le rôle de l'utilisateur change ultérieurement. */
  @Column({ type: 'varchar', length: 30 })
  userRole!: string;

  /* ── Canal de support ────────────────────────────────────── */

  /**
   * Surface produit qui a généré le ticket.
   * DEFAULT 'client' assure la rétrocompatibilité avec tous les tickets
   * existants créés avant l'introduction de ce champ.
   * Utilisé pour le routage, les SLA différenciés et les tableaux de bord
   * par audience (futur : Support Entreprise, Support Livreur…).
   */
  @Column({ type: 'enum', enum: SupportChannel, default: SupportChannel.CLIENT })
  channel!: SupportChannel;

  /* ── Contenu du ticket ────────────────────────────────────── */

  @Column({ type: 'enum', enum: SupportTicketType, default: SupportTicketType.GENERAL })
  type!: SupportTicketType;

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  /* Premier message conservé dénormalisé pour affichage rapide
   * dans les listes sans charger tous les messages. */
  @Column({ type: 'text' })
  firstMessage!: string;

  /* ── Statut et priorité ───────────────────────────────────── */

  @Index()
  @Column({ type: 'enum', enum: SupportTicketStatus, default: SupportTicketStatus.OPEN })
  status!: SupportTicketStatus;

  @Column({ type: 'enum', enum: SupportTicketPriority, default: SupportTicketPriority.NORMAL })
  priority!: SupportTicketPriority;

  /* ── Assignation agent ────────────────────────────────────── */

  /* UUID de l'agent support assigné (userId admin).
   * Null = ticket non assigné, en file d'attente commune. */
  @Column({ type: 'uuid', nullable: true })
  agentId!: string | null;

  /* ── Liens avec d'autres entités ─────────────────────────── */

  /* Commande liée au problème signalé — optionnel.
   * Permet de contextualiser rapidement la demande. */
  @Column({ type: 'uuid', nullable: true })
  relatedOrderId!: string | null;

  /* ── Compteurs dénormalisés ───────────────────────────────── */

  /* Nombre total de messages dans la conversation du ticket.
   * Incrémenté à chaque reply pour éviter un COUNT(*) en liste. */
  @Column({ type: 'int', default: 1 })
  messageCount!: number;

  /* Messages non lus par l'utilisateur (réponses agent).
   * Remis à 0 quand l'utilisateur ouvre le ticket. */
  @Column({ type: 'int', default: 0 })
  unreadByUser!: number;

  /* Messages non lus par les agents (réponses utilisateur).
   * Remis à 0 quand un agent ouvre le ticket. */
  @Column({ type: 'int', default: 1 })
  unreadByAgent!: number;

  /* ── Métriques SLA ────────────────────────────────────────── */

  /* Date de la première réponse d'un agent (non-interne).
   * Null = pas encore répondu.
   * Utilisée pour calculer le délai moyen de première réponse. */
  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt!: Date | null;

  /* Date à laquelle le SLA a été officiellement dépassé.
   * Rempli par SupportSlaCronService.
   * Null = SLA respecté (ou ticket fermé avant violation). */
  @Column({ type: 'timestamp', nullable: true })
  slaBreachedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  /* ── Satisfaction client (CSAT) ───────────────────────────── */

  /* Score de 1 à 5, soumis uniquement quand le ticket est
   * RESOLVED ou CLOSED. Null = pas encore évalué. */
  @Column({ type: 'smallint', nullable: true })
  satisfactionScore!: number | null;

  /* ── Audit de suppression ─────────────────────────────────── */

  /* UUID de l'agent qui a supprimé le ticket (soft delete).
   * Permet de tracer qui a supprimé quoi et pourquoi. */
  @Column({ type: 'uuid', nullable: true })
  deletedBy!: string | null;

  /* ── Relations ────────────────────────────────────────────── */

  @OneToMany(() => SupportMessage, m => m.ticket, { cascade: true, eager: false })
  messages!: SupportMessage[];

  /* ── Timestamps ───────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /* Soft delete — ne jamais supprimer définitivement un ticket.
   * TypeORM filtre automatiquement les tickets supprimés dans
   * tous les find/findOne/createQueryBuilder. */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
