/* ============================================================
 * FICHIER  : src/database/entities/support/attachment.entity.ts
 * ROLE     : Pièce jointe d'un message de ticket support.
 *
 * RESPONSABILITES :
 *   - Remplace le champ JSON `attachments` dans SupportMessage.
 *   - Stocke les métadonnées du fichier : nom, MIME, taille, extension.
 *   - Conserve le publicId Cloudinary pour la suppression distante.
 *   - Trace l'auteur de l'upload (uploadedById / uploadedByRole).
 *   - Soft delete : un attachment supprimé conserve le publicId pour que
 *     AttachmentService puisse supprimer le fichier dans Cloudinary.
 *
 * DEPENDANCES :
 *   - SupportMessage (ManyToOne — createForeignKeyConstraints: false)
 *
 * CONTRAINTES METIER :
 *   - sizeBytes ≤ 10 485 760 (10 MB) — validé dans AttachmentService
 *   - mimeType  ∈ ALLOWED_ATTACHMENT_MIME_TYPES (liste dans attachment.constants.ts)
 *
 * INDEXES :
 *   - messageId    → récupérer les pièces jointes d'un message
 *   - publicId     → retrouver l'asset Cloudinary pour suppression/déplacement
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  ManyToOne, JoinColumn,
  CreateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { SupportMessage } from './support-message.entity';

@Entity('support_attachments')
export class Attachment {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Lien vers le message parent ─────────────────────────── */

  @ManyToOne(() => SupportMessage, m => m.attachments, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'messageId' })
  message!: SupportMessage;

  @Index()
  @Column({ type: 'uuid' })
  messageId!: string;

  /* ── Référence Cloudinary ─────────────────────────────────── */

  /* Identifiant public dans Cloudinary (ex: "shopi/support/2026/01/uuid").
   * Utilisé pour cloudinary.uploader.destroy(publicId) lors de la suppression.
   * Indexé pour retrouver l'asset depuis un webhook Cloudinary. */
  @Index()
  @Column({ type: 'varchar', length: 500 })
  publicId!: string;

  /* URL HTTPS signée Cloudinary — peut expirer si le bucket est privé.
   * Stocker l'URL permet l'affichage sans appel API supplémentaire
   * tant que les assets sont publics. */
  @Column({ type: 'varchar', length: 1000 })
  secureUrl!: string;

  /* ── Métadonnées du fichier ───────────────────────────────── */

  /* Nom original du fichier tel que soumis par l'utilisateur.
   * Affiché dans l'UI — non utilisé pour le stockage (publicId fait foi). */
  @Column({ type: 'varchar', length: 500 })
  originalFilename!: string;

  /* Type MIME validé à l'upload (ex: "application/pdf", "image/png").
   * Permet de rendre une icône adaptée dans l'UI. */
  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  /* Extension en minuscules sans point (ex: "pdf", "png", "jpg").
   * Déduite du mimeType — jamais du nom de fichier (risque d'usurpation). */
  @Column({ type: 'varchar', length: 10 })
  extension!: string;

  /* Taille en octets — validée ≤ 10 MB avant upload.
   * Affiché dans l'UI : "2.3 MB", "450 KB". */
  @Column({ type: 'int' })
  sizeBytes!: number;

  /* ── Audit de l'uploader ──────────────────────────────────── */

  /* userId (UUID) de la personne qui a uploadé ce fichier.
   * Requis pour l'audit et la limitation de quota futur. */
  @Column({ type: 'uuid' })
  uploadedById!: string;

  /* Rôle JWT au moment de l'upload — aide à diagnostiquer les abus.
   * Ex: 'client', 'agent', 'company'. */
  @Column({ type: 'varchar', length: 30 })
  uploadedByRole!: string;

  /* ── Timestamps ───────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt!: Date;

  /* Soft delete — conservé pour que AttachmentService puisse appeler
   * cloudinary.uploader.destroy(publicId) même après suppression logique.
   * Un cron peut ensuite purger les assets Cloudinary orphelins. */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
