/* ============================================================
 * FICHIER : src/database/entities/messaging/conversation.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Table centrale du système de messagerie Shopi.
 *
 * Représente une conversation PRIVÉE entre DEUX acteurs.
 *
 * Fonctionne comme le chat de :
 *
 *    - WhatsApp  (1:1, lecture, archivage)
 *    - Instagram (DM entre acteurs)
 *    - LinkedIn  (message entre professionnels)
 *
 * Chaque ligne représente :
 *
 *    "UNE conversation entre DEUX acteurs"
 *
 * ------------------------------------------------------------
 * EXEMPLES
 * ------------------------------------------------------------
 *
 * CLIENT A      ↔ ENTREPRISE B
 * LIVREUR X     ↔ ENTREPRISE Y
 * CORRESPONDANT ↔ CLIENT Z
 *
 * ------------------------------------------------------------
 * ARCHITECTURE POLYMORPHIQUE
 * ------------------------------------------------------------
 *
 * On utilise :
 *
 *    initiatorType + initiatorId
 *    recipientType + recipientId
 *
 * au lieu de relations TypeORM polymorphiques complexes.
 *
 * Pourquoi ?
 *
 * TypeORM ne gère pas nativement les relations polymorphiques
 * multi-entités. Les profils seront récupérés dans les SERVICES.
 *
 * ------------------------------------------------------------
 * NORMALISATION DE LA PAIRE
 * ------------------------------------------------------------
 *
 * Pour garantir l'unicité A↔B, le MessagerieService normalise
 * la paire AVANT insertion en triant alphabétiquement :
 *
 *    const key = (t: string, id: string) => `${t}:${id}`;
 *    const [a, b] = [key(typeA, idA), key(typeB, idB)].sort();
 *    initiatorType = a.split(':')[0];
 *    initiatorId   = a.split(':')[1];
 *    recipientType = b.split(':')[0];
 *    recipientId   = b.split(':')[1];
 *
 * Cela garantit qu'il n'existe qu'UNE SEULE ligne pour A↔B.
 *
 * ------------------------------------------------------------
 * DÉNORMALISATION (performance de lecture)
 * ------------------------------------------------------------
 *
 * Ces champs sont dénormalisés pour éviter des requêtes lourdes
 * lors de l'affichage de la liste des conversations :
 *
 *    lastMessagePreview    → aperçu du dernier message
 *    lastMessageAt         → tri par activité récente
 *    unreadCountInitiator  → badge de non-lus côté A
 *    unreadCountRecipient  → badge de non-lus côté B
 *
 * Mis à jour par MessagerieService.sendMessage().
 *
 * ------------------------------------------------------------
 * LIEN AVEC LE FOLLOW SYSTEM
 * ------------------------------------------------------------
 *
 * followVerified
 *   → true si au moins un acteur suivait l'autre dans follows
 *     au moment de l'ouverture de la conversation.
 *
 * mutualFollow
 *   → true si les deux acteurs se suivent mutuellement.
 *
 * Les règles de permission (qui peut écrire à qui selon le
 * follow) sont déléguées à la table conversation_permissions.
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 *  Conversation ──(OneToMany)──► Message
 *    → Une conversation contient plusieurs messages
 *    → eager: false — chargé à la demande (pagination)
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 * INDEX UNIQUE :
 *
 *    (initiatorType, initiatorId, recipientType, recipientId)
 *    → empêche deux conversations entre les mêmes acteurs
 *
 * INDEX COMPOSITES :
 *
 *    IDX_conv_initiator → (initiatorType, initiatorId)
 *    IDX_conv_recipient → (recipientType, recipientId)
 *    IDX_conv_updated   → updatedAt DESC (tri activité)
 *
 * ------------------------------------------------------------
 * ⚠️  CORRECTION TYPEORM CRITIQUE
 * ------------------------------------------------------------
 *
 * Chaque @Column avec type: 'enum' DOIT passer la propriété
 * enum: TheEnum. Sans cela TypeORM lève au démarrage :
 *
 *   TypeORMError: Column "xxx" of Entity "Conversation"
 *   is defined as enum, but missing "enum" or "enumName".
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, CreateDateColumn, UpdateDateColumn,
  Index, Unique,
} from 'typeorm';
import { Message } from './message.entity';

// ─── ENUMS ────────────────────────────────────────────────────

/**
 * Types d'acteurs pouvant participer à une conversation.
 *
 * Aligné sur FollowerActorType + TargetActorType du follow system.
 * Tous les acteurs peuvent être des deux côtés d'une conversation.
 */
