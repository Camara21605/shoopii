import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Journal d'authentification — enregistre chaque événement de sécurité critique.
 * Utilisé pour la détection d'anomalies, les audits et la conformité.
 *
 * Conservation recommandée : 90 jours (purger via cron job).
 */
@Entity('auth_logs')
@Index(['userId'])
@Index(['email'])
@Index(['event', 'createdAt'])
export class AuthLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null pour les tentatives avec un email inexistant */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 254 })
  email: string | null;

  /**
   * Type d'événement :
   * login_success | login_failed | login_locked | logout
   * register_success | register_failed
   * otp_sent | otp_success | otp_failed | otp_expired
   * password_reset_success | password_reset_failed
   * token_refreshed | token_refresh_failed | tokens_revoked
   * account_locked | account_banned | account_suspended
   */
  @Column({ type: 'varchar', length: 64 })
  event: string;

  @Column({ type: 'varchar', nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true, length: 512 })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true, length: 32 })
  role: string | null;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  failureReason: string | null;

  /** Corrélation avec X-Request-Id pour le tracing */
  @Column({ type: 'varchar', nullable: true, length: 64 })
  requestId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
