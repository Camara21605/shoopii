/* ============================================================
 * FICHIER : src/database/entities/product-spec.entity.ts
 * RÔLE    : Caractéristiques techniques d'un produit.
 *           Tableau clé/valeur → onglet "Caractéristiques"
 *           de la fiche produit.
 *
 * Exemple :
 *   cle    = 'Puce / Processeur'
 *   valeur = 'A17 Pro (3 nm)'
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_specs')
export class ProductSpec {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nom de la caractéristique (ex: Puce / Processeur) */
  @Column({ type: 'varchar', length: 150 })
  cle: string;

  /** Valeur de la caractéristique (ex: A17 Pro 3nm) */
  @Column({ type: 'varchar', length: 500 })
  valeur: string;

  /** Ordre d'affichage dans le tableau */
  @Column({ type: 'int', default: 0 })
  ordre: number;

  /** Produit auquel cette spec appartient */
  @ManyToOne(() => Product, p => p.specs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

 

  @CreateDateColumn()
  createdAt: Date;
}