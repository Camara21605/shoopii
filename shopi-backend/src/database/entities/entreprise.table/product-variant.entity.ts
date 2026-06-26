/* ============================================================
 * FICHIER : src/database/entities/product-variant.entity.ts
 * RÔLE    : Variantes d'un produit (Couleur, Stockage, Taille…)
 *
 * Exemple :
 *   type = 'Couleur'
 *   vals = 'Noir, Blanc, Bleu Titanium'
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Type de variante (Couleur, Stockage, RAM, Taille, Résolution, Matière) */
  @Column({ type: 'varchar', length: 50 })
  type: string;

  /** Valeurs séparées par virgule (ex: "Noir, Blanc, Bleu") */
  @Column({ type: 'varchar', length: 500 })
  vals: string;

  /** Produit auquel cette variante appartient */
  @ManyToOne(() => Product, p => p.variantes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ name: 'productId', type: 'varchar', length: 36 })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}