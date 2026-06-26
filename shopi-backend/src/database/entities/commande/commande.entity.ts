/* ============================================================
 * FICHIER : src/database/entities/commande/commande.entity.ts
 * ORDRE   : 1 — Créer en premier (commande-code en dépend)
 *
 * RÔLE    : Table principale des commandes Shopi.
 *
 * ─── NOUVEAU FLUX DE VALIDATION ──────────────────────────────
 *
 *  La validation CLIENT est désormais obligatoire et finale.
 *  C'est elle seule qui déclenche le statut DELIVERED.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │                   NOUVEAU FLUX COMPLET                       │
 *  ├──────┬───────────────────┬─────────────────────────────────┤
 *  │Étape │ Acteur            │ Action                           │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  0   │ Système           │ Commande créée (PENDING)         │
 *  │  0   │ Système           │ Paiement confirmé → PAID         │
 *  │  0   │ Système           │ Codes générés pour tous acteurs  │
 *  │      │                   │ Code CLIENT créé en              │
 *  │      │                   │ AWAITING_UNLOCK (pas encore      │
 *  │      │                   │ envoyé au client)                │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  1   │ ENTREPRISE        │ Valide son code → commande       │
 *  │      │                   │ passe à IN_PROGRESS              │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  2   │ LIVREUR           │ Valide son code (si présent)     │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  3   │ CORRESPONDANT     │ Valide son code (si présent)     │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  4   │ PARTENAIRE        │ Valide son code (si présent)     │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  5   │ Système auto      │ Tous acteurs inter. validés →    │
 *  │      │                   │ Code CLIENT débverrouillé        │
 *  │      │                   │ (AWAITING_UNLOCK → PENDING)      │
 *  │      │                   │ SMS + notification push envoyés  │
 *  │      │                   │ au client avec son code          │
 *  ├──────┼───────────────────┼─────────────────────────────────┤
 *  │  6   │ CLIENT ★          │ Valide son code de réception     │
 *  │      │                   │ → commande passe à DELIVERED     │
 *  │      │                   │ → paiements aux acteurs débloqués│
 *  │      │                   │ → notification satisfaction      │
 *  └──────┴───────────────────┴─────────────────────────────────┘
 *
 *  ★ Sans la validation CLIENT → la commande reste IN_PROGRESS.
 *    Après 7 jours sans validation client → validation automatique
 *    par le système (configurable : autoValidationDelayDays).
 *
 * ─── PROTECTION ANTI-FRAUDE ──────────────────────────────────
 *
 *  Le code CLIENT est en AWAITING_UNLOCK dès la création.
 *  Il n'est JAMAIS envoyé au client avant que tous les acteurs
 *  intermédiaires aient validé. Ainsi :
 *
 *  - Un livreur ne peut pas "prétendre" avoir livré sans valider.
 *  - Un client ne peut pas valider "à l'avance" pour débloquer
 *    le paiement à un complice.
 *  - Si le client ne reçoit pas → il n'a pas le code → litige.
 *
 * ─── RÈGLE DE COMPLÉTION (nouvelles conditions) ──────────────
 *
 *  AVANT : codes.every(c => c.status === 'validated')
 *  APRÈS : code CLIENT validated (c.acteurType === 'client'
 *          && c.status === 'validated')
 *
 *  La validation CLIENT implique que tous les autres sont validés
 *  (car le code CLIENT n'est envoyé qu'après). Donc vérifier
 *  uniquement le code CLIENT suffit.
 *
 * ─── RELATIONS ───────────────────────────────────────────────
 *
 *  Commande ──(ManyToOne)──► Client
 *  Commande ──(OneToMany)──► CommandeItem   (produits commandés)
 *  Commande ──(OneToMany)──► CommandeCode   (codes de validation)
 *  Commande ──(ManyToOne)──► Company        (entreprise vendeur)
 *  Commande ──(ManyToOne)──► Delivery       [optionnel]
 *  Commande ──(ManyToOne)──► Correspondent  [optionnel]
 *  Commande ──(ManyToOne)──► Partner        [optionnel]
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { Client }        from '../profiles/client-profile.entity';
import { Company }       from '../profiles/entreprise-profile.entity';
import { Delivery }      from '../profiles/livreur-profile.entity';
import { Correspondent } from '../profiles/correspondant-profile.entity';
import { Partner }       from '../profiles/partenaire-profile.entity';
import { CommandeItem }  from './commande-item.entity';
import { CommandeCode }  from './commande-code.entity';

// ─── ENUMS ────────────────────────────────────────────────────────────────────

/**
 * Statut global de la commande.
 *
 * PENDING          → Commande créée, paiement en attente
 * PAID             → Paiement confirmé, codes générés et envoyés
 * IN_PROGRESS      → Validation en cours (au moins un code validé)
 * AWAITING_CLIENT  → ✅ NOUVEAU — Tous acteurs intermédiaires ont validé,
 *                    en attente de la confirmation de réception du client
 * DELIVERED        → Code CLIENT validé → livraison confirmée par le client
 * CANCELLED        → Commande annulée avant validation complète
 * REFUNDED         → Commande remboursée
 * DISPUTED         → Litige ouvert (client n'a pas reçu ou problème qualité)
 * AUTO_DELIVERED   → ✅ NOUVEAU — Validation automatique après délai (client injoignable)
 */
