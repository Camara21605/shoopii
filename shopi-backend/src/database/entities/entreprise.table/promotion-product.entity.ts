/* ============================================================
 * FICHIER : src/database/entities/promotion-product.entity.ts
 *
 * RÔLE    : Table de jointure entre Promotion et Product.
 *           Utilisée UNIQUEMENT quand scope = PRODUCTS.
 *           Chaque ligne indique qu'un produit est ciblé
 *           par une promotion spécifique.
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  - Contrainte UNIQUE sur (promotionId, productId)
 *    → un même produit ne peut pas être ajouté deux fois à la même promo
 *  - onDelete CASCADE des deux côtés :
 *    → si la promo est supprimée, les lignes de jointure le sont aussi
 *    → si le produit est supprimé, il est retiré des promos
 *  - Vérification côté service que le produit appartient bien
 *    à la même entreprise que la promotion
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Unique,
} from 'typeorm';
import { Promotion } from './promotion.entity';
import { Product }   from './product.entity';

@Entity('promotion_products')
@Unique(['promotionId', 'productId'])   // ← UN produit par promo, une seule fois
export class PromotionProduct {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation Promotion ────────────────────────────────────────────────────

  @ManyToOne(() => Promotion, promo => promo.produits, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column({ name: 'promotionId', type: 'varchar', length: 36 })
  promotionId: string;

  // ── Relation Product ──────────────────────────────────────────────────────

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,              // ← charger le produit automatiquement
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ name: 'productId', type: 'varchar', length: 36 })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}