export enum ConversationActorType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
  PARTNER       = 'partner',
}

/**
 * Statut d'une conversation.
 *
 * ACTIVE  → conversation normale et accessible par les deux acteurs
 * BLOCKED → un acteur a été bloqué (détecté via follow_blocks)
 * FLAGGED → signalée pour modération (un acteur a appuyé "Signaler")
 */
export enum ConversationStatus {
  ACTIVE  = 'active',
  BLOCKED = 'blocked',
  FLAGGED = 'flagged',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Unique('UQ_conversation_pair', [
  'initiatorType',
  'initiatorId',
  'recipientType',
  'recipientId',
])
@Index('IDX_conv_initiator', ['initiatorType', 'initiatorId'])
@Index('IDX_conv_recipient', ['recipientType', 'recipientId'])
@Index('IDX_conv_updated',   ['updatedAt'])
@Entity('conversations')
export class Conversation {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * INITIATEUR  (acteur A — normalisé alphabétiquement)
   * ========================================================== */

  /**
   * Type de l'acteur initiateur.
   *
   * Déterminé après normalisation alphabétique de la paire
   * par le MessagerieService AVANT l'insertion en BDD.
   *
   * ✅ FIX : enum: ConversationActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: ConversationActorType,
  })
  initiatorType: ConversationActorType;

  /**
   * UUID du profil initiateur.
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
  @Column({ type: 'varchar', length: 36 })
  initiatorId: string;

  /* ==========================================================
   * RECEVEUR  (acteur B — normalisé alphabétiquement)
   * ========================================================== */

  /**
   * Type de l'acteur receveur.
   *
   * ✅ FIX : enum: ConversationActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: ConversationActorType,
  })
  recipientType: ConversationActorType;

  /**
   * UUID du profil receveur.
   * Résolu dans les SERVICES selon recipientType.
   */
  @Column({ type: 'varchar', length: 36 })
  recipientId: string;

  /* ==========================================================
   * STATUT
   * ========================================================== */

  /**
   * Statut courant de la conversation.
   *
   * Mis à jour automatiquement par le MessagerieService
   * lors de la détection d'un blocage (follow_blocks).
   *
   * ✅ FIX : enum: ConversationStatus passé explicitement.
   */
  @Index()
  @Column({
    type:    'enum',
    enum:    ConversationStatus,
    default: ConversationStatus.ACTIVE,
  })
  status: ConversationStatus;

  /* ==========================================================
   * LIEN AVEC LE FOLLOW SYSTEM
   * ========================================================== */

  /**
   * true si au moins un des deux acteurs suivait l'autre
   * dans la table follows au moment de l'ouverture.
   *
   * Stocké comme métadonnée pour les stats et la confiance.
   * Affiche un badge "Abonné vérifié" dans le chat.
   */
  @Column({ type: 'boolean', default: false })
  followVerified: boolean;

  /**
   * true si les deux acteurs se suivent mutuellement.
   *
   * A suit B ET B suit A dans la table follows.
   * Mis à jour en temps réel par le MessagerieService.
   */
  @Column({ type: 'boolean', default: false })
  mutualFollow: boolean;

  /* ==========================================================
   * DERNIER MESSAGE  (dénormalisé — performance)
   * ========================================================== */

  /**
   * Aperçu du dernier message, tronqué à 100 caractères.
   *
   * Permet d'afficher la liste des conversations sans charger
   * tous les messages (même comportement que WhatsApp).
   *
   * Mis à jour par MessagerieService.sendMessage().
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  lastMessagePreview: string | null;

  /**
   * Date du dernier message envoyé.
   *
   * Utilisé pour trier la liste des conversations :
   *   ORDER BY lastMessageAt DESC
   */
  @Index()
  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  /**
   * UUID du dernier message.
   *
   * Permet d'afficher l'icône lu/non-lu sans requête
   * supplémentaire sur la table messages.
   */
  @Column({ type: 'varchar', length: 36, nullable: true })
  lastMessageId: string | null;

