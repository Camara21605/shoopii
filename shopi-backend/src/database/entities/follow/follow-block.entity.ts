/* ============================================================
 * FICHIER : src/database/entities/follow/follow-block.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Gestion des blocages entre acteurs Shopi.
 *
 * Lorsqu’un acteur est bloqué :
 *
 *   ❌ impossible de suivre
 *   ❌ impossible d’envoyer une demande
 *   ❌ impossible d’envoyer des messages
 *   ❌ impossible de voir certaines données du profil
 *
 * ------------------------------------------------------------
 * EXEMPLE
 * ------------------------------------------------------------
 *
 * CLIENT A bloque ENTREPRISE B
 *
 * → B ne peut plus interagir avec A
 *
 * ------------------------------------------------------------
 * ARCHITECTURE
 * ------------------------------------------------------------
 *
 * Cette table suit exactement la même architecture que :
 *
 *   - follows
 *   - follow_requests
 *
 * Architecture polymorphique légère :
 *
 *   blockerType + blockerId
 *   blockedType + blockedId
 *
 * Sans relations TypeORM polymorphiques.
 *
 * ------------------------------------------------------------
 * PLACEMENT
 * ------------------------------------------------------------
 *
 * src/database/entities/follow/follow-block.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import {
  FollowerActorType,
  TargetActorType,
} from './follow.entity';

/* ============================================================
 * ENTITY
 * ============================================================ */

/**
 * ------------------------------------------------------------
 * CONTRAINTE D’UNICITÉ
 * ------------------------------------------------------------
 *
 * Empêche :
 *
 * CLIENT A bloque CLIENT B
 * CLIENT A bloque CLIENT B
 *
 * plusieurs fois.
 */
@Unique('UQ_follow_block_pair', [
  'blockerType',
  'blockerId',
  'blockedType',
  'blockedId',
])

/**
 * ------------------------------------------------------------
 * INDEXES DE PERFORMANCE
 * ------------------------------------------------------------
 */

@Index('IDX_follow_block_blocker', [
  'blockerType',
  'blockerId',
])

@Index('IDX_follow_block_blocked', [
  'blockedType',
  'blockedId',
])

@Entity('follow_blocks')
export class FollowBlock {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * BLOQUEUR
   * ========================================================== */

  /**
   * Type de l’acteur qui bloque.
   */
  @Column({
    type: 'enum',
    enum: FollowerActorType,
  })
  blockerType: FollowerActorType;

  /**
   * UUID du profil qui bloque.
   */
  @Column({
    type: 'uuid',
  })
  blockerId: string;

  /* ==========================================================
   * BLOQUÉ
   * ========================================================== */

  /**
   * Type de l’acteur bloqué.
   */
  @Column({
    type: 'enum',
    enum: TargetActorType,
  })
  blockedType: TargetActorType;

  /**
   * UUID du profil bloqué.
   */
  @Column({
    type: 'uuid',
  })
  blockedId: string;

  /* ==========================================================
   * MÉTADONNÉES
   * ========================================================== */

  /**
   * Raison interne du blocage.
   *
   * Exemples :
   *  - spam
   *  - harcèlement
   *  - fraude
   *  - comportement abusif
   */
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  reason: string | null;

  /* ==========================================================
   * DATE
   * ========================================================== */

  /**
   * Date de création du blocage.
   */
  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;
}