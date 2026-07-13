/* ================================================================
 * FICHIER : src/database/entities/geo/geo-base.entity.ts
 *
 * Classe de base non-entité partagée par les 6 niveaux géo.
 * TypeORM hérite automatiquement les @Column des classes parentes
 * tant que la classe parente n'est pas elle-même annotée @Entity.
 * ================================================================ */

import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export class GeoBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 50, unique: true })
  code: string;

  @Index()
  @Column({ length: 255 })
  nom: string;

  @Column({ type: 'text', nullable: true, default: '' })
  description: string;

  @Index()
  @Column({ type: 'enum', enum: ['actif', 'inactif'], default: 'actif' })
  statut: 'actif' | 'inactif';

  /* parentId stocké comme UUID brut — pas de FK formelle car les niveaux
   * référencent des tables différentes (pays ← region ← prefecture …). */
  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  @Column({ length: 255, default: 'Système' })
  auteur: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
