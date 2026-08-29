/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/story-view.entity.ts
 * RÔLE    : Trace des vues individuelles d'une story (ProductStory)
 *           par un utilisateur connecté — permet à l'entreprise de
 *           voir qui a vu sa story (comme Facebook/Instagram).
 *
 * Une ligne par (storyId, viewerId) — une revue met juste à jour
 * viewedAt au lieu de dupliquer.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique, Index,
} from 'typeorm';

@Entity('story_views')
@Unique(['storyId', 'viewerId'])
export class StoryView {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  storyId: string;

  @Column({ type: 'uuid' })
  viewerId: string;

  @CreateDateColumn()
  createdAt: Date;

  /** Date de la dernière vue (mise à jour à chaque revisionnage) */
  @UpdateDateColumn()
  viewedAt: Date;
}
