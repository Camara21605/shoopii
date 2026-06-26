/* ============================================================
 * FICHIER : src/database/entities/follow/follow.entity.ts
 *
 * ✅ AJOUT : isSubscribed (boolean)
 *    true  → acteur abonné
 *    false → acteur désabonné (ligne conservée)
 *
 * AVANTAGE par rapport à create/delete :
 *   - La ligne persiste → plus de problème de timing au reload
 *   - UPDATE au lieu de INSERT/DELETE → plus simple et rapide
 *   - isSuivi = WHERE isSubscribed = true (requête directe)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  Index, Unique,
} from 'typeorm';

/* ── Enums ── */
export enum FollowerActorType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
}

export enum TargetActorType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
}

export enum FollowStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',   // conservé pour compatibilité
}

/* ── Contrainte unicité ── */
@Unique('UQ_follow_pair', ['followerType','followerId','targetType','targetId'])
@Index('IDX_follow_follower', ['followerType','followerId'])
@Index('IDX_follow_target',   ['targetType','targetId'])

@Entity('follows')
export class Follow {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── Follower ── */
  @Column({ type:'enum', enum:FollowerActorType })
  followerType: FollowerActorType;

  @Column({ type:'uuid' })
  followerId: string;

  /* ── Cible ── */
  @Column({ type:'enum', enum:TargetActorType })
  targetType: TargetActorType;

  @Column({ type:'uuid' })
  targetId: string;

  /* ══════════════════════════════════════════════════════════
   * ✅ CHAMP CLÉ : isSubscribed
   *
   * true  → l'utilisateur EST abonné
   * false → l'utilisateur N'EST PLUS abonné (mais la ligne reste)
   *
   * TOGGLE :
   *   - 1er clic  → INSERT { isSubscribed: true }  OU UPDATE SET isSubscribed = true
   *   - 2ème clic → UPDATE SET isSubscribed = false
   *   - 3ème clic → UPDATE SET isSubscribed = true
   *   … etc.
   ══════════════════════════════════════════════════════════ */
  @Column({ type:'boolean', default: true })
  @Index('IDX_follow_subscribed')
  isSubscribed: boolean;

  /* Conservé pour compatibilité */
  @Column({ type:'enum', enum:FollowStatus, default:FollowStatus.ACTIVE })
  status: FollowStatus;

  @Column({ type:'boolean', default:true })
  notificationsEnabled: boolean;

  @Column({ type:'timestamp', nullable:true })
  followedAt: Date | null;

  @Column({ type:'timestamp', nullable:true })
  unfollowedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}