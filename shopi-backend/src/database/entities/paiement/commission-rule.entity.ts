/* ============================================================
 * FICHIER : src/database/entities/paiement/commission-rule.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Entité de versionnage des règles de commission.
 *
 * PROBLÈME RÉSOLU
 * ─────────────────────────────────────────────────────────────
 * Si le SuperAdmin modifie les taux de commission dans PlatformSettings,
 * comment sait-on quels taux ont été utilisés pour une commande passée
 * 6 mois auparavant ? Sans versionnage, c'est impossible.
 *
 * SOLUTION
 * ─────────────────────────────────────────────────────────────
 * Chaque fois que les paramètres de commission changent dans
 * PlatformSettings, une nouvelle CommissionRule est créée automatiquement
 * avec les valeurs en vigueur à cet instant.
 *
 * La CommissionRule active est référencée par PaiementDistribution.
 * Même des années plus tard, on peut retrouver exactement quels
 * taux ont été appliqués pour n'importe quelle distribution.
 *
 * CYCLE DE VIE
 * ─────────────────────────────────────────────────────────────
 *  1. SuperAdmin modifie PlatformSettings (commission)
 *  2. PlatformSettingsService crée une nouvelle CommissionRule (isActive = true)
 *  3. L'ancienne CommissionRule passe à isActive = false + deactivatedAt = now
 *  4. Les nouvelles commandes utilisent la nouvelle CommissionRule
 *  5. Les commandes en cours conservent leur commissionRuleId d'origine
 *
 * ENTITÉS QUI L'UTILISENT
 * ─────────────────────────────────────────────────────────────
 *  PaiementDistribution → commissionRuleId (quelle règle a été utilisée)
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule   → lit la règle active lors d'un paiement
 *  AdminModule      → permet au SuperAdmin de consulter l'historique
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/commission-rule.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENTITY
 * ============================================================ */

/**
 * Index sur isActive pour récupérer rapidement la règle en vigueur.
 * Il n'y a qu'une seule CommissionRule active à la fois.
 */
@Index('IDX_commission_rule_active', ['isActive'])
@Index('IDX_commission_rule_version', ['version'])

@Entity('commission_rules')
export class CommissionRule {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  /** UUID unique de cette règle. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * VERSIONNING
   * ========================================================== */

  /**
   * Numéro de version séquentiel (1, 2, 3…).
   * Incrémenté automatiquement à chaque changement.
   * Permet de trier les règles chronologiquement.
   */
  @Column({ type: 'int', default: 1 })
  version: number;

  /**
   * Libellé lisible de cette version.
   * Exemple : "Taux standards Juillet 2026", "Promotion 4ème trimestre 2026"
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label: string | null;

  /**
   * Indique si cette règle est celle actuellement en vigueur.
   * Une seule peut être active à la fois.
   * Les autres ont isActive = false.
   */
  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  /**
   * Note explicative sur pourquoi ce changement a été effectué.
   * Obligatoirement renseigné par le SuperAdmin lors d'un changement.
   * Exemple : "Ajustement suite à accord partenariat Q3 2026"
   */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /* ==========================================================
   * COMMISSION PRODUIT
   * ========================================================== */

  /**
   * Taux brut de commission appliqué sur le sousTotal des produits (%).
   * Snapshot de PlatformSettings.tauxCommissionProduit au moment de la création.
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  tauxCommissionProduit: number;

  /**
   * Multiplicateur pour le plan STANDARD (toujours 1.0).
   * Inclus pour exhaustivité et cohérence.
   */
  @Column({
    type: 'decimal', precision: 4, scale: 3, default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  planMultiplierStandard: number;

  /**
   * Multiplicateur pour le plan PRO.
   * commission_effective = tauxCommissionProduit × planMultiplierPro
   */
  @Column({
    type: 'decimal', precision: 4, scale: 3,
    transformer: new ColumnNumericTransformer(),
  })
  planMultiplierPro: number;

  /**
   * Multiplicateur pour le plan PREMIUM.
   * Entreprises au plan PREMIUM bénéficient du taux le plus bas.
   */
  @Column({
    type: 'decimal', precision: 4, scale: 3,
    transformer: new ColumnNumericTransformer(),
  })
  planMultiplierPremium: number;

  /**
   * Part de la commission produit allant à Shopi (%).
   * Invariant : ratioShopiProduit + ratioPartenaireProduit + ratioAdminProduit = 100
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioShopiProduit: number;

  /**
   * Part de la commission produit allant au Partenaire de l'entreprise (%).
   * Si l'entreprise n'a pas de partenaire, cette part est absorbée par Shopi.
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioPartenaireProduit: number;

  /**
   * Part de la commission produit allant à l'Admin du Partenaire (%).
   * Si l'entreprise n'a pas d'admin dans sa hiérarchie, absorbée par Shopi.
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioAdminProduit: number;

  /* ==========================================================
   * COMMISSION LIVRAISON
   * ========================================================== */

  /**
   * Taux brut de commission appliqué sur les fraisLivraison (%).
   * Totalement indépendant du taux produit.
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  tauxCommissionLivraison: number;

  /**
   * Part Shopi de la commission livraison (%).
   * Invariant : ratioShopi + ratioPartenaire + ratioAdmin = 100
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioShopiLivraison: number;

  /**
   * Part du Partenaire du livreur/correspondant (%).
   * Partenaire = celui qui a créé le compte du prestataire de livraison.
   */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioPartenaireLivraison: number;

  /** Part de l'Admin du Partenaire du livreur (%). */
  @Column({
    type: 'decimal', precision: 5, scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  ratioAdminLivraison: number;

  /* ==========================================================
   * MÉTADONNÉES D'AUDIT
   * ========================================================== */

  /**
   * UserId du SuperAdmin qui a créé cette règle.
   * NULL si créée automatiquement au démarrage (première initialisation).
   */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /**
   * Date à laquelle cette règle est entrée en vigueur.
   * Identique à createdAt lors de la création.
   */
  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  /**
   * Date à laquelle cette règle a été remplacée par une nouvelle.
   * NULL tant que la règle est active (isActive = true).
   */
  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt: Date | null;

  /** Date de création du record. */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
