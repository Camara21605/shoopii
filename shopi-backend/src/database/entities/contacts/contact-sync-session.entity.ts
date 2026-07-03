/* ============================================================
 * FICHIER : contact-sync-session.entity.ts
 *
 * RÔLE : Méta-données d'une session de synchronisation de contacts.
 *        Permet de détecter les abus (syncs trop fréquentes) et
 *        de fournir des statistiques aux utilisateurs.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum SyncStatus {
  COMPLETED = 'completed',
  FAILED    = 'failed',
  PARTIAL   = 'partial',
}

@Index('IDX_sync_user_date', ['userId', 'createdAt'])
@Entity('contact_sync_sessions')
export class ContactSyncSession {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* Utilisateur qui a déclenché la sync */
  @Column({ type: 'uuid' })
  userId: string;

  /* Nombre de hashes envoyés par le client */
  @Column({ type: 'int', default: 0 })
  contactsSent: number;

  /* Nombre de matches trouvés (utilisateurs Shopi) */
  @Column({ type: 'int', default: 0 })
  matchesFound: number;

  /* Nouveaux matches (pas connus lors de la dernière sync) */
  @Column({ type: 'int', default: 0 })
  newMatches: number;

  /* Durée totale de la sync en millisecondes */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.COMPLETED })
  status: SyncStatus;

  /* Message d'erreur si status = FAILED */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
