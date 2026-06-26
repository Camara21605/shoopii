/* ============================================================
 * FICHIER : src/database/entities/messaging/conversation-permission.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Règles de permission pour ouvrir une conversation entre
 * deux acteurs Shopi selon leur relation de follow.
 *
 * Chaque ligne représente :
 *
 *    "Les règles qui s'appliquent quand TYPE_A veut écrire à TYPE_B"
 *
 * ------------------------------------------------------------
 * POURQUOI CETTE TABLE ?
 * ------------------------------------------------------------
 *
 * Chaque paire d'acteurs a des règles DIFFÉRENTES pour initier
 * une conversation. Exemples :
 *
 *   CLIENT → COMPANY     : TOUJOURS autorisé
 *   COMPANY → CLIENT     : seulement si le CLIENT suit la COMPANY
 *   DELIVERY → CLIENT    : seulement si assigné à une commande
 *   PARTNER → CLIENT     : JAMAIS autorisé directement
 *
 * Cette table permet de configurer ces règles DYNAMIQUEMENT
 * en base de données sans toucher au code du service.
 *
 * ------------------------------------------------------------
 * FONCTIONNEMENT
 * ------------------------------------------------------------
 *
 * Quand un acteur veut ouvrir une conversation,
 * le MessagerieService :
 *
 *   1. Charge la règle ConversationPermission pour ce pair
 *      de types : WHERE initiatorType = ? AND targetType = ?
 *
 *   2. Si alwaysAllowed = true → autoriser immédiatement
 *
 *   3. Si neverAllowed = true → rejeter (HTTP 403)
 *
 *   4. Si followRequired = true → vérifier dans follows :
 *        SELECT 1 FROM follows
 *        WHERE followerId = initiatorId AND targetId = targetId
 *           OR followerId = targetId    AND targetId = initiatorId
 *        LIMIT 1
 *
 *   5. Si mutualFollowRequired = true → vérifier les deux sens
 *
 *   6. Si assignmentRequired = true → vérifier dans orders :
 *        SELECT 1 FROM orders
 *        WHERE deliveryId = initiatorId AND clientId = targetId
 *        LIMIT 1
 *
 *   7. Si toutes les conditions sont remplies → créer la conv
 *
 *   8. Sinon → rejeter avec deniedMessage
 *
 * ------------------------------------------------------------
 * DONNÉES À INSÉRER EN SEED (14 règles)
 * ------------------------------------------------------------
 *
 *  initiator      | target        | always | never | follow | mutual | assign
 *  --------------|---------------|--------|-------|--------|--------|-------
 *  client         | company       |  true  | false | false  | false  | false
 *  client         | delivery      | false  | false |  true  | false  | false
 *  client         | correspondent | false  | false |  true  | false  | false
 *  company        | client        | false  | false |  true  | false  | false
 *  company        | delivery      | false  | false |  true  | false  | false
 *  company        | correspondent | false  | false |  true  | false  | false
 *  company        | partner       | false  | false |  true  | false  | false
 *  delivery       | company       | false  | false |  true  | false  | false
 *  delivery       | client        | false  | false | false  | false  |  true
 *  delivery       | correspondent | false  | false |  true  | false  | false
 *  correspondent  | company       | false  | false |  true  | false  | false
 *  correspondent  | delivery      | false  | false | false  | false  |  true
 *  correspondent  | client        | false  | false | false  | false  |  true
 *  partner        | company       | false  | false |  true  | false  | false
 *
 * Seed : src/database/seeds/conv-permissions.seed.ts
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 * Aucune relation TypeORM directe.
 * Cette table est une table de configuration pure.
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  UNIQUE : (initiatorType, targetType)
 *    → une seule règle par paire de types d'acteurs
 *
 * ------------------------------------------------------------
 * ⚠️  CORRECTION TYPEORM CRITIQUE
 * ------------------------------------------------------------
 *
 * initiatorType et targetType utilisent ConversationActorType
 * importé depuis conversation.entity.ts.
 *
 * ✅ FIX : enum: ConversationActorType passé explicitement
 * dans chaque @Column pour éviter l'erreur TypeORM au boot :
 *
 *   TypeORMError: Column "initiatorType" of Entity
 *   "ConversationPermission" is defined as enum,
 *   but missing "enum" or "enumName" properties.
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { ConversationActorType } from './conversation.entity';

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Unique('UQ_conv_perm_pair', ['initiatorType', 'targetType'])
@Entity('conversation_permissions')
export class ConversationPermission {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * PAIRE DE TYPES D'ACTEURS
   * ========================================================== */

  /**
   * Type de l'acteur qui veut INITIER la conversation.
   *
   * Ex: CLIENT veut écrire à COMPANY.
   *
   * ✅ FIX : enum: ConversationActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: ConversationActorType,
  })
  initiatorType: ConversationActorType;

  /**
   * Type de l'acteur CIBLE de la conversation.
   *
   * Ex: COMPANY est la cible du message du CLIENT.
   *
   * ✅ FIX : enum: ConversationActorType passé explicitement.
   */
  @Column({
    type: 'enum',
    enum: ConversationActorType,
  })
  targetType: ConversationActorType;

  /* ==========================================================
   * RÈGLES DE PERMISSION
   * ========================================================== */

  /**
   * true → l'initiateur DOIT suivre la cible dans follows
   *        (ou la cible suit l'initiateur) pour pouvoir écrire.
   *
   * Vérification côté SERVICE :
   *   SELECT 1 FROM follows
   *   WHERE (followerId = initiatorId AND targetId = targetId)
   *      OR (followerId = targetId    AND targetId = initiatorId)
   *   AND status = 'active'
   *   LIMIT 1
   */
  @Column({ type: 'boolean', default: false })
  followRequired: boolean;

  /**
   * true → le suivi DOIT être BIDIRECTIONNEL.
   *
   * Plus restrictif que followRequired.
   * A suit B ET B suit A dans la table follows.
   *
   * Ex: pour activer des fonctions premium entre partenaires.
   */
  @Column({ type: 'boolean', default: false })
  mutualFollowRequired: boolean;

  /**
   * true → l'initiateur doit être assigné à une commande
   *        ou une mission impliquant la cible.
   *
   * Utilisé pour :
   *   DELIVERY → CLIENT    (doit avoir une livraison en cours)
   *   CORRESPONDENT → CLIENT (doit avoir un colis en dépôt)
   *
   * Vérification côté SERVICE dans la table orders :
   *   SELECT 1 FROM orders
   *   WHERE deliveryId = initiatorId AND clientId = targetId
   *   AND status NOT IN ('cancelled', 'refunded')
   *   LIMIT 1
   */
  @Column({ type: 'boolean', default: false })
  assignmentRequired: boolean;

  /**
   * true → la conversation est TOUJOURS autorisée.
   *
   * Écrase TOUTES les autres règles (follow, mutual, assignment).
   *
   * Ex:
   *   CLIENT → COMPANY = toujours autorisé (client peut contacter boutique)
   */
  @Column({ type: 'boolean', default: false })
  alwaysAllowed: boolean;

  /**
   * true → la conversation n'est JAMAIS autorisée dans ce sens.
   *
   * Écrase toutes les autres règles.
   *
   * Ex:
   *   CLIENT → PARTNER = jamais (les clients ne parlent pas aux partenaires)
   *   PARTNER → CLIENT = jamais (idem)
   */
  @Column({ type: 'boolean', default: false })
  neverAllowed: boolean;

  /* ==========================================================
   * MESSAGE D'ERREUR PERSONNALISÉ
   * ========================================================== */

  /**
   * Message affiché à l'utilisateur quand la permission
   * est refusée (HTTP 403).
   *
   * Ex: "Abonnez-vous à cette boutique pour lui envoyer un message."
   * Ex: "Vous devez être assigné à une livraison pour contacter ce client."
   *
   * null → message d'erreur générique par défaut.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  deniedMessage: string | null;

  /* ==========================================================
   * MÉTADONNÉES  (documentation interne)
   * ========================================================== */

  /**
   * Description interne de cette règle pour les développeurs.
   *
   * Visible uniquement dans la BDD et le dashboard admin.
   *
   * Ex: "Un client peut toujours contacter une boutique
   *      sans condition de follow — friction réduite."
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Mis à jour quand un admin modifie une règle de permission
   * depuis le dashboard super-admin.
   */
  @UpdateDateColumn()
  updatedAt: Date;
}