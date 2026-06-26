/* ============================================================
 * FICHIER : src/database/entities/commande/commande-item.entity.ts
 * ORDRE   : 2 — Dépend de Commande et Product
 *
 * RÔLE    : Snapshot d'un produit dans une commande.
 *
 * ─── POURQUOI UN SNAPSHOT ? ──────────────────────────────────
 *
 *  Si le prix du produit change après la commande,
 *  on conserve le prix au moment de l'achat.
 *
 *  On stocke aussi le nom et l'image du produit
 *  pour afficher l'historique même si le produit
 *  est supprimé de la boutique.
 *
 * ─── EXEMPLE ─────────────────────────────────────────────────
 *
 *  Client commande 2x iPhone 15 Pro à 12 500 000 GNF
 *
 *  CommandeItem {
 *    quantite:     2
 *    prixUnitaire: 12_500_000
 *    sousTotal:    25_000_000
 *    nomProduit:   "iPhone 15 Pro 256GB"
 *    imageProduit: "https://..."
 *    varianteChoisie: "Noir Titanium / 256GB"
 *  }
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';

import { Commande } from './commande.entity';
import { Product }  from '../entreprise.table/product.entity';

@Entity('commande_items')
export class CommandeItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─────────────────────────────────────────────────────────────
  // RELATIONS
  // ─────────────────────────────────────────────────────────────

  /** Commande parente */
  @ManyToOne(() => Commande, commande => commande.items, {
    nullable: false,
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'commandeId' })
  commande: Commande;

  @Index()
  @Column({ name: 'commandeId', type: 'varchar', length: 36 })
  commandeId: string;

  /**
   * Référence vers le produit original.
   * onDelete SET NULL : si le produit est supprimé,
   * on conserve le snapshot (nom, prix, image).
   */
  @ManyToOne(() => Product, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Promise<Product> | Product | null;

  @Column({ name: 'productId', type: 'varchar', length: 36, nullable: true })
  productId: string | null;

  // ─────────────────────────────────────────────────────────────
  // SNAPSHOT DU PRODUIT AU MOMENT DE LA COMMANDE
  // ─────────────────────────────────────────────────────────────

  /** Nom du produit — conservé si le produit est supprimé */
  @Column({ type: 'varchar', length: 255 })
  nomProduit: string;

  /** Image principale du produit (URL snapshot) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  imageProduit: string | null;

  /** Variante choisie par le client (ex: "Noir Titanium / 256GB") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  varianteChoisie: string | null;

  // ─────────────────────────────────────────────────────────────
  // QUANTITÉ & PRIX
  // ─────────────────────────────────────────────────────────────

  /** Quantité commandée */
  @Column({ type: 'int', default: 1 })
  quantite: number;

  /** Prix unitaire au moment de la commande (en GNF) */
  @Column({ type: 'bigint' })
  prixUnitaire: number;

  /** Ancien prix barré au moment de la commande (en GNF) */
  @Column({ type: 'bigint', nullable: true })
  prixAncien: number | null;

  /** Sous-total = quantite × prixUnitaire */
  @Column({ type: 'bigint' })
  sousTotal: number;

  // ─────────────────────────────────────────────────────────────
  // TIMESTAMP
  // ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;
}