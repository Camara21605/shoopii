/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/product-cooccurrence.entity.ts
 *
 * RÔLE : Cache "market-basket" — pour un produit donné, les autres
 *        produits le plus souvent achetés DANS LA MÊME commande.
 *        Recalculé périodiquement par ExploreScheduler, jamais à la
 *        volée (le self-join source est coûteux sur une grande table
 *        commande_items).
 *
 * Une ligne = une paire orientée (productId → relatedProductId).
 * Seul le top N par productId est conservé (COOCCURRENCE_TOP_N),
 * pour borner la taille de la table — voir explore.scheduler.ts.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index, Unique, UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_cooccurrence')
@Unique(['productId', 'relatedProductId'])
export class ProductCooccurrence {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column({ name: 'productId', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'relatedProductId' })
  relatedProduct: Product;

  @Index()
  @Column({ name: 'relatedProductId', type: 'uuid' })
  relatedProductId: string;

  /** Nombre de commandes distinctes contenant les deux produits ensemble */
  @Column({ type: 'int', default: 0 })
  coOccurrenceCount: number;

  @UpdateDateColumn()
  computedAt: Date;
}
