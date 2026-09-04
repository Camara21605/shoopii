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
import { CompanySetting }  from '../../company-settings/company-settings.entity';
import { PartnerSetting }  from '../../partner-settings/partner-settings.entity';
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
   * @param companySettings Config singleton "Entreprises" du Centre de
   *        Gestion des Commissions (commissionType/Value/Min/Max/Brackets).
   *        Si absente (table pas encore initialisée), on retombe sur
   *        rule.tauxCommissionProduit — comportement identique à avant.
   * @param partnerSettings Config singleton "Partenaires" du Centre de
   *        Gestion des Commissions (commissionMode/defaultCommissionRate/tiers).
   *        Remplace rule.ratioPartenaireProduit par le taux du tier du
   *        partenaire quand un partenaire est présent — le ratio Shopi
   *        reste celui de la règle, Admin absorbe le résidu (voir
   *        resoudreRatioPartenaireProduit).
   * @returns CommissionAmounts avec tous les montants calculés
   */
  calculer(
    context:       CommissionContext,
    rule:          CommissionRule,
    entreprise:    ActeurEntrepriseHierarchy,
    livreur:       ActeurLivraisonHierarchy | null,
    correspondant: ActeurLivraisonHierarchy | null,
    companySettings: CompanySetting | null = null,
    partnerSettings: PartnerSetting | null = null,
  ): CommissionAmounts {

    const sousTotal        = Math.round(context.sousTotal);
    const fraisLivraison   = Math.round(context.fraisLivraison);

    /* ── 1. Taux effectifs ────────────────────────────────── */

    const tauxBaseDecimal         = Number(rule.tauxCommissionProduit) / 100;
    const tauxLivraisonDecimal    = Number(rule.tauxCommissionLivraison) / 100;
    const planMultiplier          = entreprise.planMultiplier;

    const tauxEffectifLivraison   = tauxLivraisonDecimal;

    /* ── 2. Commission produit — CompanySetting a priorité sur rule ── */

    const { commissionProduitBrute, tauxEffectifProduit } = this.resoudreCommissionProduit(
      sousTotal, tauxBaseDecimal, planMultiplier, companySettings,
    );
    const partEntreprise = sousTotal - commissionProduitBrute;

    this.logger.debug(
      `[Calc] Commande ${context.commandeId} — ` +
      `plan: ${entreprise.plan} × ${planMultiplier} ` +
      `→ tauxProduit: ${(tauxEffectifProduit * 100).toFixed(3)}% ` +
      `tauxLivraison: ${(tauxEffectifLivraison * 100).toFixed(3)}%`,
    );

    /* Répartition de la commission produit entre les 3 bénéficiaires.
     * Le ratio Shopi reste celui de la règle (le "prix plateforme" ne
     * bouge pas selon le partenaire) ; le ratio Partenaire vient de
     * PartnerSettings quand un partenaire existe (sinon rule, inchangé) ;
     * Admin absorbe le résidu (arrondi + ce que le partenaire ne prend
     * pas), exactement comme avant. */
    const ratioShopiProduitPct      = Number(rule.ratioShopiProduit);
    const ratioPartenaireProduitPct = this.resoudreRatioPartenaireProduit(rule, entreprise, partnerSettings);

    const partShopiProduit      = this.floor(commissionProduitBrute * ratioShopiProduitPct / 100);
    const partPartenaireProduit = this.floor(commissionProduitBrute * ratioPartenaireProduitPct / 100);
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
      ratioPartenaireProduitEffectif: ratioPartenaireProduitPct,
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

  /**
   * Résout le ratio Partenaire (%) sur la commission produit.
   *
   * Si PartnerSettings existe ET qu'un partenaire est présent sur cette
   * commande, son taux REMPLACE rule.ratioPartenaireProduit (décision
   * produit explicite — pas un bonus qui s'ajoute) :
   *   'fixed'       → defaultCommissionRate pour tous
   *   'tier'        → taux du tier atteint (le plus haut tier dont
   *                    minCompanies <= partenaire.totalCompanies)
   *   'progressive' → même résolution que 'tier' : aucune formule
   *                    continue n'est configurable ailleurs que les
   *                    paliers minCompanies des tiers eux-mêmes.
   *
   * Le ratio Shopi (rule.ratioShopiProduit) NE BOUGE PAS : c'est Admin qui
   * absorbe la différence (résidu, cf. calculer() ci-dessus) — cohérent
   * avec le rôle d'"absorbeur" qu'Admin a déjà pour les arrondis, et avec
   * le fait qu'Admin supervise directement ce Partenaire dans la hiérarchie.
   * Le taux du partenaire est plafonné à (100 - ratioShopi) pour ne
   * jamais dépasser ce qu'il reste après la part Shopi.
   *
   * Retourne rule.ratioPartenaireProduit (comportement identique à avant)
   * si PartnerSettings est absente ou si aucun partenaire n'est présent.
   */
  private resoudreRatioPartenaireProduit(
    rule:            CommissionRule,
    entreprise:      ActeurEntrepriseHierarchy,
    partnerSettings: PartnerSetting | null,
  ): number {
    if (!partnerSettings || !entreprise.partenaireUserId) {
      return Number(rule.ratioPartenaireProduit);
    }
    return this.resoudreTauxPartenaireProduit(
      Number(rule.ratioPartenaireProduit),
      Number(rule.ratioShopiProduit),
      entreprise.partenaireTotalCompanies ?? 0,
      partnerSettings,
    );
  }

  /**
   * Cœur de resoudreRatioPartenaireProduit() ci-dessus, extrait en méthode
   * PUBLIQUE à primitives pour être appelable sans reconstruire un
   * ActeurEntrepriseHierarchy complet — utilisée par
   * PartenaireDashboardService.getCommissions() pour que le taux "Sur
   * ventes entreprises" affiché au partenaire soit TOUJOURS exactement
   * celui que CommissionEngine appliquera à sa prochaine commission,
   * jamais une valeur dérivée séparément qui pourrait diverger.
   */
  resoudreTauxPartenaireProduit(
    ratioParDefaut:  number,
    ratioShopi:      number,
    totalCompanies:  number,
    partnerSettings: PartnerSetting | null,
  ): number {
    if (!partnerSettings) return ratioParDefaut;

    let tauxPartenaire: number;
    if (partnerSettings.commissionMode === 'fixed') {
      tauxPartenaire = Number(partnerSettings.defaultCommissionRate);
    } else {
      /* 'tier' et 'progressive' — plus haut tier atteint par volume de recrutement */
      const tiers = (partnerSettings.tiers ?? [])
        .filter(t => t.enabled)
        .sort((a, b) => b.minCompanies - a.minCompanies);
      const tier = tiers.find(t => totalCompanies >= t.minCompanies);
      tauxPartenaire = tier ? Number(tier.commission) : Number(partnerSettings.defaultCommissionRate);
    }

    const plafond = Math.max(0, 100 - ratioShopi);
    return Math.min(Math.max(0, tauxPartenaire), plafond);
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

  /**
   * Résout la commission produit brute selon CompanySetting (Centre de
   * Gestion des Commissions, onglet "Entreprises"), avec repli sur
   * rule.tauxCommissionProduit si CompanySetting est absente.
   *
   * Les 3 modes (commissionType) :
   *   'fixed'       → montant fixe par commande (GNF), × planMultiplier
   *   'percentage'  → commissionValue en % du sousTotal
   *   'progressive' → taux dégressif par tranche DE CETTE COMMANDE
   *                   (commissionMin/Max sont documentées "par transaction"
   *                   sur l'entité — aucun suivi du CA cumulé n'existe
   *                   actuellement, donc la tranche est résolue sur le
   *                   sousTotal de la commande en cours, pas un cumul).
   *
   * commissionMin/commissionMax s'appliquent aux 3 modes (plancher/plafond
   * par commande, tel qu'affiché sans condition dans l'UI "Taux et plafonds").
   *
   * PUBLIC — également utilisée par les aperçus de revenu net affichés
   * AVANT paiement (GET /dashboard/entreprise/commission-rate, ProduitsService
   * .getProductStats, EntrepriseCommissionsParametresService), pour que ces
   * aperçus appliquent exactement la même règle que le calcul réel et ne
   * puissent plus diverger en dupliquant la formule à part.
   */
  resoudreCommissionProduit(
    sousTotal:        number,
    tauxBaseDecimal:  number,
    planMultiplier:   number,
    companySettings:  CompanySetting | null,
  ): { commissionProduitBrute: number; tauxEffectifProduit: number } {

    if (!companySettings) {
      const tauxEffectifProduit = tauxBaseDecimal * planMultiplier;
      return { commissionProduitBrute: this.floor(sousTotal * tauxEffectifProduit), tauxEffectifProduit };
    }

    const min = Number(companySettings.commissionMin) || 0;
    const max = Number(companySettings.commissionMax) || 0;

    const clamp = (commission: number): number => {
      let c = commission;
      if (max > 0) c = Math.min(c, max);
      if (min > 0) c = Math.max(c, min);
      return Math.min(Math.max(0, c), sousTotal); // jamais < 0 ni > sousTotal
    };

    if (companySettings.commissionType === 'fixed') {
      const brut = this.floor(Number(companySettings.commissionValue) * planMultiplier);
      const commissionProduitBrute = clamp(brut);
      const tauxEffectifProduit = sousTotal > 0 ? commissionProduitBrute / sousTotal : 0;
      return { commissionProduitBrute, tauxEffectifProduit };
    }

    let tauxPct: number;
    if (companySettings.commissionType === 'progressive' && companySettings.commissionBrackets?.length) {
      const bracket = companySettings.commissionBrackets.find(
        b => sousTotal >= b.from && (b.to == null || sousTotal <= b.to),
      ) ?? companySettings.commissionBrackets[companySettings.commissionBrackets.length - 1];
      tauxPct = Number(bracket.rate);
    } else {
      /* 'percentage' (ou valeur de repli si commissionType inconnu) */
      tauxPct = Number(companySettings.commissionValue);
    }

    const tauxEffectifProduit = (tauxPct / 100) * planMultiplier;
    const commissionProduitBrute = clamp(this.floor(sousTotal * tauxEffectifProduit));

    return { commissionProduitBrute, tauxEffectifProduit };
  }
}
