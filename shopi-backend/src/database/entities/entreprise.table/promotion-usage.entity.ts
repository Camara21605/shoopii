/* ============================================================
 * FICHIER : src/database/entities/promotion-usage.entity.ts
 *
 * RÔLE    : Historique de chaque utilisation d'une promotion.
 *           Créé lors du passage d'une commande avec code promo.
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  - Contrainte UNIQUE sur (clientId, promotionId) si maxParClient = 1
 *    → vérifiée côté SERVICE (pas en BDD, car maxParClient peut être > 1)
 *  - montantReduit = montant réellement déduit de la commande
 *  - orderId lié à la commande où le code a été utilisé
 *  - Ne jamais supprimer ces lignes — audit complet requis
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Promotion } from './promotion.entity';
import { Client }    from '../profiles/client-profile.entity';

@Entity('promotion_usages')
export class PromotionUsage {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation Promotion ────────────────────────────────────────────────────

  @ManyToOne(() => Promotion, promo => promo.usages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Index()
  @Column({ name: 'promotionId', type: 'uuid' })
  promotionId: string;

  // ── Relation Client ───────────────────────────────────────────────────────

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Index()
  @Column({ name: 'clientId', type: 'uuid' })
  clientId: string;

  // ── Commande liée ────────────────────────────────────────────────────────

  /**
   * UUID de la commande où le code a été appliqué.
   * Pas de relation TypeORM directe pour éviter les dépendances circulaires.
   * Résolu via orderId en string.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  // ── Montant de la réduction ───────────────────────────────────────────────

  /**
   * Montant exact déduit de la commande en GNF.
   * Calculé au moment du checkout et figé ici pour l'audit.
   * Ex: promo -20% sur commande de 50 000 GNF → montantReduit = 10 000
   */
  @Column({ type: 'bigint', default: 0 })
  montantReduit: number;

  @CreateDateColumn()
  createdAt: Date;
}