/* ============================================================
 * FICHIER : src/modules/commission/services/commission-calculator.service.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires exhaustifs de CommissionCalculatorService.
 * Service PURE (aucun DB, aucun effet de bord).
 *
 * GROUPES (7)
 * ─────────────────────────────────────────────────────────────
 *  1. Calcul de base          — taux, commissions brutes, entrepise
 *  2. Intégrité totale        — somme des parts = total commande
 *  3. Plans tarifaires        — STANDARD / PREMIUM / ELITE
 *  4. Livraison seule livreur — sans correspondant
 *  5. Livraison partagée      — livreur + correspondant 50/50
 *  6. Sans livreur            — frais restent plateforme
 *  7. Méthodes utilitaires    — calculerMontantFixe, calculerPlafonné
 *
 * VALEURS DE RÉFÉRENCE
 * ─────────────────────────────────────────────────────────────
 *   Commande standard : sousTotal=50 000, fraisLivraison=5 000, total=55 000
 *   Règle : produit 10% (60/20/20), livraison 15% (50/30/20)
 *   Plan STANDARD : multiplier = 1.0
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { CommissionCalculatorService } from './commission-calculator.service';
import {
  makeCommissionRule,
  makeCommissionContext,
  makeEntrepriseHierarchy,
  makeLivraisonHierarchy,
} from '../../../test/helpers/commission.test-helper';

/* ============================================================
 * SUITE
 * ============================================================ */