export enum CommandeStatus {
  PENDING         = 'pending',
  PAID            = 'paid',
  IN_PROGRESS     = 'in_progress',
  /** ✅ NOUVEAU — Tous les intermédiaires ont validé, client doit confirmer */
  AWAITING_CLIENT = 'awaiting_client',
  DELIVERED       = 'delivered',
  CANCELLED       = 'cancelled',
  REFUNDED        = 'refunded',
  DISPUTED        = 'disputed',
  /** ✅ NOUVEAU — Livraison validée automatiquement après autoValidationDelayDays */
  AUTO_DELIVERED  = 'auto_delivered',
}

/**
 * Mode de livraison choisi par le client.
 * Détermine quels codes intermédiaires seront générés.
 *
 * Dans tous les cas, un code CLIENT est TOUJOURS généré
 * en plus des codes intermédiaires.
 */
export enum ModeLivraison {
  LIVREUR        = 'livreur',        // code ENTREPRISE + LIVREUR + CLIENT
  CORRESPONDANT  = 'correspondant',  // code ENTREPRISE + CORRESPONDANT + CLIENT
  PARTENAIRE     = 'partenaire',     // code ENTREPRISE + PARTENAIRE + CLIENT
  PICKUP         = 'pickup',         // code ENTREPRISE + CLIENT seulement (retrait boutique)
  MIXTE          = 'mixte',          // code ENTREPRISE + acteurs renseignés + CLIENT
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITÉ COMMANDE — AMÉLIORÉE
// ─────────────────────────────────────────────────────────────────────────────

@Entity('commandes')
export class Commande {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─────────────────────────────────────────────────────────────
  // NUMÉRO DE COMMANDE LISIBLE
  // Généré dans CommandeService : "CMD-2025-00142"
  // ─────────────────────────────────────────────────────────────

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  numero: string;

  // ─────────────────────────────────────────────────────────────
  // ACTEURS
  // ─────────────────────────────────────────────────────────────

