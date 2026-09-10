/* ============================================================
 * FICHIER : src/database/entities/admin-communication-settings.entity.ts
 *
 * Préférences de communication d'un administrateur de zone :
 *   - message personnalisé + signature ajoutés aux emails
 *     d'invitation qu'il envoie (voir AdminCodesService.sendCodeByEmail)
 *   - modèles de notification personnalisés qui remplacent le texte
 *     par défaut envoyé aux acteurs lors d'une validation/refus/
 *     suspension/avertissement/réactivation (voir NotificationEventService)
 *
 * Table à une ligne par admin (singleton par userId).
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index,
} from 'typeorm';

/** Clés de notification personnalisables — voir NotificationEventService. */
export interface AdminNotifTemplates {
  approved?:     string;
  rejected?:     string;
  suspended?:    string;
  warned?:       string;
  reactivated?:  string;
}

@Entity('admin_communication_settings')
export class AdminCommunicationSettings {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_admin_comm_userId', { unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  /** Paragraphe libre inséré dans les emails d'invitation (codes de création). */
  @Column({ type: 'text', nullable: true })
  invitationMessage: string | null;

  /** Signature ajoutée en fin d'email d'invitation (ex: nom + fonction). */
  @Column({ type: 'varchar', length: 300, nullable: true })
  signature: string | null;

  /**
   * Textes de notification personnalisés, indexés par événement
   * (approved/rejected/suspended/warned/reactivated). Variables
   * disponibles selon l'événement : {{acteur}}, {{motif}}.
   * Une clé absente ou vide → le texte par défaut de la plateforme est utilisé.
   */
  @Column({ type: 'json', nullable: true })
  notifTemplates: AdminNotifTemplates | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
