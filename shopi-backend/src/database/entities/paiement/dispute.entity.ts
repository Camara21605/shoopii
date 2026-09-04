/* ============================================================
 * FICHIER : src/database/entities/paiement/dispute.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Représente un litige financier ouvert par un client
 * concernant une commande livrée.
 *
 * DIFFÉRENCE AVEC SavTicket (existant)
 * ─────────────────────────────────────────────────────────────
 * SavTicket traite les problèmes SAV généraux (questions,
 * réclamations sans enjeu financier direct, retours produits).
 *
 * Dispute est SPÉCIFIQUEMENT financier :
 *   - Il gèle les fonds des acteurs pendant l'instruction
 *   - Sa décision déclenche un remboursement ou une libération
 *   - Il a un montant contesté et un montant remboursé
 *   - Il peut lier à un SavTicket pour le contexte SAV
 *
 * RÈGLES MÉTIER
 * ─────────────────────────────────────────────────────────────
 * 1. Ouverture uniquement par le CLIENT
 * 2. Délai : dans les 7 jours suivant DELIVERED/AUTO_DELIVERED
 * 3. Maximum 1 dispute actif par commande
 * 4. Instruction par un ADMIN (délai : 48h)
 * 5. Décision : REMBOURSEMENT_TOTAL, REMBOURSEMENT_PARTIEL,
 *               REJET ou RE_LIVRAISON
 * 6. Clôture → irréversible
 *
 * EFFETS FINANCIERS
 * ─────────────────────────────────────────────────────────────
 * Ouverture  → wallets acteurs gelés (wallet.frozen = true)
 * REJET      → wallets dégelés (distributions RELEASED conservées)
 * REMBOURSEMENT → EscrowRefundService.executerRemboursement()
 *                 (annule les distributions ESCROW via WalletEngine,
 *                 puis crédite le client — voir escrow-refund.service.ts)
 *
 * ENTITÉS QUI L'UTILISENT
 * ─────────────────────────────────────────────────────────────
 *  DisputeEvidence → liste des preuves jointes
 *  PaiementRefundService → déclenche le remboursement
 *  FinancialAuditLog → trace chaque changement de statut
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule   → création, décision
 *  AdminModule      → instruction, décision
 *  DashboardModule  → statistiques litiges
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/dispute.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import { DisputeEvidence } from './dispute-evidence.entity';
import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Statuts du cycle de vie d'un litige.
 *
 * Machine à états formelle (ResolutionEngine) :
 *   OPEN → UNDER_REVIEW → WAITING_FOR_EVIDENCE → DECISION_PENDING
 *        → APPROVED → REFUND_PENDING → REFUNDED → CLOSED
 *        → REJECTED → CLOSED
 *
 * États legacy (rétrocompat) : RESOLVED_CLIENT, RESOLVED_SELLER → CLOSED
 */
export enum DisputeStatus {
  /** Litige soumis, en attente de prise en charge par un admin */
  OPEN                 = 'open',
  /** Admin a pris en charge et instruit le litige */
  UNDER_REVIEW         = 'under_review',
  /** Admin demande des preuves supplémentaires aux parties */
  WAITING_FOR_EVIDENCE = 'waiting_for_evidence',
  /** Preuves collectées, prêt pour la décision finale */
  DECISION_PENDING     = 'decision_pending',
  /** Décision prise en faveur du client (remboursement ou re-livraison) */
  APPROVED             = 'approved',
  /** Décision de rejet — wallets acteurs dégelés */
  REJECTED             = 'rejected',
  /** Remboursement en cours de traitement côté provider */
  REFUND_PENDING       = 'refund_pending',
  /** Remboursement effectué avec succès */
  REFUNDED             = 'refunded',
  /** Litige clôturé (état final irréversible) */
  CLOSED               = 'closed',
  /* ── Legacy (rétrocompatibilité) ── */
  RESOLVED_CLIENT      = 'resolved_client',
  RESOLVED_SELLER      = 'resolved_seller',
}

/**
 * Motif de l'ouverture du litige.
 * Aide l'admin à catégoriser et traiter rapidement les cas.
 */
export enum DisputeMotif {
  /** Le client affirme n'avoir jamais reçu la commande */
  ARTICLE_NON_RECU     = 'article_non_recu',
  /** La commande est arrivée endommagée */
  ARTICLE_ENDOMMAGE    = 'article_endommage',
  /** Le produit ne correspond pas à la description */
  MAUVAISE_QUALITE     = 'mauvaise_qualite',
  /** Le produit reçu est différent de celui commandé */
  MAUVAIS_ARTICLE      = 'mauvais_article',
  /** Livraison très en retard sans communication */
  RETARD_EXCESSIF      = 'retard_excessif',
  /** Paiement prélevé sans commande confirmée */
  PAIEMENT_INDU        = 'paiement_indu',
  /** Autre motif (préciser dans description) */
  AUTRE                = 'autre',
}

/**
 * Décision rendue par l'admin à la résolution du litige.
 */
