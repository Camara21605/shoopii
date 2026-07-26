/* ============================================================
 * FICHIER : src/modules/commission/services/commission-validator.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Valide toutes les préconditions avant tout calcul de commission.
 *
 * PRINCIPE
 * ─────────────────────────────────────────────────────────────
 *  Aucune distribution ne doit être effectuée si une règle est invalide.
 *  Ce service constitue le "garde-fou" du moteur : si la validation
 *  échoue, CommissionEngine.calculer() lance une CommissionErreur
 *  et la transaction est annulée.
 *
 * VALIDATIONS EFFECTUÉES
 * ─────────────────────────────────────────────────────────────
 *  V1 — Règle active : CommissionRule.isActive === true
 *  V2 — Taux non négatifs : tous les taux >= 0
 *  V3 — Ratios cohérents produit : shopi + partenaire + admin = 100 (±0.01)
 *  V4 — Ratios cohérents livraison : même vérification
 *  V5 — Montants valides : sousTotal >= 0, fraisLivraison >= 0, total >= 0
 *  V6 — Cohérence du total : |total - (sousTotal + fraisLivraison)| <= 1
 *  V7 — Doublon : aucune distribution ESCROW existante pour cette commande
 *       (sauf si explicitement autorisé pour les corrections)
 *
 * ERREURS NON BLOQUANTES (loggées, pas d'exception)
 * ─────────────────────────────────────────────────────────────
 *  - Partenaire absent → loggué WARN, pas d'exception
 *  - Admin absent      → loggué WARN, pas d'exception
 *  Ces cas sont acceptables ; la part manquante va à Shopi.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Repository<PaiementDistribution>  → vérification doublon
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { CommissionRule }     from '../../../database/entities/paiement/commission-rule.entity';
import {
  PaiementDistribution,
  DistributionStatus,
} from '../../../database/entities/paiement/paiement-distribution.entity';
import {
  CommissionContext,
  CommissionErreur,
  CommissionErreurType,
} from '../types/commission.types';

/** Tolérance sur la somme des ratios (ex: 70 + 20 + 10 = 100.0) */
const RATIO_TOLERANCE = 0.01;

/** Tolérance sur la cohérence du total (1 GNF pour les arrondis) */
const TOTAL_TOLERANCE = 1;

@Injectable()
export class CommissionValidatorService {

  private readonly logger = new Logger(CommissionValidatorService.name);

