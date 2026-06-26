/* ============================================================
 * FICHIER : src/database/entities/messaging/message.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Un message individuel dans une conversation Shopi.
 *
 * Chaque ligne représente :
 *
 *    "UN message envoyé par UN acteur dans UNE conversation"
 *
 * ------------------------------------------------------------
 * TYPES DE CONTENU SUPPORTÉS
 * ------------------------------------------------------------
 *
 *  TEXT     → texte simple (markdown basique)
 *  IMAGE    → photo uploadée sur Cloudinary
 *  VIDEO    → vidéo uploadée sur Cloudinary
 *  AUDIO    → message vocal (enregistrement)
 *  FILE     → document PDF / Excel / Word
 *  PRODUCT  → carte produit partagée (lien vers fiche produit)
 *  ORDER    → carte commande partagée (résumé de commande)
 *  LOCATION → coordonnées GPS partagées (comme WhatsApp)
 *  SYSTEM   → message automatique généré par le backend
 *             Ex: "Conversation ouverte", "Livraison démarrée"
 *
 * ------------------------------------------------------------
 * EXEMPLES D'UTILISATION
 * ------------------------------------------------------------
 *
 * Une ENTREPRISE partage un produit à un CLIENT :
 *   contentType = PRODUCT
 *   productId   = "uuid-du-produit"
 *   content     = "iPhone 15 Pro — 12 500 000 GNF" (snapshot)
 *
 * Un LIVREUR partage sa position GPS :
 *   contentType = LOCATION
 *   latitude    = 9.5370
 *   longitude   = -13.6773
 *   locationLabel = "Quartier Almamya, Kaloum"
 *
 * Un CLIENT envoie un message vocal :
 *   contentType   = AUDIO
 *   mediaUrl      = "https://res.cloudinary.com/..."
 *   mediaDuration = 12  (secondes)
 *
 * ------------------------------------------------------------
 * RÈGLES MÉTIER
 * ------------------------------------------------------------
 *
 *  1. senderType + senderId identifient l'expéditeur.
 *     Le sender DOIT être initiatorId OU recipientId de la
 *     conversation parente — vérifié côté SERVICE.
 *
 *  2. Réponse à un message (threads) :
 *     replyToId → UUID d'un autre message de la même conv.
 *     Résolu dans le service pour afficher la citation.
 *
 *  3. Suppression douce (RGPD) :
 *     @DeleteDateColumn deletedAt → le contenu est effacé
 *     mais la ligne reste en base.
 *     Le frontend affiche "Ce message a été supprimé".
 *
 *  4. Modification :
 *     isEdited + editedAt → traçabilité
 *     originalContent → contenu AVANT modification (audit)
 *
 *  5. Réactions emoji :
 *     JSON simple { "❤️": ["clientId1"], "👍": ["companyId2"] }
 *     À migrer vers une table message_reactions si fort volume.
 *
 * ------------------------------------------------------------
 * ARCHITECTURE DE L'EXPÉDITEUR (polymorphique)
 * ------------------------------------------------------------
 *
 * On utilise senderType + senderId (même approche que follows).
 *
 * MessageActorType est défini LOCALEMENT dans ce fichier
 * (et non importé depuis conversation.entity) pour éviter
 * les dépendances circulaires TypeORM.
 *
 * Les valeurs sont IDENTIQUES à ConversationActorType.
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 *  Message ──(ManyToOne)──► Conversation
 *    → Un message appartient à une seule conversation
 *    → onDelete CASCADE : si la conv est supprimée, messages aussi
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  IDX_msg_conversation_date → (conversationId, createdAt)
 *    → pagination des messages d'une conversation
 *
 *  IDX_msg_sender → (senderType, senderId)
 *    → tous les messages envoyés par un acteur
 *
 *  IDX sur productId et orderId
 *    → retrouver tous les partages d'un produit/commande
 *
 * ------------------------------------------------------------
 * ⚠️  CORRECTION TYPEORM CRITIQUE
 * ------------------------------------------------------------
 *
 * Chaque @Column avec type: 'enum' DOIT passer la propriété
 * enum: TheEnum. Sans cela TypeORM lève au démarrage :
 *
 *   TypeORMError: Column "senderType" of Entity "Message"
 *   is defined as enum, but missing "enum" or "enumName".
 *
 * MessageActorType est re-déclaré LOCALEMENT pour casser
 * la dépendance circulaire avec conversation.entity.ts.
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
  Index, DeleteDateColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

// ─── ENUMS ────────────────────────────────────────────────────

/**
 * Types d'acteurs pouvant envoyer des messages.
 *
 * ⚠️ Re-déclaré localement (copie de ConversationActorType)
 * pour éviter la dépendance circulaire TypeORM entre
 * message.entity.ts ↔ conversation.entity.ts.
 *
 * Valeurs SYNCHRONISÉES avec ConversationActorType.
 */