  /* ==========================================================
   * SUIVI DES LECTURES PAR ACTEUR
   * ========================================================== */

  /**
   * Dernière fois que l'INITIATEUR a lu cette conversation.
   *
   * Un message est "non lu" pour l'initiateur si :
   *   message.createdAt > lastReadAtInitiator
   *
   * Mis à jour par MessagerieService.markAsRead().
   */
  @Column({ type: 'timestamp', nullable: true })
  lastReadAtInitiator: Date | null;

  /**
   * Dernière fois que le RECEVEUR a lu cette conversation.
   * Même logique que lastReadAtInitiator.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastReadAtRecipient: Date | null;

  /* ==========================================================
   * COMPTEURS NON LUS  (dénormalisés — performance)
   * ========================================================== */

  /**
   * Nombre de messages non lus pour l'INITIATEUR.
   *
   * Incrémenté quand le RECEVEUR envoie un message.
   * Remis à 0 quand l'INITIATEUR ouvre la conversation.
   *
   * Affiché comme badge rouge dans la liste (comme WhatsApp).
   */
  @Column({ type: 'int', default: 0 })
  unreadCountInitiator: number;

  /**
   * Nombre de messages non lus pour le RECEVEUR.
   *
   * Incrémenté quand l'INITIATEUR envoie un message.
   * Remis à 0 quand le RECEVEUR ouvre la conversation.
   */
  @Column({ type: 'int', default: 0 })
  unreadCountRecipient: number;

  /* ==========================================================
   * USER IDS DÉNORMALISÉS (accès rapide Gateway / Presence)
   * ========================================================== */

  /**
   * UUID JWT (users.id) de l'initiateur.
   * Dénormalisé pour que le gateway puisse vérifier l'accès
   * en O(1) sans résoudre le profil polymorphique.
   * Peuplé par getOrCreateConversation().
   */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  initiatorUserId: string | null;

  /**
   * UUID JWT (users.id) du receveur.
   * Même objectif que initiatorUserId.
   */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  recipientUserId: string | null;

  /* ==========================================================
   * ARCHIVAGE PAR ACTEUR  (soft delete individuel)
   * ========================================================== */

  /**
   * true → l'INITIATEUR a archivé cette conversation.
   *
   * La conversation reste visible pour le RECEVEUR.
   * Elle réapparaît pour l'initiateur si un nouveau message
   * est envoyé (logique gérée par le MessagerieService).
   */
  @Column({ type: 'boolean', default: false })
  archivedByInitiator: boolean;

  /**
   * true → le RECEVEUR a archivé cette conversation.
   * Même comportement que archivedByInitiator.
   */
  @Column({ type: 'boolean', default: false })
  archivedByRecipient: boolean;

  /* ==========================================================
   * STATISTIQUES
   * ========================================================== */

  /**
   * Nombre total de messages dans cette conversation.
   *
   * Dénormalisé pour éviter un COUNT(*) sur la table messages
   * à chaque affichage du détail de la conversation.
   *
   * Incrémenté par MessagerieService.sendMessage().
   */
  @Column({ type: 'int', default: 0 })
  messagesCount: number;

  /* ==========================================================
   * RELATION MESSAGES
   * ========================================================== */

  /**
   * Messages de cette conversation.
   *
   * eager: false → chargé à la demande avec pagination.
   *
   * Usage : MessagerieService.getMessages(conversationId, page)
   */
  @OneToMany(() => Message, msg => msg.conversation, {
    cascade: false,
    eager:   false,
  })
  messages: Message[];

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Mis à jour automatiquement par TypeORM à chaque modification.
   *
   * Utilisé pour le tri par activité récente (alternative
   * à lastMessageAt en cas de désynchronisation).
   */
  @UpdateDateColumn()
  updatedAt: Date;
}