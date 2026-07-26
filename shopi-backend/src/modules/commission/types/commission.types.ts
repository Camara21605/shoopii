/* ============================================================
 * FICHIER : src/modules/commission/types/commission.types.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Définit toutes les interfaces et types partagés du Commission Engine.
 *
 * Ces types sont utilisés par tous les sous-services du moteur.
 * Aucune dépendance NestJS ici — types purs TypeScript.
 *
 * STRUCTURE
 * ─────────────────────────────────────────────────────────────
 *  CommissionContext    → données d'entrée du moteur
 *  CommissionResult     → résultat complet du calcul
 *  CommissionPart       → part d'un acteur individuel
 *  CommissionHierarchy  → chaîne hiérarchique résolue
 *  CommissionSnapshot   → snapshot JSON des taux appliqués
 *  CommissionCategorie  → catégorie de commission (produit, livraison…)
 *  CommissionAmounts    → résultats mathématiques bruts
 * ============================================================ */

import { DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
import { CommissionRule }         from '../../../database/entities/paiement/commission-rule.entity';

/* ============================================================
 * ENUM — Catégorie de commission
 * ============================================================ */

/**
 * Catégorie d'une commission.
 * Permet au moteur de gérer plusieurs types de flux financiers.
 *
 * PRODUIT / LIVRAISON     → commissions normales sur ventes
 * REMBOURSEMENT           → inversion d'une distribution existante
 * EXCEPTIONNEL            → ajustement ponctuel décidé par SuperAdmin
 * PROMOTIONNEL            → réduction tarifaire sur événement
 * MANUEL                  → distribution manuelle sans calcul automatique
 */
export enum CommissionCategorie {
  PRODUIT              = 'produit',
  LIVRAISON            = 'livraison',
  COMMISSION_PRODUIT   = 'commission_produit',
  COMMISSION_LIVRAISON = 'commission_livraison',
  REMBOURSEMENT        = 'remboursement',
  EXCEPTIONNEL         = 'exceptionnel',
  PROMOTIONNEL         = 'promotionnel',
  MANUEL               = 'manuel',
}

/* ============================================================
 * ENTRÉE : CommissionContext
 * ============================================================ */

/**
 * Données d'entrée minimales nécessaires pour calculer une commission.
 *
 * INVARIANTS VÉRIFIÉS PAR CommissionValidatorService :
 *   - sousTotal >= 0
 *   - fraisLivraison >= 0
 *   - |total - (sousTotal + fraisLivraison)| <= 1  (tolérance arrondi)
 *   - companyId non vide
 */
export interface CommissionContext {
  /** UUID de la commande Shopi */
  commandeId: string;

  /** Référence lisible de la commande (ex : "CMD-2026-00142") */
  commandeNumero: string;

  /** UUID du profil entreprise (Company.id, NOT userId) */
  companyId: string;

  /** UUID du profil livreur (Delivery.id) — null si pas de livreur */
  livreurId: string | null;

  /** UUID du profil correspondant (Correspondent.id) — null si pas de correspondant */
  correspondantId: string | null;

  /**
   * Montant des produits hors livraison (en GNF).
   * La commission produit est calculée sur ce montant.
   */
  sousTotal: number;

  /**
   * Frais de livraison (en GNF).
   * La commission livraison est calculée sur ce montant.
   */
  fraisLivraison: number;

  /**
   * Total payé par le client (en GNF).
   * Doit égaler sousTotal + fraisLivraison (tolérance ±1 GNF).
   * Sert de contrôle d'intégrité.
   */
  total: number;

  /** Devise — défaut GNF */
  devise?: string;
}

/* ============================================================
 * HIERARCHIE : acteurs et leur chaîne superviseur
 * ============================================================ */

/**
 * Hiérarchie d'un livreur ou correspondant.
 * Partenaire = celui qui a créé le compte via code invitation.
 * Admin = celui qui a créé le Partenaire.
 */
export interface ActeurLivraisonHierarchy {
  /** UUID du profil (Delivery.id ou Correspondent.id) */
  profileId: string;

  /** UUID du User lié au profil */
  userId: string;

  /** Nom d'affichage */
  nom: string;

  /** UUID du profil Partner (nullable) */
  partenaireProfileId: string | null;

  /** UUID du User du Partenaire → wallet cible pour la commission */
  partenaireUserId: string | null;

  /** Nom du Partenaire (pour audit) */
  partenaireNom: string | null;

  /** UUID du profil Admin (nullable) */
  adminProfileId: string | null;

  /** UUID du User de l'Admin → wallet cible pour la commission */
  adminUserId: string | null;

  /** Nom de l'Admin (pour audit) */
  adminNom: string | null;
}

/**
 * Hiérarchie de l'entreprise.
 * Contient en plus le plan de commission (STANDARD / PRO / PREMIUM).
 */
export interface ActeurEntrepriseHierarchy extends ActeurLivraisonHierarchy {
  /** Plan de commission de l'entreprise */
  plan: string;

  /** Multiplicateur associé à ce plan (ex : 0.75 pour PRO) */
  planMultiplier: number;
}

/**
 * Hiérarchie complète d'une commande.
 */
export interface CommissionHierarchy {
  /** Toujours présente */
  entreprise: ActeurEntrepriseHierarchy;

  /** Présent si commande.livreurId non null */
  livreur: ActeurLivraisonHierarchy | null;

  /** Présent si commande.correspondantId non null */
  correspondant: ActeurLivraisonHierarchy | null;

  /**
   * UUID du User Shopi (super_admin) qui détient le wallet plateforme.
   * Résolu par CommissionHierarchyService.resolvePlatformeUserId().
   */
  plateformeUserId: string;
}

/* ============================================================
 * CALCUL : montants bruts
 * ============================================================ */

/**
 * Résultats mathématiques bruts produits par CommissionCalculatorService.
 * Tous les montants sont en GNF, arrondis à l'entier inférieur.
 */
export interface CommissionAmounts {
  /* ── Taux effectifs ─────────────────────────────────────── */

  /** Taux de commission produit effectif (décimal, ex: 0.045 pour 4.5%) */
  tauxEffectifProduit: number;

  /** Taux de commission livraison effectif (décimal) */
  tauxEffectifLivraison: number;

  /* ── Commission produit ─────────────────────────────────── */

  /** Part brute de commission sur le sousTotal (GNF) */
  commissionProduitBrute: number;

  /** Part nette de l'entreprise (GNF) = sousTotal - commissionProduitBrute */
  partEntreprise: number;

  /** Part Shopi sur la commission produit */
  partShopiProduit: number;

  /** Part Partenaire de l'entreprise sur la commission produit */
  partPartenaireProduit: number;

  /** Part Admin du Partenaire de l'entreprise sur la commission produit */
  partAdminProduit: number;

  /* ── Commission livraison ───────────────────────────────── */

  /** Part brute de commission sur les fraisLivraison (GNF) */
  commissionLivraisonBrute: number;

  /**
   * Part nette du livreur OU du correspondant (GNF).
   * = fraisLivraison - commissionLivraisonBrute.
   * Partagée 50/50 si livreur ET correspondant coexistent.
   */
  partLivreur: number;

  /** Part correspondant si livreur ET correspondant coexistent */
  partCorrespondant: number;

  /** Part Shopi sur la commission livraison */
  partShopiLivraison: number;

  /** Part Partenaire du livreur/correspondant */
  partPartenaireLivraison: number;

  /** Part Admin du Partenaire du livreur/correspondant */
  partAdminLivraison: number;

  /* ── Vérification ───────────────────────────────────────── */

  /** Somme de toutes les parts (doit égaler context.total) */
  totalDistribue: number;
}

/* ============================================================
 * PART : un acteur avec son montant
 * ============================================================ */

/**
 * Part d'un acteur individuel dans la distribution d'une commande.
 * Une CommissionPart → une ligne dans paiement_distributions.
 */
export interface CommissionPart {
  /** Type d'acteur bénéficiaire */
  acteurType: DistributionActeurType;

  /**
   * UUID du User propriétaire du wallet cible.
   * C'est ce userId qui sera utilisé pour créditer le wallet.
   */
  acteurUserId: string;

  /** Nom lisible pour les logs et l'audit (ex: "Boutique Alpha", "FedaPay Livreur") */
  acteurNom: string;

  /** Montant en GNF à distribuer à cet acteur */
  montant: number;

  /**
   * Taux de commission appliqué pour calculer cette part (en %).
   * Non null pour les parts de type COMMISSION_*.
   * Ex : 6.0 pour la commission brute, 70.0 pour la part Shopi.
   */
  tauxApplique: number | null;

  /** Catégorie de cette part dans le flux financier */
  categorie: CommissionCategorie;
}

/* ============================================================
 * SNAPSHOT : copie immuable des taux appliqués
 * ============================================================ */

/**
 * Snapshot JSON stocké dans PaiementDistribution.snapshotTaux.
 *
 * Ce snapshot est la preuve légale des taux appliqués au moment
 * du calcul, indépendamment des modifications ultérieures de PlatformSettings.
 */
export interface CommissionSnapshot {
  /** UUID de la CommissionRule active utilisée (null si aucune) */
  ruleId: string | null;

  /** Numéro de version de la règle */
  ruleVersion: number | null;

  /** Taux brut de commission produit (%) configuré dans PlatformSettings */
  tauxCommissionProduit: number;

  /** Taux effectif après application du multiplicateur plan (%) */
  tauxEffectifProduit: number;

  /** Plan de l'entreprise (standard/pro/premium) */
  planEntreprise: string;

  /** Multiplicateur du plan appliqué (ex: 0.75 pour PRO) */
  planMultiplier: number;

  /** Part Shopi sur la commission produit (%) */
  ratioShopiProduit: number;

  /** Part Partenaire sur la commission produit (%) */
  ratioPartenaireProduit: number;

  /** Part Admin sur la commission produit (%) */
  ratioAdminProduit: number;

  /** Taux brut de commission livraison (%) */
  tauxCommissionLivraison: number;

  /** Part Shopi sur la commission livraison (%) */
  ratioShopiLivraison: number;

  /** Part Partenaire sur la commission livraison (%) */
  ratioPartenaireLivraison: number;

  /** Part Admin sur la commission livraison (%) */
  ratioAdminLivraison: number;

  /** Date et heure du calcul (ISO 8601) */
  calculatedAt: string;
}

/* ============================================================
 * RÉSULTAT FINAL
 * ============================================================ */

/**
 * Résultat complet produit par CommissionEngine.calculer().
 *
 * Ce résultat est passé à PaiementWebhookService qui crée ensuite
 * les lignes PaiementDistribution dans la base de données.
 * Le moteur ne persiste rien — il calcule et retourne.
 */
export interface CommissionResult {
  /** Règle de commission active utilisée pour ce calcul */
  rule: CommissionRule | null;

  /** Snapshot immuable des taux appliqués */
  snapshotTaux: CommissionSnapshot;

  /** Taux de commission produit effectif (décimal) */
  tauxEffectifProduit: number;

  /** Taux de commission livraison effectif (décimal) */
  tauxEffectifLivraison: number;

  /** Total de la commission sur les produits (GNF) */
  commissionProduitBrute: number;

  /** Total de la commission sur la livraison (GNF) */
  commissionLivraisonBrute: number;

  /**
   * Somme de toutes les parts.
   * INVARIANT : doit être ≤ context.total (différence ≤ 1 GNF acceptable).
   */
  totalDistribue: number;

  /**
   * Liste de toutes les parts à distribuer.
   * Une part par acteur, même si le montant est 0.
   * Les parts à 0 peuvent être ignorées lors de la création des distributions.
   */
  parts: CommissionPart[];

  /** Hiérarchie complète résolue pour audit et snapshot */
  hierarchy: CommissionHierarchy;

  /** Calculs mathématiques bruts (pour débogage et audit) */
  amounts: CommissionAmounts;

  /** Timestamp du calcul */
  calculatedAt: Date;
}

/* ============================================================
 * ERREURS
 * ============================================================ */

/**
 * Types d'erreurs du moteur de commissions.
 * Utilisés par CommissionValidatorService et CommissionEngine.
 */
export enum CommissionErreurType {
  /** Aucune règle de commission active dans la base */
  REGLE_ABSENTE            = 'REGLE_ABSENTE',
  /** La règle active est désactivée (isActive = false) */
  REGLE_DESACTIVEE         = 'REGLE_DESACTIVEE',
  /** La somme des ratios (Shopi + Partenaire + Admin) ≠ 100 */
  RATIOS_INVALIDES         = 'RATIOS_INVALIDES',
  /** Un ou plusieurs taux sont négatifs */
  TAUX_NEGATIF             = 'TAUX_NEGATIF',
  /** Le montant total est incohérent avec sousTotal + fraisLivraison */
  MONTANT_INCOHERENT       = 'MONTANT_INCOHERENT',
  /** L'entreprise est introuvable dans la base */
  ENTREPRISE_INTROUVABLE   = 'ENTREPRISE_INTROUVABLE',
  /** Le livreur est introuvable */
  LIVREUR_INTROUVABLE      = 'LIVREUR_INTROUVABLE',
  /** Le correspondant est introuvable */
  CORRESPONDANT_INTROUVABLE = 'CORRESPONDANT_INTROUVABLE',
  /** Le partenaire est introuvable (non bloquant — la part va à Shopi) */
  PARTENAIRE_ABSENT        = 'PARTENAIRE_ABSENT',
  /** L'admin est introuvable (non bloquant — la part va à Shopi) */
  ADMIN_ABSENT             = 'ADMIN_ABSENT',
  /** Un doublon de calcul a été détecté pour cette commande */
  DOUBLON_CALCUL           = 'DOUBLON_CALCUL',
  /** Erreur interne inattendue */
  ERREUR_INTERNE           = 'ERREUR_INTERNE',
}

/**
 * Erreur typée du moteur de commissions.
 * Contient le type d'erreur + le contexte pour le log financier.
 */
export class CommissionErreur extends Error {
  constructor(
    public readonly type: CommissionErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CommissionErreur';
  }
}