export enum DisputeDecision {
  /** Remboursement total : tous les acteurs sont débités, client remboursé 100 % */
  REMBOURSEMENT_TOTAL   = 'remboursement_total',
  /** Remboursement partiel : montant négocié */
  REMBOURSEMENT_PARTIEL = 'remboursement_partiel',
  /** Litige rejeté : wallets acteurs dégelés, distributions RELEASED conservées */
  REJET                 = 'rejet',
  /** Re-livraison : pas de remboursement, une nouvelle livraison est planifiée */
  RE_LIVRAISON          = 're_livraison',
  /** Avoir crédité sur le wallet client (compromise) */
  AVOIR_WALLET          = 'avoir_wallet',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

/**
 * Un seul litige actif par commande à la fois.
 * La contrainte est logique (vérifiée dans le service),
 * pas en DB car plusieurs litiges peuvent exister sur une
 * commande (dans le temps, après CLOSED du premier).
 */
@Index('IDX_dispute_commande', ['commandeId'])
@Index('IDX_dispute_client', ['clientUserId'])
@Index('IDX_dispute_status', ['status'])
@Index('IDX_dispute_created_at', ['createdAt'])

/** Référence unique lisible (ex: "DSP-2026-0001") */
@Unique('UQ_dispute_reference', ['reference'])

@Entity('disputes')
export class Dispute {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Référence lisible du litige.
   * Format : "DSP-YYYY-NNNNN"
   * Généré par le service lors de l'ouverture.
   * Utilisé dans les communications client/admin.
   */
  @Column({ type: 'varchar', length: 25 })
  reference: string;

  /* ==========================================================
   * COMMANDE CONCERNÉE
   * ========================================================== */

  /**
   * UUID de la commande faisant l'objet du litige.
   * FK sans contrainte TypeORM (inter-modules).
   * La cohérence est garantie par le service.
   */
  @Column({ type: 'uuid' })
  commandeId: string;

  /**
   * Numéro lisible de la commande (snapshot).
   * Conservé même si la commande est anonymisée/archivée.
   * Ex : "CMD-2026-00142"
   */
  @Column({ type: 'varchar', length: 30 })
  commandeNumero: string;

  /* ==========================================================
   * ACTEURS
   * ========================================================== */

  /**
   * UserId du client qui a ouvert le litige.
   * Un litige ne peut être ouvert que par le client de la commande.
   */
  @Column({ type: 'uuid' })
  clientUserId: string;

  /**
   * UserId de l'admin qui instruit le litige.
   * NULL jusqu'à prise en charge (statut UNDER_REVIEW).
   */
  @Column({ type: 'uuid', nullable: true })
  adminUserId: string | null;

  /**
   * Lien optionnel vers un SavTicket existant.
   * Un client peut avoir d'abord ouvert un ticket SAV,
   * puis escalader en litige financier.
   * NULL si litige créé directement sans ticket SAV préalable.
   */
  @Column({ type: 'uuid', nullable: true })
  savTicketId: string | null;

  /* ==========================================================
   * CONTENU DU LITIGE
   * ========================================================== */

  /** Motif catégoriel de l'ouverture du litige. */
  @Column({ type: 'enum', enum: DisputeMotif })
  motif: DisputeMotif;

  /**
   * Description détaillée du problème par le client.
   * Obligatoire à l'ouverture.
   */
  @Column({ type: 'text' })
  description: string;

  /**
   * Montant contesté par le client (en GNF).
   * Peut être inférieur au total de la commande (litige partiel).
   * Par défaut = commande.total (litige total).
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montantConteste: number;

  /* ==========================================================
   * DÉCISION & RÉSOLUTION
   * ========================================================== */

  /** Statut actuel du litige dans son cycle de vie. */
  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  /**
   * Décision rendue par l'admin.
   * NULL jusqu'à la résolution du litige.
   */
  @Column({ type: 'enum', enum: DisputeDecision, nullable: true })
  decision: DisputeDecision | null;

  /**
   * Explication écrite de la décision par l'admin.
   * Envoyée au client et à l'entreprise par notification.
   */
  @Column({ type: 'text', nullable: true })
  decisionMotif: string | null;

  /**
   * Montant effectivement remboursé au client (en GNF).
   * 0 si décision = REJET.
   * Peut différer de montantConteste (remboursement partiel).
   * NULL jusqu'à la résolution.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  montantRembourse: number | null;

  /* ==========================================================
   * PREUVES
   * ========================================================== */

  /**
   * Liste des pièces justificatives soumises (photos, vidéos, docs).
   * Relation OneToMany vers DisputeEvidence.
   * Toutes les parties (client, entreprise, admin) peuvent ajouter des preuves.
   */
  @OneToMany(() => DisputeEvidence, evidence => evidence.dispute, {
    cascade: true,
    eager: false,
  })
  evidences: DisputeEvidence[];

  /* ==========================================================
   * DATES
   * ========================================================== */

  /**
   * Date d'ouverture du litige.
   * Doit être dans la fenêtre disputeWindowDays après DELIVERED.
   */
  @CreateDateColumn({ type: 'timestamp' })
  openedAt: Date;

  /**
   * Date de résolution (décision rendue).
   * NULL jusqu'à RESOLVED_CLIENT ou RESOLVED_SELLER.
   */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /**
   * Date de clôture définitive du litige.
   * Après clôture, le litige est archivé et ne peut plus être modifié.
   */
  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  /* ==========================================================
   * CHAMPS RESOLUTION ENGINE
   * ========================================================== */

  /**
   * UUID de la session de paiement liée.
   * Permet au RefundManager de retrouver la session pour le
   * remboursement provider-side (PaymentEngine.rembourser).
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  /**
   * Date limite d'instruction par l'admin (SLA 48h).
   * Calculée à l'ouverture : openedAt + disputeInstructionSlaHours.
   * Déclenchement d'une alerte si dépassée sans transition.
   */
  @Column({ type: 'timestamp', nullable: true })
  deadlineAt: Date | null;

  /**
   * Date d'escalade vers un super admin.
   * NULL si jamais escaladé.
   */
  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