export enum MessageActorType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
  PARTNER       = 'partner',
}

/**
 * Types de contenu d'un message.
 *
 * TEXT     → texte libre
 * IMAGE    → image Cloudinary
 * VIDEO    → vidéo Cloudinary
 * AUDIO    → message vocal Cloudinary
 * FILE     → document (PDF, Excel…)
 * PRODUCT  → carte produit partagée (productId requis)
 * ORDER    → carte commande partagée (orderId requis)
 * LOCATION → localisation GPS (latitude + longitude requis)
 * SYSTEM   → message automatique backend (non envoyé par un acteur)
 */
export enum MessageContentType {
  TEXT     = 'text',
  IMAGE    = 'image',
  VIDEO    = 'video',
  AUDIO    = 'audio',
  FILE     = 'file',
  PRODUCT  = 'product',
  ORDER    = 'order',
  LOCATION = 'location',
  SYSTEM   = 'system',
  /**
   * CALL — événement d'appel audio.
   * Le champ `content` contient un JSON :
   * { status: 'completed'|'missed'|'rejected'|'cancelled'|'busy',
   *   direction: 'outgoing'|'incoming', duration: number }
   * Aucun média associé. Affiché comme ligne spéciale dans le chat.
   */
  CALL     = 'call',
}

/**
 * Statut de livraison d'un message.
 *
 * SENT      → enregistré en base, en attente de livraison
 * DELIVERED → livré sur l'appareil (push/socket reçu)
 * READ      → lu par le destinataire (conversation ouverte)
 * FAILED    → échec d'envoi (réseau, push désactivé…)
 */
export enum MessageStatus {
  SENT      = 'sent',
  DELIVERED = 'delivered',
  READ      = 'read',
  FAILED    = 'failed',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Index('IDX_msg_conversation_date', ['conversationId', 'createdAt'])
@Index('IDX_msg_sender',            ['senderType', 'senderId'])
@Entity('messages')
export class Message {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * CONVERSATION PARENTE
   * ========================================================== */

