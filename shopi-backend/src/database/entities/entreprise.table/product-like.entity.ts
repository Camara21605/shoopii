/* ============================================================
 * FICHIER : src/database/entities/product-like.entity.ts
 * RÔLE    : Likes / J'aime sur les produits par les clients.
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  - Un client ne peut liker qu'UNE FOIS un produit donné
 *    → Contrainte UNIQUE sur (clientId, productId)
 *  - Un like supprimé = unlike (toggle)
 *  - Le compteur likes est dénormalisé dans Product.likesCount
 *    pour des performances de lecture optimales
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn,
  ManyToOne, JoinColumn, Column,
  CreateDateColumn, Unique, Index,
} from 'typeorm';
import { Client }  from '../profiles/client-profile.entity';
import { Product } from './product.entity';

@Entity('product_likes')
@Unique(['clientId', 'productId'])   // ← UN seul like par client par produit
export class ProductLike {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation Client ────────────────────────────────────────────────────────

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'CASCADE',   // Si le client est supprimé → ses likes aussi
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Index()
  @Column({ name: 'clientId', type: 'uuid' })
  clientId: string;

  // ── Relation Produit ───────────────────────────────────────────────────────

  @ManyToOne(() => Product, product => product.likes, {
    nullable: false,
    onDelete: 'CASCADE',   // Si le produit est supprimé → ses likes aussi
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column({ name: 'productId', type: 'uuid' })
  productId: string;

  // ── Timestamp ──────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;
}