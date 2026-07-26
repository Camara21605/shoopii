/* ============================================================
 * FICHIER : src/modules/commission/services/commission-calculator.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Service de calcul mathématique pur du moteur de commissions.
 *
 * GARANTIES DE CE SERVICE
 * ─────────────────────────────────────────────────────────────
 *  1. AUCUN appel à la base de données.
 *  2. AUCUN effet de bord.
 *  3. Résultats reproductibles à partir des mêmes inputs.
 *  4. Tous les montants retournés sont des entiers >= 0 (GNF).
 *
 * GESTION DES ARRONDIS
 * ─────────────────────────────────────────────────────────────
 *  Le GNF est une devise entière (pas de centimes).
 *  RÈGLE : toujours Math.floor() pour les parts calculées.
 *  La dernière part absorbe l'arrondi résiduel.
 *
 *  Pour les commissions produit :
 *    partAdminProduit = commissionBrute - partShopi - partPartenaire
 *    (Admin absorbe l'arrondi, Shopi + Partenaire sont arrondis à l'inférieur)
 *
 *  Pour les commissions livraison :
 *    partAdminLivraison = commissionBrute - partShopi - partPartenaire
 *
 * FORMULES
 * ─────────────────────────────────────────────────────────────
 *
 *  tauxEffectifProduit = tauxBase × planMultiplier / 100
 *  commissionProduitBrute = floor(sousTotal × tauxEffectifProduit)
 *  partEntreprise = sousTotal - commissionProduitBrute
 *
 *  partShopiProduit    = floor(commissionBrute × ratioShopi / 100)
 *  partPartenaireProduit = floor(commissionBrute × ratioPartenaire / 100)
 *  partAdminProduit = commissionBrute - partShopi - partPartenaire
 *
 *  commissionLivraisonBrute = floor(fraisLivraison × tauxLivraison / 100)
 *  partLivreur = fraisLivraison - commissionLivraisonBrute
 *
 *  partShopiLivraison    = floor(commissionLivBrute × ratioShopi / 100)
 *  partPartenaireLivraison = floor(commissionLivBrute × ratioPartenaire / 100)
 *  partAdminLivraison = commissionLivBrute - partShopi - partPartenaire
 *
 *  Vérification : partEntreprise + partLivreur
 *               + partShopiProduit + partPartenaireProduit + partAdminProduit
 *               + partShopiLivraison + partPartenaireLivraison + partAdminLivraison
 *               = sousTotal + fraisLivraison = total
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  CommissionRule   → taux de la règle active
 *  CommissionContext → montants de la commande
 *  ActeurLivraisonHierarchy → pour savoir si livreur + correspondant coexistent
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { CommissionRule }  from '../../../database/entities/paiement/commission-rule.entity';
import {
  CommissionContext,
  CommissionAmounts,
  ActeurEntrepriseHierarchy,
  ActeurLivraisonHierarchy,
} from '../types/commission.types';

@Injectable()
export class CommissionCalculatorService {

  private readonly logger = new Logger(CommissionCalculatorService.name);

  /* ──────────────────────────────────────────────────────────
   * calculer() — calcul principal
   * ────────────────────────────────────────────────────────── */

  /**
   * Calcule toutes les parts financières pour une commande.
   *
   * @param context  Données de la commande (montants)
   * @param rule     CommissionRule active (taux versionnés)
   * @param entreprise Hiérarchie entreprise (pour planMultiplier)
   * @param livreur  Hiérarchie livreur (null si absent)
   * @param correspondant Hiérarchie correspondant (null si absent)
   * @returns CommissionAmounts avec tous les montants calculés
   */
  calculer(
    context:       CommissionContext,
    rule:          CommissionRule,
    entreprise:    ActeurEntrepriseHierarchy,
    livreur:       ActeurLivraisonHierarchy | null,
    correspondant: ActeurLivraisonHierarchy | null,
  ): CommissionAmounts {

    const sousTotal        = Math.round(context.sousTotal);
    const fraisLivraison   = Math.round(context.fraisLivraison);

    /* ── 1. Taux effectifs ────────────────────────────────── */

    const tauxBaseDecimal         = Number(rule.tauxCommissionProduit) / 100;
    const tauxLivraisonDecimal    = Number(rule.tauxCommissionLivraison) / 100;
    const planMultiplier          = entreprise.planMultiplier;

    const tauxEffectifProduit     = tauxBaseDecimal * planMultiplier;
    const tauxEffectifLivraison   = tauxLivraisonDecimal;

    this.logger.debug(
      `[Calc] Commande ${context.commandeId} — ` +
      `plan: ${entreprise.plan} × ${planMultiplier} ` +
      `→ tauxProduit: ${(tauxEffectifProduit * 100).toFixed(3)}% ` +
      `tauxLivraison: ${(tauxEffectifLivraison * 100).toFixed(3)}%`,
    );

    /* ── 2. Commission produit ────────────────────────────── */

    const commissionProduitBrute = this.floor(sousTotal * tauxEffectifProduit);
    const partEntreprise         = sousTotal - commissionProduitBrute;

    /* Répartition de la commission produit entre les 3 bénéficiaires */
    const partShopiProduit      = this.floor(commissionProduitBrute * Number(rule.ratioShopiProduit) / 100);
    const partPartenaireProduit = this.floor(commissionProduitBrute * Number(rule.ratioPartenaireProduit) / 100);
    /* L'admin absorbe le résidu d'arrondi pour que la somme soit exacte */
    const partAdminProduit      = commissionProduitBrute - partShopiProduit - partPartenaireProduit;

    /* ── 3. Commission livraison ──────────────────────────── */

    const commissionLivraisonBrute = this.floor(fraisLivraison * tauxEffectifLivraison);
    const netLivraison             = fraisLivraison - commissionLivraisonBrute;

    /* Part livreur vs correspondant */
    let partLivreur      = 0;
    let partCorrespondant = 0;

    if (livreur && correspondant) {
      /* Livreur + Correspondant coexistent → partage 50 / 50 du net livraison */
      partLivreur       = this.floor(netLivraison * 0.5);
      partCorrespondant = netLivraison - partLivreur; // absorbe l'arrondi
    } else if (livreur) {
      partLivreur = netLivraison;
    } else if (correspondant) {
      partCorrespondant = netLivraison;
    }
    /* Si ni livreur ni correspondant : netLivraison reste dans la plateforme */

    /* Répartition de la commission livraison */
    const partShopiLivraison       = this.floor(commissionLivraisonBrute * Number(rule.ratioShopiLivraison) / 100);
    const partPartenaireLivraison  = this.floor(commissionLivraisonBrute * Number(rule.ratioPartenaireLivraison) / 100);
    const partAdminLivraison       = commissionLivraisonBrute - partShopiLivraison - partPartenaireLivraison;

    /* ── 4. Total distribué ───────────────────────────────── */

    const totalDistribue =
      partEntreprise
      + partLivreur
      + partCorrespondant
      + partShopiProduit
      + partPartenaireProduit
      + partAdminProduit
      + partShopiLivraison
      + partPartenaireLivraison
      + partAdminLivraison;

    this.logger.debug(
      `[Calc] Commande ${context.commandeId} — ` +
      `sousTotal: ${sousTotal} | fraisLivraison: ${fraisLivraison} | total: ${context.total} | ` +
      `commProduit: ${commissionProduitBrute} | commLivraison: ${commissionLivraisonBrute} | ` +
      `distribué: ${totalDistribue}`,
    );

    /* Vérification d'intégrité (tolérance 1 GNF pour arrondis) */
    const ecart = Math.abs(totalDistribue - context.total);
    if (ecart > 1) {
      this.logger.error(
        `[Calc] ERREUR INTÉGRITÉ commande ${context.commandeId}: ` +
        `distribué=${totalDistribue} ≠ total=${context.total} (écart: ${ecart})`,
      );
    }

    return {
      tauxEffectifProduit,
      tauxEffectifLivraison,
      commissionProduitBrute,
      partEntreprise,
      partShopiProduit,
      partPartenaireProduit,
      partAdminProduit,
      commissionLivraisonBrute,
      partLivreur,
      partCorrespondant,
      partShopiLivraison,
      partPartenaireLivraison,
      partAdminLivraison,
      totalDistribue,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * calculerMontantFixe() — montant fixe (pas de pourcentage)
   * ────────────────────────────────────────────────────────── */

  /**
   * Calcule une commission à montant fixe.
   * Utilisé pour les commissions MANUEL ou EXCEPTIONNEL.
   *
   * @param montantTotal Montant total à distribuer
   * @param ratioShopi % pour Shopi
   * @param ratioPartenaire % pour le Partenaire
   * @param ratioAdmin % pour l'Admin
   */
  calculerMontantFixe(
    montantTotal:    number,
    ratioShopi:      number,
    ratioPartenaire: number,
    ratioAdmin:      number,
  ): { partShopi: number; partPartenaire: number; partAdmin: number } {
    const partShopi      = this.floor(montantTotal * ratioShopi / 100);
    const partPartenaire = this.floor(montantTotal * ratioPartenaire / 100);
    const partAdmin      = montantTotal - partShopi - partPartenaire;

    return { partShopi, partPartenaire, partAdmin };
  }

  /* ──────────────────────────────────────────────────────────
   * calculerPlafonné() — avec plafond et minimum
   * ────────────────────────────────────────────────────────── */

  /**
   * Calcule un pourcentage avec plafond et minimum.
   * Utilisé pour les commissions promotionnelles.
   *
   * @param base Montant de base
   * @param tauxPct Taux en pourcentage (ex: 6 pour 6%)
   * @param plafond Montant maximal (0 = sans plafond)
   * @param minimum Montant minimal (0 = sans minimum)
   */
  calculerPlafonné(
    base:     number,
    tauxPct:  number,
    plafond:  number,
    minimum:  number,
  ): number {
    let commission = this.floor(base * tauxPct / 100);
    if (plafond > 0) commission = Math.min(commission, plafond);
    if (minimum > 0) commission = Math.max(commission, minimum);
    return Math.max(0, commission);
  }

  /* ──────────────────────────────────────────────────────────
   * Helpers privés
   * ────────────────────────────────────────────────────────── */

  /**
   * Arrondit un nombre à l'entier inférieur.
   * Garantit que le résultat est >= 0.
   *
   * GNF = devise entière, pas de centimes.
   * On arrondit toujours à l'INFÉRIEUR pour ne jamais surcharger le client.
   */
  private floor(amount: number): number {
    return Math.max(0, Math.floor(amount));
  }
}