describe('CommissionCalculatorService', () => {

  let calculator: CommissionCalculatorService;

  beforeEach(() => {
    calculator = new CommissionCalculatorService();
  });

  /* ==========================================================
   * 1. CALCUL DE BASE
   * ========================================================== */

  describe('Calcul de base — plan STANDARD', () => {

    it('calcule la commissionProduitBrute correctement', () => {
      const rule       = makeCommissionRule({ tauxCommissionProduit: 10 });
      const ctx        = makeCommissionContext({ sousTotal: 50_000 });
      const entreprise = makeEntrepriseHierarchy({ planMultiplier: 1.0 });

      const amounts = calculator.calculer(ctx, rule, entreprise, null, null);

      // 10% × 1.0 × 50 000 = 5 000
      expect(amounts.commissionProduitBrute).toBe(5_000);
    });

    it('calcule partEntreprise = sousTotal - commissionProduitBrute', () => {
      const rule       = makeCommissionRule({ tauxCommissionProduit: 10 });
      const ctx        = makeCommissionContext({ sousTotal: 50_000 });
      const entreprise = makeEntrepriseHierarchy({ planMultiplier: 1.0 });

      const amounts = calculator.calculer(ctx, rule, entreprise, null, null);

      expect(amounts.partEntreprise).toBe(50_000 - 5_000);  // 45 000
    });

    it('répartit correctement la commission produit (60/20/20)', () => {
      const rule       = makeCommissionRule({
        tauxCommissionProduit:  10,
        ratioShopiProduit:      60,
        ratioPartenaireProduit: 20,
        ratioAdminProduit:      20,
      });
      const ctx        = makeCommissionContext({ sousTotal: 50_000 });
      const entreprise = makeEntrepriseHierarchy({ planMultiplier: 1.0 });

      const amounts = calculator.calculer(ctx, rule, entreprise, null, null);

      // commissionBrute = 5 000
      // partShopi = floor(5000 × 60/100) = 3 000
      // partPartenaire = floor(5000 × 20/100) = 1 000
      // partAdmin = 5000 - 3000 - 1000 = 1 000
      expect(amounts.partShopiProduit).toBe(3_000);
      expect(amounts.partPartenaireProduit).toBe(1_000);
      expect(amounts.partAdminProduit).toBe(1_000);
    });

    it('calcule la commission livraison correctement (15%)', () => {
      const rule = makeCommissionRule({ tauxCommissionLivraison: 15 });
      const ctx  = makeCommissionContext({ fraisLivraison: 5_000 });
      const ent  = makeEntrepriseHierarchy();

      const amounts = calculator.calculer(ctx, rule, ent, null, null);

      // floor(5000 × 15/100) = floor(750) = 750
      expect(amounts.commissionLivraisonBrute).toBe(750);
    });

    it('retourne des entiers >= 0 pour tous les montants', () => {
      const rule = makeCommissionRule();
      const ctx  = makeCommissionContext();
      const ent  = makeEntrepriseHierarchy();
      const livr = makeLivraisonHierarchy();

      const amounts = calculator.calculer(ctx, rule, ent, livr, null);

      const fields = Object.values(amounts).filter(v => typeof v === 'number') as number[];
      fields.forEach(val => {
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
      });
    });
  });

  /* ==========================================================
   * 2. INTÉGRITÉ TOTALE — la somme des parts = total commande
   * ========================================================== */

  describe('Intégrité totale (conservation des fonds)', () => {

    function verifyTotal(
      sousTotal: number,
      fraisLivraison: number,
      planMultiplier: number,
      withLivreur: boolean,
      withCorrespondant: boolean,
    ) {
      const total   = sousTotal + fraisLivraison;
      const rule    = makeCommissionRule();
      const ctx     = makeCommissionContext({ sousTotal, fraisLivraison, total });
      const ent     = makeEntrepriseHierarchy({ planMultiplier });
      const livr    = withLivreur ? makeLivraisonHierarchy() : null;
      const corr    = withCorrespondant ? makeLivraisonHierarchy({ userId: 'corr-001', walletId: 'wallet-corr-001' }) : null;

      const amounts = calculator.calculer(ctx, rule, ent, livr, corr);

      // L'écart toléré est 1 GNF (arrondi plancher)
      expect(Math.abs(amounts.totalDistribue - total)).toBeLessThanOrEqual(1);
    }

    it('50 000 + 5 000 (livreur seul, plan 1.0)', () => {
      verifyTotal(50_000, 5_000, 1.0, true, false);
    });

    it('50 000 + 5 000 (livreur + correspondant, plan 1.0)', () => {
      verifyTotal(50_000, 5_000, 1.0, true, true);
    });

    it('100 000 + 10 000 (plan PREMIUM 1.2)', () => {
      verifyTotal(100_000, 10_000, 1.2, true, false);
    });

    it('200 000 + 15 000 (plan ELITE 1.5)', () => {
      verifyTotal(200_000, 15_000, 1.5, true, true);
    });

    it('1 GNF (minimum, arrondi plancher)', () => {
      verifyTotal(1, 1, 1.0, true, false);
    });

    it('1 000 000 + 50 000 (grande commande)', () => {
      verifyTotal(1_000_000, 50_000, 1.0, true, false);
    });

    it('sans livreur ni correspondant — fonds restent plateforme', () => {
      verifyTotal(50_000, 5_000, 1.0, false, false);
    });
  });

  /* ==========================================================
   * 3. PLANS TARIFAIRES
   * ========================================================== */

  describe('Plans tarifaires', () => {

    function commProduit(planMultiplier: number): number {
      const rule = makeCommissionRule({ tauxCommissionProduit: 10 });
      const ctx  = makeCommissionContext({ sousTotal: 100_000 });
      const ent  = makeEntrepriseHierarchy({ planMultiplier });
      return calculator.calculer(ctx, rule, ent, null, null).commissionProduitBrute;
    }

    it('STANDARD (×1.0) → 10 000 GNF de commission', () => {
      expect(commProduit(1.0)).toBe(10_000);
    });

    it('PREMIUM (×1.2) → 12 000 GNF de commission', () => {
      expect(commProduit(1.2)).toBe(12_000);
    });

    it('ELITE (×1.5) → 15 000 GNF de commission', () => {
      expect(commProduit(1.5)).toBe(15_000);
    });

    it('partEntreprise DIMINUE quand le plan augmente', () => {
      const rule = makeCommissionRule({ tauxCommissionProduit: 10 });
      const ctx  = makeCommissionContext({ sousTotal: 100_000 });

      const std  = calculator.calculer(ctx, rule, makeEntrepriseHierarchy({ planMultiplier: 1.0 }), null, null).partEntreprise;
      const prem = calculator.calculer(ctx, rule, makeEntrepriseHierarchy({ planMultiplier: 1.2 }), null, null).partEntreprise;
      const elit = calculator.calculer(ctx, rule, makeEntrepriseHierarchy({ planMultiplier: 1.5 }), null, null).partEntreprise;

      expect(std).toBeGreaterThan(prem);
      expect(prem).toBeGreaterThan(elit);
    });
  });

  /* ==========================================================
   * 4. LIVRAISON — livreur seul
   * ========================================================== */

  describe('Livraison — livreur seul', () => {

    it('le livreur reçoit tout le net livraison', () => {
      const rule = makeCommissionRule({ tauxCommissionLivraison: 15 });
      const ctx  = makeCommissionContext({ fraisLivraison: 5_000 });
      const ent  = makeEntrepriseHierarchy();
      const livr = makeLivraisonHierarchy();

      const amounts = calculator.calculer(ctx, rule, ent, livr, null);

      // net = 5000 - floor(5000×15/100) = 5000 - 750 = 4250
      expect(amounts.partLivreur).toBe(4_250);
      expect(amounts.partCorrespondant).toBe(0);
    });
  });

  /* ==========================================================
   * 5. LIVRAISON — partagée livreur + correspondant
   * ========================================================== */

  describe('Livraison — partagée 50/50', () => {

    it('netLivraison divisé en 50/50 (livreur + correspondant)', () => {
      const rule = makeCommissionRule({ tauxCommissionLivraison: 20 });
      const ctx  = makeCommissionContext({ fraisLivraison: 10_000 });
      const ent  = makeEntrepriseHierarchy();
      const livr = makeLivraisonHierarchy();
      const corr = makeLivraisonHierarchy({ userId: 'corr-001', walletId: 'wallet-corr-001' });

      const amounts = calculator.calculer(ctx, rule, ent, livr, corr);

      // net = 10000 - floor(10000×20/100) = 10000 - 2000 = 8000
      // partLivreur = floor(8000 × 0.5) = 4000
      // partCorrespondant = 8000 - 4000 = 4000
      expect(amounts.partLivreur).toBe(4_000);
      expect(amounts.partCorrespondant).toBe(4_000);
    });

    it('l\'arrondi est absorbé par le correspondant', () => {
      const rule = makeCommissionRule({ tauxCommissionLivraison: 10 });
      const ctx  = makeCommissionContext({ fraisLivraison: 10_001 }); // net impair après commission
      const ent  = makeEntrepriseHierarchy();
      const livr = makeLivraisonHierarchy();
      const corr = makeLivraisonHierarchy({ userId: 'corr-001', walletId: 'wallet-corr-001' });

      const amounts = calculator.calculer(ctx, rule, ent, livr, corr);

      // Correspondant absorbe l'arrondi → partLivreur + partCorrespondant = net
      const net = 10_001 - amounts.commissionLivraisonBrute;
      expect(amounts.partLivreur + amounts.partCorrespondant).toBe(net);
    });
  });

  /* ==========================================================
   * 6. SANS LIVREUR
   * ========================================================== */

  describe('Sans livreur ni correspondant', () => {

    it('partLivreur = 0, partCorrespondant = 0', () => {
      const amounts = calculator.calculer(
        makeCommissionContext(),
        makeCommissionRule(),
        makeEntrepriseHierarchy(),
        null,
        null,
      );
      expect(amounts.partLivreur).toBe(0);
      expect(amounts.partCorrespondant).toBe(0);
    });
  });

  /* ==========================================================
   * 7. MÉTHODES UTILITAIRES
   * ========================================================== */

  describe('calculerMontantFixe', () => {

    it('répartit correctement un montant fixe (60/20/20)', () => {
      const result = calculator.calculerMontantFixe(10_000, 60, 20, 20);
      expect(result.partShopi).toBe(6_000);
      expect(result.partPartenaire).toBe(2_000);
      expect(result.partAdmin).toBe(2_000);
      expect(result.partShopi + result.partPartenaire + result.partAdmin).toBe(10_000);
    });

    it('l\'admin absorbe le résidu d\'arrondi', () => {
      const result = calculator.calculerMontantFixe(10_001, 60, 20, 20);
      expect(result.partShopi + result.partPartenaire + result.partAdmin).toBe(10_001);
    });
  });

  describe('calculerPlafonné', () => {

    it('applique le taux sans plafond ni minimum', () => {
      expect(calculator.calculerPlafonné(10_000, 10, 0, 0)).toBe(1_000);
    });

    it('respecte le plafond quand dépassé', () => {
      expect(calculator.calculerPlafonné(100_000, 10, 5_000, 0)).toBe(5_000);
    });

    it('respecte le minimum quand en dessous', () => {
      expect(calculator.calculerPlafonné(100, 1, 0, 500)).toBe(500);
    });

    it('ne retourne jamais une valeur négative', () => {
      expect(calculator.calculerPlafonné(-100, 10, 0, 0)).toBe(0);
    });
  });
});