  /**
   * Conversation à laquelle ce message appartient.
   *
   * onDelete CASCADE :
   *   si la conversation est supprimée, ses messages le sont aussi.
   */
  @ManyToOne(() => Conversation, conv => conv.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Index()
  @Column({ name: 'conversationId', type: 'uuid' })
  conversationId: string;

  /* ==========================================================
   * EXPÉDITEUR  (polymorphique)
   * ========================================================== */

  /**
   * Type de l'acteur qui envoie le message.
   *
   * DOIT correspondre à initiatorType OU recipientType
   * de la conversation parente. Vérifié côté SERVICE.
   *
   * ✅ FIX : enum: MessageActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: MessageActorType,
  })
  senderType: MessageActorType;

  /**
   * UUID du profil expéditeur.
   *
   * Pointe dynamiquement selon senderType :
   *   client        → clients.id
   *   company       → companies.id
   *   delivery      → deliveries.id
   *   correspondent → correspondants.id
   *   partner       → partners.id
   *
   * Pas de FK TypeORM — résolu dans les SERVICES.
   */
  @Column({ type: 'uuid' })
  senderId: string;

  /* ==========================================================
   * CONTENU DU MESSAGE
   * ========================================================== */

  /**
   * Type de contenu.
   *
   * ✅ FIX : enum: MessageContentType passé explicitement.
   */
  @Column({
    type:    'enum',
    enum:    MessageContentType,
    default: MessageContentType.TEXT,
  })
  contentType: MessageContentType;

  /**
   * Corps du message selon le type :
   *
   *   TEXT     → texte du message (markdown basique supporté)
   *   PRODUCT  → nom du produit (snapshot pour affichage rapide)
   *   ORDER    → résumé de la commande
   *   SYSTEM   → texte du message automatique
   *
   * null pour les médias purs (IMAGE, VIDEO, AUDIO, FILE).
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /* ==========================================================
   * MÉDIAS  (IMAGE · VIDEO · AUDIO · FILE)
   * ========================================================== */

  /** URL Cloudinary du fichier média uploadé */
  @Column({ type: 'varchar', length: 500, nullable: true })
  mediaUrl: string | null;

  /** Nom original du fichier (affiché pour les FILE) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  mediaName: string | null;

  /** Taille du fichier en octets */
  @Column({ type: 'bigint', nullable: true })
  mediaSize: number | null;

  /** Type MIME (ex: image/jpeg, audio/mpeg, application/pdf) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  mediaMimeType: string | null;

  /** Durée en secondes (AUDIO et VIDEO uniquement) */
  @Column({ type: 'int', nullable: true })
  mediaDuration: number | null;

  /* ==========================================================
   * CARTE PRODUIT PARTAGÉE  (contentType = PRODUCT)
   * ========================================================== */

  /**
   * UUID du produit partagé dans le message.
   *
   * Pas de FK TypeORM pour éviter les dépendances circulaires.
   * Résolu dans le service pour charger la miniature produit.
   *
   * Ex: une boutique partage un produit à un client qui hésite.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  /* ==========================================================
   * CARTE COMMANDE PARTAGÉE  (contentType = ORDER)
   * ========================================================== */

  /**
   * UUID de la commande partagée dans le message.
   *
   * Ex: un livreur partage le détail d'une commande au client.
   * Pas de FK TypeORM — résolu dans le service.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  /* ==========================================================
   * LOCALISATION PARTAGÉE  (contentType = LOCATION)
   * ========================================================== */

  /** Latitude GPS (ex: 9.5370 pour Conakry) */
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  /** Longitude GPS (ex: -13.6773 pour Conakry) */
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  /**
   * Adresse lisible associée à la localisation.
   * Ex: "Quartier Almamya, Kaloum, Conakry"
   * Générée par geocoding ou saisie manuellement.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  locationLabel: string | null;

  /* ==========================================================
   * RÉPONSE À UN MESSAGE  (threads)
   * ========================================================== */

  /**
   * UUID du message auquel celui-ci répond.
   *
   * Pas de FK TypeORM pour la simplicité et les performances.
   * Résolu dans le service pour afficher la citation.
   *
   * Ex: le client cite le message produit de la boutique.
   */
  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  /* ==========================================================
   * STATUT DE LIVRAISON
   * ========================================================== */

  /**
   * Statut de livraison du message.
   *
   * Mis à jour par le MessagerieGateway (WebSocket) :
   *   → DELIVERED quand le push/socket est reçu
   *   → READ quand le destinataire ouvre la conversation
   *
   * ✅ FIX : enum: MessageStatus passé explicitement.
   */
  @Column({
    type:    'enum',
    enum:    MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  /**
   * Timestamp quand le destinataire a lu le message.
   * null = non lu.
   *
   * Mis à jour par MessagerieService.markAsRead().
   */
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  /* ==========================================================
   * MODIFICATION DU MESSAGE
   * ========================================================== */

  /**
   * true si le message a été modifié après envoi.
   * Affiché comme "(modifié)" dans le frontend.
   */
  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  /** Date de la dernière modification */
  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date | null;

  /**
   * Contenu original AVANT la modification.
   *
   * Conservé pour audit et traçabilité.
   * Non exposé dans les réponses API publiques.
   */
  @Column({ type: 'text', nullable: true })
  originalContent: string | null;

  /* ==========================================================
   * SUPPRESSION DOUCE  (RGPD)
   * ========================================================== */

  /**
   * Soft delete TypeORM.
   *
   * Quand un acteur supprime un message :
   *   - deletedAt est renseigné
   *   - content et mediaUrl sont mis à null côté SERVICE
   *   - la ligne reste en base (audit, compteurs)
   *   - le frontend affiche "Ce message a été supprimé"
   *
   * Compatible avec find({ withDeleted: true }) pour les admins.
   */
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  /**
   * UUID de l'acteur qui a supprimé le message.
   * null si non supprimé.
   */
  @Column({ type: 'uuid', nullable: true })
  deletedById: string | null;

  /* ==========================================================
   * RÉACTIONS EMOJI
   * ========================================================== */

  /**
   * Réactions emoji indexées par emoji → liste d'acteurs.
   *
   * Format JSON :
   *   { "❤️": ["clientId1"], "👍": ["companyId2", "deliveryId3"] }
   *
   * Simple et flexible pour une v1.
   *
   * À migrer vers une table message_reactions si le volume
   * de réactions devient important (v2 / groupes).
   */
  @Column({ type: 'json', nullable: true })
  reactions: Record<string, string[]> | null;

  /* ==========================================================
   * TIMESTAMP
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;
}