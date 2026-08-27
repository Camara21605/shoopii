/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/trending-product.entity.ts
 *
 * RÔLE : Cache des scores de "tendance" par produit, recalculé
 *        périodiquement par ExploreScheduler (voir explore.scheduler.ts)
 *        — jamais calculé à la volée dans une requête HTTP.
 *
 * score = ventes(fenêtre) * TRENDING_WEIGHTS.sales
 *       + likes(fenêtre)  * TRENDING_WEIGHTS.likes
 *
 * Une ligne par produit ayant au moins un signal (vente ou like)
 * dans la fenêtre glissante — les autres produits n'apparaissent
 * simplement pas dans "Tendances".
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index, UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('trending_products')
export class TrendingProduct {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index({ unique: true })
  @Column({ name: 'productId', type: 'uuid' })
  productId: string;

  /** Quantité vendue dans la fenêtre glissante (commande_items.quantite, ventes non annulées/remboursées) */
  @Column({ type: 'int', default: 0 })
  salesCount: number;

  /** Nombre de likes reçus dans la fenêtre glissante */
  @Column({ type: 'int', default: 0 })
  likesCount: number;

  /** Score composite pondéré — voir explore.constants.ts */
  @Index()
  @Column({ type: 'float', default: 0 })
  score: number;

  /** Taille de la fenêtre glissante utilisée pour ce calcul (jours) */
  @Column({ type: 'int' })
  windowDays: number;

  @UpdateDateColumn()
  computedAt: Date;
}
