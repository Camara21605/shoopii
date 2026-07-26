/* ============================================================
 * FICHIER : src/database/entities/paiement/dispute-evidence.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Pièce justificative (preuve) soumise dans le cadre d'un litige.
 *
 * POURQUOI UNE TABLE SÉPARÉE
 * ─────────────────────────────────────────────────────────────
 * 1. Un litige peut avoir plusieurs preuves (photos, vidéos, docs)
 * 2. Les preuves peuvent être soumises par différentes parties
 *    (client, entreprise, admin)
 * 3. Chaque preuve a des métadonnées propres (type, taille, description)
 * 4. Les URLs Cloudinary doivent être stockées individuellement
 *    pour pouvoir être invalidées ou supprimées séparément
 *
 * ENTITÉS PARENTES
 * ─────────────────────────────────────────────────────────────
 *  Dispute → parent direct (ManyToOne)
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule → création lors d'un litige
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/dispute-evidence.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { Dispute } from './dispute.entity';

/* ============================================================
 * ENUMS
 * ============================================================ */

/** Type de fichier soumis comme preuve. */
export enum EvidenceType {
  /** Photo du colis, du produit endommagé, de la livraison */
  PHOTO       = 'photo',
  /** Vidéo de déballage ou de constat de problème */
  VIDEO       = 'video',
  /** Document PDF (facture, bon de livraison, etc.) */
  DOCUMENT    = 'document',
  /** Capture d'écran (conversation, confirmation, etc.) */
  SCREENSHOT  = 'screenshot',
  /** Audio (enregistrement d'une conversation) */
  AUDIO       = 'audio',
}

/** Partie ayant soumis cette preuve. */
export enum EvidenceSubmittedBy {
  CLIENT      = 'client',
  ENTREPRISE  = 'entreprise',
  LIVREUR     = 'livreur',
  ADMIN       = 'admin',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_evidence_dispute', ['disputeId'])
@Index('IDX_evidence_submitted_by', ['submittedBy'])

@Entity('dispute_evidences')
export class DisputeEvidence {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * LITIGE PARENT
   * ========================================================== */

  /**
   * Dispute à laquelle appartient cette preuve.
   * Suppression en cascade si le Dispute est supprimé
   * (cas rare, uniquement par SuperAdmin).
   */
  @ManyToOne(() => Dispute, dispute => dispute.evidences, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @Column({ name: 'disputeId', type: 'uuid' })
  disputeId: string;

  /* ==========================================================
   * AUTEUR
   * ========================================================== */

  /** UserId de la personne ayant soumis cette preuve. */
  @Column({ type: 'uuid' })
  uploadedByUserId: string;

  /** Rôle de la personne ayant soumis cette preuve. */
  @Column({ type: 'enum', enum: EvidenceSubmittedBy })
  submittedBy: EvidenceSubmittedBy;

  /* ==========================================================
   * FICHIER
   * ========================================================== */

  /** Type de fichier soumis. */
  @Column({ type: 'enum', enum: EvidenceType })
  type: EvidenceType;

  /**
   * URL Cloudinary du fichier uploadé.
   * Accessible uniquement par les parties autorisées (client, admin, entreprise).
   */
  @Column({ type: 'varchar', length: 1000 })
  url: string;

  /**
   * Nom original du fichier (pour affichage dans l'interface admin).
   * Ex : "photo_colis_endommage.jpg"
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string | null;

  /**
   * Taille du fichier en octets.
   * Utile pour limiter les uploads abusifs.
   */
  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

  /**
   * Description courte de la preuve fournie par son auteur.
   * Ex : "Photo du colis reçu, clairement endommagé"
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /* ==========================================================
   * VALIDATION PAR L'ADMIN
   * ========================================================== */

  /**
   * Date à laquelle un admin a validé cette preuve.
   * NULL → preuve soumise mais pas encore examinée.
   */
  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  /** UserId de l'admin qui a validé la preuve. */
  @Column({ type: 'uuid', nullable: true })
  validatedByUserId: string | null;

  /* ==========================================================
   * DATE (immuable)
   * ========================================================== */

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
