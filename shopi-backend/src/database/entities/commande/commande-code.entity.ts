/* ============================================================
 * FICHIER : src/database/entities/commande/commande-code.entity.ts
 * ORDRE   : 3 — Dépend de Commande (créer après commande.entity.ts)
 *
 * RÔLE    : Codes de validation liés à une commande.
 *           Un code par acteur impliqué dans la commande.
 *
 * ─── NOUVELLE LOGIQUE : LE CLIENT VALIDE EN DERNIER ──────────
 *
 *  La validation CLIENT est la CONFIRMATION DE RÉCEPTION.
 *  C'est elle qui déclenche le statut DELIVERED.
 *
 *  Sans ce code CLIENT final, la commande reste en IN_PROGRESS
 *  même si tous les autres acteurs ont validé.
 *
 *  Ce mécanisme protège le client : si le livreur valide son
 *  code mais ne livre pas, le client ne valide pas → litige
 *  possible → Shopi peut intervenir.
 *
 * ─── ORDRE DE VALIDATION (flux standard) ─────────────────────
 *
 *  ┌──────┬──────────────────┬──────────────────────────────────────────────────┐
 *  │ Étape│ Acteur           │ Signification                                    │
 *  ├──────┼──────────────────┼──────────────────────────────────────────────────┤
 *  │  1   │ ENTREPRISE       │ Commande préparée / expédiée par la boutique     │
 *  │  2   │ LIVREUR          │ Colis pris en charge par le livreur              │
 *  │  3   │ CORRESPONDANT    │ Colis en point relais (si mode correspondant)    │
 *  │  4   │ PARTENAIRE       │ Étape partenaire validée (si mode partenaire)    │
 *  │  5   │ CLIENT ★         │ Client confirme la réception → DELIVERED         │
 *  └──────┴──────────────────┴──────────────────────────────────────────────────┘
 *
 *  ★ La validation CLIENT est TOUJOURS la dernière.
 *    Le code CLIENT n'est envoyé au client QUE quand tous les
 *    autres acteurs ont validé (ordre: 5 = toujours le plus grand).
 *    Cela évite qu'un client valide avant la livraison.
 *
 * ─── RÈGLE DE GÉNÉRATION ─────────────────────────────────────
 *
 *  À la création d'une commande (après paiement confirmé) :
 *
 *  ┌──────────────────┬────────────────────────────────────┬───────┐
 *  │ Acteur           │ Condition de génération             │ Ordre │
 *  ├──────────────────┼────────────────────────────────────┼───────┤
 *  │ ENTREPRISE       │ TOUJOURS                            │   1   │
 *  │ LIVREUR          │ SI commande.livreurId != null       │   2   │
 *  │ CORRESPONDANT    │ SI commande.correspondantId != null │   3   │
 *  │ PARTENAIRE       │ SI commande.partenaireId != null    │   4   │
 *  │ CLIENT ★         │ TOUJOURS — envoyé en dernier        │   5   │
 *  └──────────────────┴────────────────────────────────────┴───────┘
 *
 *  ★ Le code CLIENT est généré à la création MAIS son envoi au
 *    client est déclenché uniquement quand tous les autres codes
 *    passent à VALIDATED. C'est CommandeService.validerCode()
 *    qui gère cet envoi automatique.
 *
 * ─── CYCLE DE VIE D'UN CODE ──────────────────────────────────
 *
 *  PENDING          → Code généré (envoyé à l'acteur ou en attente)
 *  AWAITING_UNLOCK  → Code CLIENT en attente que les autres soient validés
 *  VALIDATED        → Code validé par l'acteur concerné
 *  EXPIRED          → Code non validé dans le délai (72h)
 *  CANCELLED        → Commande annulée avant validation de ce code
 *
 * ─── COMMENT VALIDER UN CODE ? ───────────────────────────────
 *
 *  1. Acteur reçoit son code (ex: "CMD-7X3K9M4P") par SMS/push
 *  2. Il le saisit dans son dashboard Shopi
 *  3. CommandeService.validerCode(code, acteurId) vérifie :
 *       ✅ code existe et appartient à la bonne commande
 *       ✅ code.acteurId === acteurId (bonne personne)
 *       ✅ code.status === PENDING (pas encore validé)
 *       ✅ code.expiresAt > maintenant (pas expiré)
 *       ✅ Si code CLIENT : tous les autres codes sont VALIDATED
 *  4. Si OK → code.status = VALIDATED + horodatage
 *  5. Si tous les codes VALIDATED → commande.status = DELIVERED
 *
 * ─── SÉCURITÉ ─────────────────────────────────────────────────
 *
 *  - Code alphanumérique : "CMD-" + 8 chars (ex: CMD-7X3K9M4P)
 *  - Un seul code par acteur par commande (contrainte UNIQUE)
 *  - Expire après 72h par défaut (configurable)
 *  - Max 5 tentatives incorrectes → code EXPIRED auto (brute-force)
 *  - Code CLIENT envoyé uniquement quand les acteurs intermédiaires
 *    ont tous validé → impossible de valider "avant" la livraison
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
  Index, Unique,
} from 'typeorm';

import { Commande } from './commande.entity';

// ─── ENUMS ────────────────────────────────────────────────────────────────────

/**
 * Type de l'acteur qui reçoit et valide ce code.
 *
 * IMPORTANT : CLIENT est ajouté comme acteur à part entière.
 * Son code représente la confirmation de réception — c'est
 * le seul qui déclenche le statut DELIVERED.
 */
