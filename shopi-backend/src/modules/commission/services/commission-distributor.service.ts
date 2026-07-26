/* ============================================================
 * FICHIER : src/modules/commission/services/commission-distributor.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Transforme les montants bruts en liste de parts CommissionPart[].
 *
 * Ce service fait le lien entre :
 *   CommissionCalculatorService (montants numériques)
 *   CommissionHierarchy          (acteurs et leurs userIds)
 *   → CommissionPart[]           (prêt pour PaiementDistribution)
 *
 * RÈGLE DE REDISTRIBUTION
 * ─────────────────────────────────────────────────────────────
 *  Si un acteur de la hiérarchie est absent (partenaireUserId = null
 *  ou adminUserId = null), sa part est ABSORBÉE par Shopi (PLATEFORME).
 *
 *  Exemples :
 *    - Partenaire absent → partShopiProduit += partPartenaireProduit
 *    - Admin absent      → partShopiProduit += partAdminProduit
 *
 *  Cette règle garantit que 100 % du montant est toujours distribué.
 *
 * PARTS AVEC MONTANT 0
 * ─────────────────────────────────────────────────────────────
 *  Les parts à 0 sont incluses dans le résultat pour la traçabilité.
 *  Le service appelant (PaiementWebhookService) peut choisir de les
 *  ignorer lors de la création des PaiementDistribution.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Aucune dépendance TypeORM — service de transformation pure.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
import {
  CommissionContext,
  CommissionAmounts,
  CommissionHierarchy,
  CommissionPart,
  CommissionCategorie,
} from '../types/commission.types';

@Injectable()
export class CommissionDistributorService {

  private readonly logger = new Logger(CommissionDistributorService.name);

  /* ──────────────────────────────────────────────────────────
   * preparer() — construit la liste des parts
   * ────────────────────────────────────────────────────────── */

  /**
   * Construit la liste complète des CommissionPart à distribuer.
   *
   * @param context Contexte de la commande
   * @param amounts Montants calculés par CommissionCalculatorService
   * @param hierarchy Hiérarchie d'acteurs résolue
   * @returns Liste des parts, une par acteur + catégorie
   */
  preparer(
    context:   CommissionContext,
    amounts:   CommissionAmounts,
    hierarchy: CommissionHierarchy,
  ): CommissionPart[] {

    const parts: CommissionPart[] = [];

    /* ── Parts produit / livraison ────────────────────────── */

    /* 1. Entreprise reçoit le net produit */
    this.ajouterPart(parts, {
      acteurType:   DistributionActeurType.ENTREPRISE,
      acteurUserId: hierarchy.entreprise.userId,
      acteurNom:    hierarchy.entreprise.nom,
      montant:      amounts.partEntreprise,
      tauxApplique: amounts.tauxEffectifProduit * 100,
      categorie:    CommissionCategorie.PRODUIT,
    });

    /* 2. Livreur reçoit le net livraison */
    if (hierarchy.livreur && amounts.partLivreur > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.LIVREUR,
        acteurUserId: hierarchy.livreur.userId,
        acteurNom:    hierarchy.livreur.nom,
        montant:      amounts.partLivreur,
        tauxApplique: amounts.tauxEffectifLivraison * 100,
        categorie:    CommissionCategorie.LIVRAISON,
      });
    }

    /* 3. Correspondant reçoit sa part du net livraison */
    if (hierarchy.correspondant && amounts.partCorrespondant > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.CORRESPONDANT,
        acteurUserId: hierarchy.correspondant.userId,
        acteurNom:    hierarchy.correspondant.nom,
        montant:      amounts.partCorrespondant,
        tauxApplique: amounts.tauxEffectifLivraison * 100,
        categorie:    CommissionCategorie.LIVRAISON,
      });
    }

    /* ── Parts commission produit ─────────────────────────── */

    /* Calcul des parts Shopi produit en tenant compte des absences */
    let partShopiProduitTotal = amounts.partShopiProduit;

    /* 4. Partenaire de l'entreprise — commission produit */
    if (hierarchy.entreprise.partenaireUserId && amounts.partPartenaireProduit > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.PARTENAIRE_PRODUIT,
        acteurUserId: hierarchy.entreprise.partenaireUserId,
        acteurNom:    hierarchy.entreprise.partenaireNom ?? 'Partenaire',
        montant:      amounts.partPartenaireProduit,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_PRODUIT,
      });
    } else if (amounts.partPartenaireProduit > 0) {
      /* Partenaire absent → part absorbée par Shopi */
      partShopiProduitTotal += amounts.partPartenaireProduit;
      this.logger.debug(
        `[Distributor] Commande ${context.commandeId} — partenaire entreprise absent, ` +
        `${amounts.partPartenaireProduit} GNF absorbés par Shopi`,
      );
    }

    /* 5. Admin du partenaire de l'entreprise — commission produit */
    if (hierarchy.entreprise.adminUserId && amounts.partAdminProduit > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.ADMIN_PRODUIT,
        acteurUserId: hierarchy.entreprise.adminUserId,
        acteurNom:    hierarchy.entreprise.adminNom ?? 'Admin',
        montant:      amounts.partAdminProduit,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_PRODUIT,
      });
    } else if (amounts.partAdminProduit > 0) {
      /* Admin absent → part absorbée par Shopi */
      partShopiProduitTotal += amounts.partAdminProduit;
      this.logger.debug(
        `[Distributor] Commande ${context.commandeId} — admin entreprise absent, ` +
        `${amounts.partAdminProduit} GNF absorbés par Shopi`,
      );
    }

    /* ── Parts commission livraison ───────────────────────── */

    /*
     * Le Partenaire et l'Admin pour la livraison sont ceux du livreur
     * (ou du correspondant si pas de livreur, ou du livreur si les deux).
     * Si livreur + correspondant coexistent, on utilise la hiérarchie du livreur.
     */
    const livraisonHierarchy = hierarchy.livreur ?? hierarchy.correspondant;

    let partShopiLivraisonTotal = amounts.partShopiLivraison;

    /* 6. Partenaire du livreur — commission livraison */
    if (livraisonHierarchy?.partenaireUserId && amounts.partPartenaireLivraison > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.PARTENAIRE_LIVRAISON,
        acteurUserId: livraisonHierarchy.partenaireUserId,
        acteurNom:    livraisonHierarchy.partenaireNom ?? 'Partenaire Livraison',
        montant:      amounts.partPartenaireLivraison,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_LIVRAISON,
      });
    } else if (amounts.partPartenaireLivraison > 0) {
      /* Partenaire absent ou pas de livreur → absorbé par Shopi */
      partShopiLivraisonTotal += amounts.partPartenaireLivraison;
      this.logger.debug(
        `[Distributor] Commande ${context.commandeId} — partenaire livraison absent, ` +
        `${amounts.partPartenaireLivraison} GNF absorbés par Shopi`,
      );
    }

    /* 7. Admin du partenaire du livreur — commission livraison */
    if (livraisonHierarchy?.adminUserId && amounts.partAdminLivraison > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.ADMIN_LIVRAISON,
        acteurUserId: livraisonHierarchy.adminUserId,
        acteurNom:    livraisonHierarchy.adminNom ?? 'Admin Livraison',
        montant:      amounts.partAdminLivraison,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_LIVRAISON,
      });
    } else if (amounts.partAdminLivraison > 0) {
      partShopiLivraisonTotal += amounts.partAdminLivraison;
      this.logger.debug(
        `[Distributor] Commande ${context.commandeId} — admin livraison absent, ` +
        `${amounts.partAdminLivraison} GNF absorbés par Shopi`,
      );
    }

    /* ── Parts Shopi (agrège toutes ses parts) ────────────── */

    /* 8. Shopi commission produit */
    if (partShopiProduitTotal > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.PLATEFORME_PRODUIT,
        acteurUserId: hierarchy.plateformeUserId,
        acteurNom:    'Shopi — Commission Produit',
        montant:      partShopiProduitTotal,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_PRODUIT,
      });
    }

    /* 9. Shopi commission livraison */
    if (partShopiLivraisonTotal > 0) {
      this.ajouterPart(parts, {
        acteurType:   DistributionActeurType.PLATEFORME_LIVRAISON,
        acteurUserId: hierarchy.plateformeUserId,
        acteurNom:    'Shopi — Commission Livraison',
        montant:      partShopiLivraisonTotal,
        tauxApplique: null,
        categorie:    CommissionCategorie.COMMISSION_LIVRAISON,
      });
    }

    /* ── Log récapitulatif ────────────────────────────────── */

    const totalDistribué = parts.reduce((s, p) => s + p.montant, 0);
    this.logger.debug(
      `[Distributor] Commande ${context.commandeId} — ` +
      `${parts.length} parts, total: ${totalDistribué} GNF`,
    );

    return parts;
  }

  /* ──────────────────────────────────────────────────────────
   * Helpers privés
   * ────────────────────────────────────────────────────────── */

  /**
   * Ajoute une CommissionPart à la liste si le montant > 0.
   * Les parts à 0 sont quand même ajoutées pour la traçabilité
   * (le service appelant peut les filtrer).
   */
  private ajouterPart(parts: CommissionPart[], part: CommissionPart): void {
    if (part.montant < 0) {
      this.logger.warn(`[Distributor] Part négative ignorée: ${part.acteurType} = ${part.montant}`);
      return;
    }
    parts.push(part);
  }
}
