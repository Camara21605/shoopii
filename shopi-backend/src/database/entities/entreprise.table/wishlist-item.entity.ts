/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/wishlist-item.entity.ts
 * RÔLE    : Liste de souhaits (save-for-later) d'un client.
 *
 * DISTINCT de ProductLike (❤️) volontairement : les likes sont un
 * signal social/public agrégé dans le score "tendances" (voir
 * ExploreScheduler) et déclenchent une notification au vendeur — la
 * liste de souhaits est une liste personnelle privée, sans effet de
 * bord public, contrôlée par Client.privacySettings.wishlist (section
 * "Confidentialité du profil" des paramètres du compte).
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  - Un client ne peut ajouter qu'UNE FOIS un produit donné
 *    → Contrainte UNIQUE sur (clientId, productId)
 *  - Retrait = suppression de la ligne (toggle)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn,
  ManyToOne, JoinColumn, Column,
  CreateDateColumn, Unique, Index,
} from 'typeorm';
import { Client }  from '../profiles/client-profile.entity';
import { Product } from './product.entity';

@Entity('wishlist_items')
@Unique(['clientId', 'productId'])
export class WishlistItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Index()
  @Column({ name: 'clientId', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column({ name: 'productId', type: 'uuid' })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}