export enum CodeActeurType {
  /** Code vendeur — TOUJOURS généré à la création, ordre 1 */
  ENTREPRISE    = 'entreprise',

  /** Code livreur — généré SI commande.livreurId != null, ordre 2 */
  LIVREUR       = 'livreur',

  /** Code point relais — généré SI commande.correspondantId != null, ordre 3 */
  CORRESPONDANT = 'correspondant',

  /** Code partenaire — généré SI commande.partenaireId != null, ordre 4 */
  PARTENAIRE    = 'partenaire',

  /**
   * ✅ NOUVEAU — Code client (confirmation de réception).
   * TOUJOURS généré, ordre 5 = toujours le dernier.
   *
   * Envoyé au client UNIQUEMENT quand tous les autres codes
   * sont à VALIDATED. Si le client valide ce code, la commande
   * passe immédiatement à DELIVERED.
   *
   * Signification : "J'ai bien reçu ma commande en bon état."
   */
  CLIENT        = 'client',
}

/**
 * Statut du code de validation.
 *
 * AWAITING_UNLOCK est spécifique au code CLIENT :
 * il est généré mais "verrouillé" tant que les acteurs
 * intermédiaires (entreprise, livreur…) n'ont pas validé.
 */
export enum CodeCommandeStatus {
  /** Code généré et envoyé à l'acteur — en attente de validation */
  PENDING          = 'pending',

  /**
   * ✅ NOUVEAU — État intermédiaire réservé au code CLIENT.
   *
   * Le code est généré mais PAS encore envoyé au client.
   * Il passe à PENDING (et est envoyé) seulement quand
   * tous les autres acteurs ont validé leurs codes.
   *
   * Ce statut existe pour éviter les fraudes :
   * si on envoyait le code CLIENT dès le départ, un client
   * malhonnête pourrait valider avant d'avoir reçu le colis.
   */
  AWAITING_UNLOCK  = 'awaiting_unlock',

  /** Code validé avec succès par l'acteur concerné */
  VALIDATED        = 'validated',

  /** Code non validé dans le délai imparti — généré automatiquement par le cron */
  EXPIRED          = 'expired',

  /** Code annulé suite à une annulation de commande */
  CANCELLED        = 'cancelled',
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITÉ COMMANDE CODE — AMÉLIORÉE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contrainte UNIQUE : un seul code par type d'acteur par commande.
 *
 * Exemples valides pour la même commande :
 *   { commandeId: "abc", acteurType: "entreprise" } ✅
 *   { commandeId: "abc", acteurType: "livreur"    } ✅
 *   { commandeId: "abc", acteurType: "client"     } ✅ (toujours 1 seul)
 *
 * Exemple invalide :
 *   { commandeId: "abc", acteurType: "livreur"    } ❌ (2e livreur → impossible)
 */
@Entity('commande_codes')
@Unique(['commandeId', 'acteurType'])
export class CommandeCode {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─────────────────────────────────────────────────────────────
  // RELATION VERS LA COMMANDE
  // ─────────────────────────────────────────────────────────────

  /**
   * Commande parente.
   * CASCADE DELETE : si la commande est supprimée, ses codes le sont aussi.
   */
  @ManyToOne(() => Commande, commande => commande.codes, {
    nullable: false,
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'commandeId' })
  commande: Commande;

  @Index()
  @Column({ name: 'commandeId', type: 'uuid' })
  commandeId: string;

  // ─────────────────────────────────────────────────────────────
  // CODE ALPHANUMÉRIQUE
  // ─────────────────────────────────────────────────────────────

  /**
   * Valeur du code envoyé à l'acteur.
   * Format : "CMD-" + 8 caractères alphanumériques majuscules.
   * Ex : "CMD-7X3K9M4P"
   *
   * Index UNIQUE global : un même code ne peut exister
   * dans deux commandes différentes.
   *
   * Généré dans CommandeService.genererCode() avec crypto.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 15 })
  code: string;

  // ─────────────────────────────────────────────────────────────
  // ACTEUR DESTINATAIRE
  // ─────────────────────────────────────────────────────────────

  /**
   * Type de l'acteur qui doit valider ce code.
   * Combiné avec commandeId → UNIQUE (voir contrainte @Unique).
   *
   * Valeurs possibles :
   *   'entreprise'    → code reçu par la boutique (vendeur)
   *   'livreur'       → code reçu par le livreur choisi
   *   'correspondant' → code reçu par le point relais
   *   'partenaire'    → code reçu par le partenaire
   *   'client'        → code reçu par le client (CONFIRMATION RÉCEPTION)
   */
  @Column({ type: 'enum', enum: CodeActeurType })
  acteurType: CodeActeurType;

