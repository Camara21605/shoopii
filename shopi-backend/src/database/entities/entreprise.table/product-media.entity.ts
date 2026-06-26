/* ============================================================
 * FICHIER : src/database/entities/product-media.entity.ts
 * RÔLE    : Médias d'un produit : images, vidéos, fichiers.
 *           ordre = 0 → média principal.
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { Product } from './product.entity';

/** Types de médias disponibles */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  FILE  = 'file',
}

@Entity('product_media')
export class ProductMedia {

  // ─────────────────────────────────────────────
  // IDENTIFIANT
  // ─────────────────────────────────────────────
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─────────────────────────────────────────────
  // TYPE DE MÉDIA
  // ─────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: MediaType,
    default: MediaType.IMAGE,
  })
  type: MediaType;

  // ─────────────────────────────────────────────
  // FICHIER
  // ─────────────────────────────────────────────
  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  // ─────────────────────────────────────────────
  // ORDRE D'AFFICHAGE
  // ─────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  ordre: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alt: string | null;

  // ─────────────────────────────────────────────
  // RELATION PRODUIT (IMPORTANT FIX)
  // ─────────────────────────────────────────────
  @ManyToOne(() => Product, (product) => product.media, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  /**
   * ⚠️ IMPORTANT :
   * On garde productId MAIS sans insert:false/update:false
   * Sinon TypeORM + QueryRunner peut casser les FK
   */
  @Column({
    name: 'productId',
    type: 'uuid',
  })
  productId: string;

  // ─────────────────────────────────────────────
  // TIMESTAMP
  // ─────────────────────────────────────────────
  @CreateDateColumn()
  createdAt: Date;
}