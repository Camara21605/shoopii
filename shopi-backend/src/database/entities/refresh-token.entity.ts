import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Refresh tokens — rotation à chaque utilisation (Refresh Token Rotation).
 *
 * Sécurité :
 *   - Le token brut n'est JAMAIS stocké en base (seulement son hash SHA-256).
 *   - Un token révoqué ou expiré déclenche une révocation de toute la chaîne.
 *   - replacedByTokenId permet de détecter la réutilisation d'un ancien token
 *     (signe d'un vol) et de révoquer toute la famille de tokens.
 *
 * Durée de vie :
 *   - Session normale   : 24 heures
 *   - Session persistante (rememberMe) : 7 jours
 *
 * Conservation recommandée : supprimer les tokens expirés via cron.
 */
@Entity('refresh_tokens')
@Index(['userId'])
@Index(['tokenHash'], { unique: true })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 du token brut — jamais le token en clair */
  @Column({ type: 'varchar', select: false, length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true, length: 512 })
  userAgent: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  /** ID du token qui a remplacé celui-ci lors de la rotation */
  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