  /**
   * UUID de l'acteur destinataire dans la table users.
   *
   * Correspondances selon acteurType :
   *   entreprise    → commande.companyId
   *   livreur       → commande.livreurId
   *   correspondant → commande.correspondantId
   *   partenaire    → commande.partenaireId
   *   client        → commande.clientId      ✅ NOUVEAU
   *
   * Utilisé par CommandeService.validerCode() pour vérifier
   * que c'est bien la bonne personne qui valide.
   */
  @Index()
  @Column({ type: 'uuid' })
  acteurId: string;

  /**
   * Nom de l'acteur — snapshot pour affichage dans le dashboard.
   * Ex: "TechStore Conakry", "Mamadou Diallo", "Ibrahim Bah (client)"
   *
   * Stocké pour ne pas faire de jointure inutile lors de l'affichage
   * de la liste des codes dans l'interface admin.
   */
  @Column({ type: 'varchar', length: 255 })
  acteurNom: string;

  // ─────────────────────────────────────────────────────────────
  // ORDRE DE VALIDATION
  // ─────────────────────────────────────────────────────────────

  /**
   * ✅ NOUVEAU — Position dans la séquence de validation.
   *
   * Utilisé par CommandeService pour :
   *   1. Savoir quel acteur valide en dernier (toujours CLIENT = 5)
   *   2. Vérifier qu'un acteur ne valide pas "hors séquence"
   *   3. Afficher la progression dans l'interface
   *
   * Valeurs par défaut :
   *   ENTREPRISE    → ordre = 1
   *   LIVREUR       → ordre = 2
   *   CORRESPONDANT → ordre = 3
   *   PARTENAIRE    → ordre = 4
   *   CLIENT        → ordre = 5  ← TOUJOURS LE PLUS GRAND
   *
   * Note : si certains acteurs sont absents (ex: pas de correspondant),
   * les ordres ne sont pas recalculés. Ce qui compte c'est que
   * CLIENT soit le dernier (son ordre > tous les autres présents).
   */
  @Column({ type: 'int', default: 1 })
  ordre: number;

  // ─────────────────────────────────────────────────────────────
  // STATUT & VALIDATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Statut actuel du code.
   *
   * PENDING          → envoyé à l'acteur, en attente de saisie
   * AWAITING_UNLOCK  → code CLIENT en attente (autres codes non validés)
   * VALIDATED        → validé avec succès
   * EXPIRED          → délai dépassé
   * CANCELLED        → commande annulée
   *
   * ⚠️  Le statut AWAITING_UNLOCK s'applique UNIQUEMENT au code CLIENT.
   *     Il passe automatiquement à PENDING (et l'SMS est envoyé)
   *     quand CommandeService détecte que tous les autres codes
   *     sont à VALIDATED.
   */
  @Column({
    type: 'enum',
    enum: CodeCommandeStatus,
    default: CodeCommandeStatus.PENDING,
  })
  status: CodeCommandeStatus;

  /**
   * Date et heure d'expiration.
   * Par défaut : 72 heures après création.
   *
   * Pour le code CLIENT : l'expiration est repoussée de 72h
   * à partir du moment où il est "déverrouillé" (AWAITING_UNLOCK → PENDING)
   * et non pas de la création. Géré dans CommandeService.deverrouillerCodeClient().
   */
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /**
   * ✅ NOUVEAU — Date à laquelle ce code a été déverrouillé et envoyé.
   * Uniquement renseigné pour le code CLIENT (type = CLIENT).
   *
   * NULL → code pas encore envoyé (toujours en AWAITING_UNLOCK)
   * Date → code envoyé au client, l'expiration de 72h court depuis cette date.
   */
  @Column({ type: 'timestamp', nullable: true })
  debloquéAt: Date | null;

  /** Date et heure de validation effective par l'acteur */
  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  /**
   * IP depuis laquelle le code a été validé.
   * Pour audit et détection de fraude.
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  validatedFromIp: string | null;

  /**
   * Compteur de tentatives de saisie incorrectes.
   * Si tentativesEchouees >= 5 → code passe à EXPIRED automatiquement.
   * Protection contre les attaques brute-force.
   */
  @Column({ type: 'int', default: 0 })
  tentativesEchouees: number;

  /**
   * Note ou instruction pour cet acteur.
   * Ex pour le livreur : "Appeler avant livraison - portail fermé après 18h"
   * Ex pour le client  : "Votre colis est en bas de votre immeuble"
   */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}