  constructor(
    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * validerTout() — validation complète avant calcul
   * ────────────────────────────────────────────────────────── */

  /**
   * Valide toutes les préconditions pour un calcul de commission.
   *
   * Lance une CommissionErreur si une règle critique est violée.
   * Ne retourne rien si tout est valide.
   *
   * @param context Contexte de la commande
   * @param rule CommissionRule active (peut être null si aucune trouvée)
   * @param skipDoublonCheck true pour ignorer la vérification doublon
   *        (utilisé lors des corrections ou re-calculs)
   *
   * @throws CommissionErreur si une validation critique échoue
   */
  async validerTout(
    context:          CommissionContext,
    rule:             CommissionRule | null,
    skipDoublonCheck: boolean = false,
  ): Promise<void> {

    /* V1 — Règle active */
    this.validerRegle(rule);

    /* V2 + V3 + V4 — Cohérence de la règle */
    this.validerTauxRegle(rule!);

    /* V5 + V6 — Montants de la commande */
    this.validerMontants(context);

    /* V7 — Doublon de distribution */
    if (!skipDoublonCheck) {
      await this.validerPasDoublon(context.commandeId);
    }

    this.logger.debug(`[Validator] Commande ${context.commandeId} — validation OK`);
  }

  /* ──────────────────────────────────────────────────────────
   * validerRegle() — V1
   * ────────────────────────────────────────────────────────── */

  /**
   * V1 : Vérifie que la règle de commission est présente et active.
   *
   * @throws CommissionErreur(REGLE_ABSENTE) si rule = null
   * @throws CommissionErreur(REGLE_DESACTIVEE) si rule.isActive = false
   */
  private validerRegle(rule: CommissionRule | null): void {
    if (!rule) {
      throw new CommissionErreur(
        CommissionErreurType.REGLE_ABSENTE,
        'Aucune règle de commission active. Initialiser PlatformSettings.',
      );
    }

    if (!rule.isActive) {
      throw new CommissionErreur(
        CommissionErreurType.REGLE_DESACTIVEE,
        `CommissionRule v${rule.version} (id: ${rule.id}) est désactivée.`,
        { ruleId: rule.id, version: rule.version },
      );
    }
  }

  /* ──────────────────────────────────────────────────────────
   * validerTauxRegle() — V2 + V3 + V4
   * ────────────────────────────────────────────────────────── */

  /**
   * V2 : Taux non négatifs — aucun taux ne peut être négatif.
   * V3 : Ratios produit — shopi + partenaire + admin = 100 (±0.01)
   * V4 : Ratios livraison — même vérification
   *
   * @throws CommissionErreur(TAUX_NEGATIF) si un taux est < 0
   * @throws CommissionErreur(RATIOS_INVALIDES) si la somme des ratios ≠ 100
   */
  private validerTauxRegle(rule: CommissionRule): void {
    const taux = [
      { nom: 'tauxCommissionProduit',   valeur: Number(rule.tauxCommissionProduit) },
      { nom: 'tauxCommissionLivraison', valeur: Number(rule.tauxCommissionLivraison) },
      { nom: 'planMultiplierPro',       valeur: Number(rule.planMultiplierPro) },
      { nom: 'planMultiplierPremium',   valeur: Number(rule.planMultiplierPremium) },
      { nom: 'ratioShopiProduit',       valeur: Number(rule.ratioShopiProduit) },
      { nom: 'ratioPartenaireProduit',  valeur: Number(rule.ratioPartenaireProduit) },
      { nom: 'ratioAdminProduit',       valeur: Number(rule.ratioAdminProduit) },
      { nom: 'ratioShopiLivraison',     valeur: Number(rule.ratioShopiLivraison) },
      { nom: 'ratioPartenaireLivraison',valeur: Number(rule.ratioPartenaireLivraison) },
      { nom: 'ratioAdminLivraison',     valeur: Number(rule.ratioAdminLivraison) },
    ];

    /* V2 : taux négatif */
    for (const { nom, valeur } of taux) {
      if (valeur < 0) {
        throw new CommissionErreur(
          CommissionErreurType.TAUX_NEGATIF,
          `Taux négatif détecté: ${nom} = ${valeur}`,
          { nom, valeur, ruleId: rule.id },
        );
      }
    }

    /* V3 : ratios produit */
    const sommeProduit =
      Number(rule.ratioShopiProduit)
      + Number(rule.ratioPartenaireProduit)
      + Number(rule.ratioAdminProduit);

    if (Math.abs(sommeProduit - 100) > RATIO_TOLERANCE) {
      throw new CommissionErreur(
        CommissionErreurType.RATIOS_INVALIDES,
        `Ratios produit invalides: ${sommeProduit} ≠ 100 (shopi=${rule.ratioShopiProduit}, partenaire=${rule.ratioPartenaireProduit}, admin=${rule.ratioAdminProduit})`,
        { sommeProduit, ruleId: rule.id },
      );
    }

    /* V4 : ratios livraison */
    const sommeLivraison =
      Number(rule.ratioShopiLivraison)
      + Number(rule.ratioPartenaireLivraison)
      + Number(rule.ratioAdminLivraison);

    if (Math.abs(sommeLivraison - 100) > RATIO_TOLERANCE) {
      throw new CommissionErreur(
        CommissionErreurType.RATIOS_INVALIDES,
        `Ratios livraison invalides: ${sommeLivraison} ≠ 100 (shopi=${rule.ratioShopiLivraison}, partenaire=${rule.ratioPartenaireLivraison}, admin=${rule.ratioAdminLivraison})`,
        { sommeLivraison, ruleId: rule.id },
      );
    }
  }

  /* ──────────────────────────────────────────────────────────
   * validerMontants() — V5 + V6
   * ────────────────────────────────────────────────────────── */

  /**
   * V5 : Montants valides — aucun montant négatif.
   * V6 : Cohérence du total — total ≈ sousTotal + fraisLivraison.
   *
   * @throws CommissionErreur(MONTANT_INCOHERENT) si violation
   */
  private validerMontants(context: CommissionContext): void {
    if (context.sousTotal < 0) {
      throw new CommissionErreur(
        CommissionErreurType.MONTANT_INCOHERENT,
        `sousTotal négatif: ${context.sousTotal}`,
        { commandeId: context.commandeId, sousTotal: context.sousTotal },
      );
    }

    if (context.fraisLivraison < 0) {
      throw new CommissionErreur(
        CommissionErreurType.MONTANT_INCOHERENT,
        `fraisLivraison négatif: ${context.fraisLivraison}`,
        { commandeId: context.commandeId, fraisLivraison: context.fraisLivraison },
      );
    }

    if (context.total < 0) {
      throw new CommissionErreur(
        CommissionErreurType.MONTANT_INCOHERENT,
        `total négatif: ${context.total}`,
        { commandeId: context.commandeId, total: context.total },
      );
    }

    const attendu = context.sousTotal + context.fraisLivraison;
    const ecart   = Math.abs(context.total - attendu);

    if (ecart > TOTAL_TOLERANCE) {
      throw new CommissionErreur(
        CommissionErreurType.MONTANT_INCOHERENT,
        `Total incohérent: total=${context.total} ≠ sousTotal+frais=${attendu} (écart: ${ecart})`,
        { commandeId: context.commandeId, total: context.total, attendu, ecart },
      );
    }
  }

  /* ──────────────────────────────────────────────────────────
   * validerPasDoublon() — V7
   * ────────────────────────────────────────────────────────── */

  /**
   * V7 : Vérifie qu'aucune distribution ESCROW n'existe déjà pour cette commande.
   * Empêche le double-calcul si le webhook est reçu deux fois.
   *
   * @throws CommissionErreur(DOUBLON_CALCUL) si distributions en ESCROW trouvées
   */
  async validerPasDoublon(commandeId: string): Promise<void> {
    const count = await this.distributionRepo.count({
      where: { commandeId, status: DistributionStatus.ESCROW },
    });

    if (count > 0) {
      throw new CommissionErreur(
        CommissionErreurType.DOUBLON_CALCUL,
        `Distributions déjà en ESCROW pour commande ${commandeId} (${count} lignes)`,
        { commandeId, count },
      );
    }
  }

  /* ──────────────────────────────────────────────────────────
   * validerHierarchie() — avertissements non bloquants
   * ────────────────────────────────────────────────────────── */

  /**
   * Émet des avertissements si la hiérarchie est incomplète.
   * NON bloquant : les parts manquantes seront absorbées par Shopi.
   *
   * @param commandeId Pour les logs
   * @param partenaireUserId null si partenaire absent
   * @param adminUserId null si admin absent
   * @param contexte Description pour les logs ('entreprise' | 'livreur' | 'correspondant')
   */
  validerHierarchie(
    commandeId:       string,
    partenaireUserId: string | null,
    adminUserId:      string | null,
    contexte:         string,
  ): void {
    if (!partenaireUserId) {
      this.logger.warn(
        `[Validator] Commande ${commandeId} — partenaire absent pour ${contexte}. ` +
        'Sa part sera absorbée par Shopi.',
      );
    }
    if (!adminUserId) {
      this.logger.warn(
        `[Validator] Commande ${commandeId} — admin absent pour ${contexte}. ` +
        'Sa part sera absorbée par Shopi.',
      );
    }
  }
}
