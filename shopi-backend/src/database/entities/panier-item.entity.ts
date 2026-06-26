/* ============================================================
 * FICHIER : src/database/entities/panier-item.entity.ts
 * Table   : panier_items
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User }    from './user.entity';
import { Product } from './entreprise.table/product.entity';

@Entity('panier_items')
@Index(['userId', 'produitId'], { unique: true })   // 1 ligne par produit/variante
export class PanierItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── FK Utilisateur ── */
  @Column({ type: 'varchar', length: 36 })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /* ── FK Produit ── */
  @Column({ type: 'varchar', length: 36 })
  produitId: string;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produitId' })
  produit: Product;

  /* ── Quantité ── */
  @Column({ type: 'int', default: 1 })
  qty: number;

  /* ── Variante sélectionnée ── */
  @Column({ type: 'varchar', length: 100, nullable: true })
  variante: string | null;

  /* ── Timestamps ── */
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}