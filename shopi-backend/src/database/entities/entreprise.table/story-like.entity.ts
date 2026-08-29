/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/story-like.entity.ts
 * RÔLE    : "J'aime" (❤️) d'un client sur une story (ProductStory) —
 *           permet à l'entreprise de voir qui a réagi à sa story,
 *           comme les réactions sur un statut WhatsApp.
 *
 * Une ligne par (storyId, likerId) — re-liker après avoir retiré
 * son "j'aime" recrée juste la ligne (toggle), jamais de doublon.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Unique, Index,
} from 'typeorm';

@Entity('story_likes')
@Unique(['storyId', 'likerId'])
export class StoryLike {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  storyId: string;

  @Column({ type: 'uuid' })
  likerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
