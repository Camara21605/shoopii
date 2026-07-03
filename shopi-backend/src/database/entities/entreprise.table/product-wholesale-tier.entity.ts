/* ============================================================
 * FICHIER : src/database/entities/product-wholesale-tier.entity.ts
 * RÔLE    : Palier de prix dégressif pour la vente en gros d'un
 *           produit. Un produit en gros peut avoir plusieurs
 *           paliers, ex :
 *             10 à 49 unités  → 50 000 GNF / unité
 *             50 à 99 unités  → 45 000 GNF / unité
 *             100+ unités     → 40 000 GNF / unité (quantiteMax = null)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_wholesale_tiers')
export class ProductWholesaleTier {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Quantité minimum pour bénéficier de ce palier */
  @Column({ type: 'int' })
  quantiteMin: number;

  /** Quantité maximum du palier — null = "et plus" (dernier palier) */
  @Column({ type: 'int', nullable: true })
  quantiteMax: number | null;

  /** Prix unitaire en GNF applicable pour ce palier */
  @Column({ type: 'bigint' })
  prixUnitaire: number;

  /** Ordre d'affichage des paliers (croissant par quantité) */
  @Column({ type: 'int', default: 0 })
  ordre: number;

  /** Produit auquel ce palier appartient */
  @ManyToOne(() => Product, p => p.wholesaleTiers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ name: 'productId', type: 'uuid' })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}