  /**
   * Client qui a passé la commande.
   * Un code CLIENT (type='client') lui sera envoyé
   * en dernier pour confirmer la réception.
   *
   * onDelete SET NULL : on conserve l'historique même
   * si le compte client est supprimé.
   */
  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'clientId' })
  client: Promise<Client> | Client;

  @Index()
  @Column({ name: 'clientId', type: 'uuid' })
  clientId: string;

  // ───────────────────────────────────────────────────────────

  /**
   * Entreprise (boutique) — TOUJOURS présente.
   * Un code ENTREPRISE est toujours généré en premier.
   */
  @ManyToOne(() => Company, {
    nullable: false,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company;

  @Index()
  @Column({ name: 'companyId', type: 'uuid' })
  companyId: string;

  // ───────────────────────────────────────────────────────────

  /**
   * Livreur choisi par le client.
   * NULL → pas de code LIVREUR généré.
   * Renseigné → code LIVREUR généré (ordre 2).
   */
  @ManyToOne(() => Delivery, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'livreurId' })
  livreur: Promise<Delivery> | Delivery | null;

  @Column({ name: 'livreurId', type: 'uuid', nullable: true })
  livreurId: string | null;

  // ───────────────────────────────────────────────────────────

  /**
   * Correspondant (point relais) choisi.
   * NULL → pas de code CORRESPONDANT généré.
   * Renseigné → code CORRESPONDANT généré (ordre 3).
   */
  @ManyToOne(() => Correspondent, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'correspondantId' })
  correspondant: Promise<Correspondent> | Correspondent | null;

  @Column({ name: 'correspondantId', type: 'uuid', nullable: true })
  correspondantId: string | null;

  // ───────────────────────────────────────────────────────────

  /**
   * Partenaire impliqué.
   * NULL → pas de code PARTENAIRE généré.
   * Renseigné → code PARTENAIRE généré (ordre 4).
   */
  @ManyToOne(() => Partner, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'partenaireId' })
  partenaire: Promise<Partner> | Partner | null;

  @Column({ name: 'partenaireId', type: 'uuid', nullable: true })
  partenaireId: string | null;

  // ─────────────────────────────────────────────────────────────
  // STATUT & MODE
  // ─────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: CommandeStatus,
    default: CommandeStatus.PENDING,
  })
  status: CommandeStatus;

  /**
   * Mode de livraison choisi par le client.
   *
   * PICKUP         → codes générés : ENTREPRISE (1) + CLIENT (5)
   * LIVREUR        → codes générés : ENTREPRISE (1) + LIVREUR (2) + CLIENT (5)
   * CORRESPONDANT  → codes générés : ENTREPRISE (1) + CORRESPONDANT (3) + CLIENT (5)
   * PARTENAIRE     → codes générés : ENTREPRISE (1) + PARTENAIRE (4) + CLIENT (5)
   * MIXTE          → codes générés : ENTREPRISE (1) + tous acteurs renseignés + CLIENT (5)
   */
  @Column({
    type: 'enum',
    enum: ModeLivraison,
    default: ModeLivraison.LIVREUR,
  })
  modeLivraison: ModeLivraison;

  // ─────────────────────────────────────────────────────────────
  // VALIDATION CLIENT AUTOMATIQUE
  // ─────────────────────────────────────────────────────────────

  /**
   * ✅ NOUVEAU — Délai en jours avant validation automatique.
   *
   * Si le client ne valide pas son code de réception dans ce délai
   * après que le code lui a été envoyé (après AWAITING_CLIENT),
   * le système valide automatiquement → status = AUTO_DELIVERED.
   *
   * Cela débloque les paiements aux acteurs sans bloquer le système
   * si le client est injoignable.
   *
   * Valeur par défaut : 7 jours.
   * Configurable par commande (ex: 3j pour produits locaux, 14j pour international).
   */
  @Column({ type: 'int', default: 7 })
  autoValidationDelayDays: number;

  /**
   * ✅ NOUVEAU — Date à partir de laquelle le cron d'auto-validation
   * peut déclencher AUTO_DELIVERED.
   *
   * Calculée par CommandeService.deverrouillerCodeClient() :
   *   autoValidationAt = debloquéAt + autoValidationDelayDays
   *
   * NULL → le code client n'a pas encore été envoyé.
   * Date → le cron vérifie si Date < maintenant → AUTO_DELIVERED.
   */
  @Column({ type: 'timestamp', nullable: true })
  autoValidationAt: Date | null;

  // ─────────────────────────────────────────────────────────────
  // MONTANTS
  // ─────────────────────────────────────────────────────────────

  /** Sous-total produits en GNF */
  @Column({ type: 'bigint', default: 0 })
  sousTotal: number;

  /** Frais de livraison en GNF */
  @Column({ type: 'bigint', default: 0 })
  fraisLivraison: number;

  /** Commission Shopi (3%) en GNF */
  @Column({ type: 'bigint', default: 0 })
  commissionShopi: number;

  /** Total payé par le client en GNF */
  @Column({ type: 'bigint', default: 0 })
  total: number;

  // ─────────────────────────────────────────────────────────────
  // LIVRAISON
  // ─────────────────────────────────────────────────────────────

  /** Adresse de livraison (snapshot au moment de la commande) */
  @Column({ type: 'text', nullable: true })
  adresseLivraison: string | null;

  /** Ville de livraison */
  @Column({ type: 'varchar', length: 100, nullable: true })
  villeLivraison: string | null;

  /** Instructions du client (ex: "Appeler en arrivant, bâtiment B") */
  @Column({ type: 'text', nullable: true })
  notesClient: string | null;

  /** Date de livraison estimée (calculée à la création) */
  @Column({ type: 'timestamp', nullable: true })
  datelivraisonEstimee: Date | null;

  /**
   * Date de livraison effective.
   * Renseignée quand le code CLIENT est validé
   * (ou quand AUTO_DELIVERED est déclenché).
   */
  @Column({ type: 'timestamp', nullable: true })
  dateLivraisonEffective: Date | null;

  // ─────────────────────────────────────────────────────────────
  // PAIEMENT
  // ─────────────────────────────────────────────────────────────

  /** Méthode de paiement (ex: 'orange_money', 'wave', 'carte_visa') */
  @Column({ type: 'varchar', length: 50, nullable: true })
  methodePaiement: string | null;

  /** Référence de la transaction (ID retourné par le prestataire de paiement) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  refPaiement: string | null;

  /** Date de confirmation du paiement */
  @Column({ type: 'timestamp', nullable: true })
  datePaiement: Date | null;

  // ─────────────────────────────────────────────────────────────
  // RELATIONS OneToMany
  // ─────────────────────────────────────────────────────────────

  /**
   * Produits inclus dans cette commande.
   * Snapshots des prix au moment de l'achat.
   */
  @OneToMany(() => CommandeItem, item => item.commande, {
    cascade: true,
    eager: false,
  })
  items: CommandeItem[];

  /**
   * Codes de validation de la commande.
   *
   * ─── CODES GÉNÉRÉS SELON LE MODE ────────────────────────────
   *
   *  PICKUP :
   *    [ENTREPRISE(1)] [CLIENT(5)]
   *
   *  LIVREUR :
   *    [ENTREPRISE(1)] [LIVREUR(2)] [CLIENT(5)]
   *
   *  CORRESPONDANT :
   *    [ENTREPRISE(1)] [CORRESPONDANT(3)] [CLIENT(5)]
   *
   *  PARTENAIRE :
   *    [ENTREPRISE(1)] [PARTENAIRE(4)] [CLIENT(5)]
   *
   *  MIXTE (ex: livreur + correspondant) :
   *    [ENTREPRISE(1)] [LIVREUR(2)] [CORRESPONDANT(3)] [CLIENT(5)]
   *
   *  Le code CLIENT est généré ALWAYS mais en AWAITING_UNLOCK.
   *  Il passe à PENDING uniquement quand tous les autres sont VALIDATED.
   *
   *  Pour vérifier si la commande est livrée :
   *    const codeClient = codes.find(c => c.acteurType === 'client');
   *    const livrée = codeClient?.status === 'validated';
   * ─────────────────────────────────────────────────────────────
   */
  @OneToMany(() => CommandeCode, code => code.commande, {
    cascade: true,
    eager: false,
  })
  codes: CommandeCode[];

  // ─────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}