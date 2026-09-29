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
 *  8. Correspondant seul / sans acteur livraison — répartition exacte
 *  9. Taux Partenaire         — PartnerSettings (fixed / tier / plafond)
 * 10. Commission Entreprise   — CompanySettings (fixed / percentage /
 *                               progressive, min/max)
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
import type { CompanySetting } from '../../company-settings/company-settings.entity';
import type { PartnerSetting, PartnerTier } from '../../partner-settings/partner-settings.entity';
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

      // Les taux effectifs sont des décimaux par nature (ex : 0.1) : seuls les montants GNF sont vérifiés.
      const fields = Object.entries(amounts)
        .filter(([k, v]) => typeof v === 'number' && !k.startsWith('tauxEffectif'))
        .map(([, v]) => v as number);
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
      const corr    = withCorrespondant ? makeLivraisonHierarchy({ userId: 'corr-001' }) : null;

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
      const corr = makeLivraisonHierarchy({ userId: 'corr-001' });

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
      const corr = makeLivraisonHierarchy({ userId: 'corr-001' });

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

  /* ==========================================================
   * 8. RÉPARTITION LIVRAISON — correspondant seul / aucun acteur
   * ========================================================== */

  describe('Répartition livraison — cas limites', () => {

    /* fraisLivraison 5 000 × 15 % = 750 de commission → net 4 250
     * commission livraison répartie 50/30/20 → Shopi 375, Partenaire 225, Admin 150 */

    it('correspondant seul : il reçoit tout le net livraison', () => {
      const amounts = calculator.calculer(
        makeCommissionContext(), makeCommissionRule(), makeEntrepriseHierarchy(),
        null, makeLivraisonHierarchy({ userId: 'corr-001' }),
      );

      expect(amounts.partCorrespondant).toBe(4_250);
      expect(amounts.partLivreur).toBe(0);
      expect(amounts.totalDistribue).toBe(55_000);
    });

    it('sans livreur ni correspondant : le net livraison revient à la plateforme', () => {
      const amounts = calculator.calculer(
        makeCommissionContext(), makeCommissionRule(), makeEntrepriseHierarchy(), null, null,
      );

      expect(amounts.partLivreur).toBe(0);
      expect(amounts.partCorrespondant).toBe(0);
      /* 375 (part Shopi de la commission) + 4 250 (net livraison non attribué) */
      expect(amounts.partShopiLivraison).toBe(4_625);
      /* Les parts Partenaire / Admin ne sont PAS gonflées par le net livraison */
      expect(amounts.partPartenaireLivraison).toBe(225);
      expect(amounts.partAdminLivraison).toBe(150);
      expect(amounts.totalDistribue).toBe(55_000);
    });
  });

  /* ==========================================================
   * 9. TAUX PARTENAIRE — PartnerSettings
   * ========================================================== */

  describe('Taux Partenaire sur la commission produit (PartnerSettings)', () => {

    const tier = (minCompanies: number, commission: number, enabled = true): PartnerTier =>
      ({ minCompanies, commission, enabled } as PartnerTier);

    const partnerSettings = (overrides: Partial<PartnerSetting> = {}): PartnerSetting =>
      ({ commissionMode: 'fixed', defaultCommissionRate: 15, tiers: null, ...overrides } as PartnerSetting);

    it('sans PartnerSettings : garde le ratio par défaut de la règle', () => {
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 10, null)).toBe(20);
    });

    it("mode 'fixed' : applique defaultCommissionRate", () => {
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 0, partnerSettings({ defaultCommissionRate: 25 }))).toBe(25);
    });

    it("mode 'tier' : prend le plus haut palier ACTIF atteint", () => {
      const settings = partnerSettings({
        commissionMode: 'tier',
        tiers: [tier(0, 10), tier(5, 20), tier(10, 35, false) /* désactivé */],
      });
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 12, settings)).toBe(20);
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 3, settings)).toBe(10);
    });

    it("mode 'progressive' : même résolution par paliers que 'tier'", () => {
      const settings = partnerSettings({ commissionMode: 'progressive', tiers: [tier(0, 10), tier(5, 20)] });
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 7, settings)).toBe(20);
    });

    it('aucun palier atteint (ou tiers null) : retombe sur defaultCommissionRate', () => {
      const avecPalier = partnerSettings({ commissionMode: 'tier', defaultCommissionRate: 12, tiers: [tier(5, 20)] });
      const sansPalier = partnerSettings({ commissionMode: 'tier', defaultCommissionRate: 12, tiers: null });
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 2, avecPalier)).toBe(12);
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 2, sansPalier)).toBe(12);
    });

    it('plafonne le taux à (100 − ratio Shopi) et jamais sous 0', () => {
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 0, partnerSettings({ defaultCommissionRate: 55 }))).toBe(40);
      expect(calculator.resoudreTauxPartenaireProduit(20, 60, 0, partnerSettings({ defaultCommissionRate: -5 }))).toBe(0);
    });

    it('calculer() : le taux PartnerSettings remplace le ratio de la règle, Admin absorbe la différence', () => {
      /* commission produit 5 000 : Shopi 60 % = 3 000, Partenaire 30 % = 1 500, Admin = 500 */
      const ent = makeEntrepriseHierarchy({ partenaireUserId: 'partner-001', partenaireTotalCompanies: 3 });
      const amounts = calculator.calculer(
        makeCommissionContext(), makeCommissionRule(), ent, makeLivraisonHierarchy(), null,
        null, partnerSettings({ defaultCommissionRate: 30 }),
      );

      expect(amounts.ratioPartenaireProduitEffectif).toBe(30);
      expect(amounts.partShopiProduit).toBe(3_000);
      expect(amounts.partPartenaireProduit).toBe(1_500);
      expect(amounts.partAdminProduit).toBe(500);
      expect(amounts.totalDistribue).toBe(55_000);
    });

    it("calculer() : PartnerSettings ignorée si l'entreprise n'a pas de partenaire", () => {
      const amounts = calculator.calculer(
        makeCommissionContext(), makeCommissionRule(), makeEntrepriseHierarchy(), makeLivraisonHierarchy(), null,
        null, partnerSettings({ defaultCommissionRate: 30 }),
      );

      expect(amounts.ratioPartenaireProduitEffectif).toBe(20);
      expect(amounts.partPartenaireProduit).toBe(1_000);
    });
  });

  /* ==========================================================
   * 10. COMMISSION ENTREPRISE — CompanySettings
   * ========================================================== */

  describe('Commission produit spécifique (CompanySettings)', () => {

    const companySettings = (overrides: Partial<CompanySetting> = {}): CompanySetting =>
      ({
        commissionType: 'percentage', commissionValue: 8,
        commissionMin: 0, commissionMax: 0, commissionBrackets: null,
        ...overrides,
      } as CompanySetting);

    it('sans CompanySettings : taux de la règle × multiplicateur du plan', () => {
      const r = calculator.resoudreCommissionProduit(50_000, 0.10, 0.75, null);
      expect(r.tauxEffectifProduit).toBeCloseTo(0.075);
      expect(r.commissionProduitBrute).toBe(3_750);
    });

    describe("mode 'fixed' (montant par commande)", () => {

      it('applique le montant × multiplicateur du plan', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.5,
          companySettings({ commissionType: 'fixed', commissionValue: 2_000 }));
        expect(r.commissionProduitBrute).toBe(3_000);
        expect(r.tauxEffectifProduit).toBeCloseTo(0.06);
      });

      it('respecte le plafond commissionMax', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0,
          companySettings({ commissionType: 'fixed', commissionValue: 3_000, commissionMax: 2_500 }));
        expect(r.commissionProduitBrute).toBe(2_500);
      });

      it('ne dépasse jamais le sousTotal de la commande', () => {
        const r = calculator.resoudreCommissionProduit(1_000, 0.10, 1.0,
          companySettings({ commissionType: 'fixed', commissionValue: 3_000 }));
        expect(r.commissionProduitBrute).toBe(1_000);
        expect(r.tauxEffectifProduit).toBe(1);
      });

      it('sousTotal nul : commission et taux à 0 (pas de division par zéro)', () => {
        const r = calculator.resoudreCommissionProduit(0, 0.10, 1.0,
          companySettings({ commissionType: 'fixed', commissionValue: 3_000 }));
        expect(r.commissionProduitBrute).toBe(0);
        expect(r.tauxEffectifProduit).toBe(0);
      });
    });

    describe("mode 'percentage'", () => {

      it('applique commissionValue % du sousTotal (remplace le taux de la règle)', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0, companySettings());
        expect(r.commissionProduitBrute).toBe(4_000);
        expect(r.tauxEffectifProduit).toBeCloseTo(0.08);
      });

      it('applique le plancher commissionMin', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0, companySettings({ commissionMin: 5_000 }));
        expect(r.commissionProduitBrute).toBe(5_000);
      });

      it('applique le plafond commissionMax', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0, companySettings({ commissionMax: 3_000 }));
        expect(r.commissionProduitBrute).toBe(3_000);
      });

      it('type inconnu : traité comme un pourcentage', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0, companySettings({ commissionType: 'autre' }));
        expect(r.commissionProduitBrute).toBe(4_000);
      });
    });

    describe("mode 'progressive' (tranches sur le sousTotal de la commande)", () => {

      const brackets = [
        { from: 0,      to: 10_000, rate: 10 },
        { from: 10_001, to: null,   rate: 5 },
      ];

      it('applique le taux de la tranche correspondante', () => {
        const petit = calculator.resoudreCommissionProduit(5_000, 0.10, 1.0,
          companySettings({ commissionType: 'progressive', commissionBrackets: brackets }));
        const grand = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0,
          companySettings({ commissionType: 'progressive', commissionBrackets: brackets }));
        expect(petit.commissionProduitBrute).toBe(500);
        expect(grand.commissionProduitBrute).toBe(2_500);
      });

      it('aucune tranche ne correspond : utilise la dernière tranche', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0,
          companySettings({ commissionType: 'progressive', commissionBrackets: [{ from: 0, to: 1_000, rate: 10 }] }));
        expect(r.commissionProduitBrute).toBe(5_000);
      });

      it('sans tranches : retombe sur commissionValue en pourcentage', () => {
        const r = calculator.resoudreCommissionProduit(50_000, 0.10, 1.0,
          companySettings({ commissionType: 'progressive', commissionBrackets: [] }));
        expect(r.commissionProduitBrute).toBe(4_000);
      });
    });

    it('calculer() : CompanySettings modifie la part entreprise sans casser la conservation des fonds', () => {
      const amounts = calculator.calculer(
        makeCommissionContext(), makeCommissionRule(), makeEntrepriseHierarchy(), makeLivraisonHierarchy(), null,
        companySettings(),
      );

      expect(amounts.commissionProduitBrute).toBe(4_000);
      expect(amounts.partEntreprise).toBe(46_000);
      expect(amounts.totalDistribue).toBe(55_000);
    });
  });
});
