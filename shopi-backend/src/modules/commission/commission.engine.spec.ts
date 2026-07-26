/* ============================================================
 * FICHIER : src/modules/commission/commission.engine.spec.ts
 *
 * PHASE 14 — TESTS DU MOTEUR DE COMMISSIONS
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires du CommissionEngine et de ses sous-services.
 *
 * STRATÉGIE DE TEST
 * ─────────────────────────────────────────────────────────────
 *  CommissionCalculatorService → tests purement mathématiques
 *    (aucun mock requis — service stateless)
 *
 *  CommissionValidatorService  → tests des règles de validation
 *    (mock du repo PaiementDistribution pour V7)
 *
 *  CommissionDistributorService → tests de la redistribution
 *    (incluant absorption des parts absentes)
 *
 *  CommissionEngine (intégration) → tests bout-en-bout
 *    (tous les sous-services mockés)
 * ============================================================ */

import { Test, TestingModule }     from '@nestjs/testing';
import { getRepositoryToken }      from '@nestjs/typeorm';
import { CommissionEventBus }      from './events/commission-event-bus.service';

import { CommissionCalculatorService }  from './services/commission-calculator.service';
import { CommissionValidatorService }   from './services/commission-validator.service';
import { CommissionDistributorService } from './services/commission-distributor.service';
import { CommissionEngine }             from './commission.engine';

import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../database/entities/paiement/paiement-distribution.entity';
import { CommissionRule } from '../../database/entities/paiement/commission-rule.entity';
import {
  CommissionContext,
  CommissionErreur,
  CommissionErreurType,
} from './types/commission.types';

/* ─────────────────────────────────────────────────────────────
 * FIXTURES
 * ───────────────────────────────────────────────────────────── */

/** CommissionRule standard (STANDARD plan, ratios 60/20/20 et 70/20/10) */
const ruleFixture = {
  id:                      'rule-test-uuid',
  version:                 1,
  isActive:                true,
  tauxCommissionProduit:   6,      // 6%
  planMultiplierStandard:  1.0,
  planMultiplierPro:       0.75,
  planMultiplierPremium:   0.5,
  ratioShopiProduit:       60,
  ratioPartenaireProduit:  20,
  ratioAdminProduit:       20,
  tauxCommissionLivraison: 10,     // 10%
  ratioShopiLivraison:     70,
  ratioPartenaireLivraison:20,
  ratioAdminLivraison:     10,
} as CommissionRule;

/** Entreprise STANDARD sans partenaire ni admin */
const entrepriseFixture = {
  profileId:           'company-id',
  userId:              'company-user-id',
  nom:                 'Ma Boutique',
  plan:                'standard',
  planMultiplier:      1.0,
  partenaireProfileId: null,
  partenaireUserId:    null,
  partenaireNom:       null,
  adminProfileId:      null,
  adminUserId:         null,
  adminNom:            null,
};

/** Livreur avec partenaire et admin */
const livreurFixture = {
  profileId:           'delivery-id',
  userId:              'delivery-user-id',
  nom:                 'Ali Kouyaté',
  partenaireProfileId: 'partner-profile-id',
  partenaireUserId:    'partner-user-id',
  partenaireNom:       'Partenaire Conakry',
  adminProfileId:      'admin-profile-id',
  adminUserId:         'admin-user-id',
  adminNom:            'Admin Guinée',
};

/** Contexte commande basique */
const contextFixture: CommissionContext = {
  commandeId:      'cmd-uuid-123',
  commandeNumero:  'CMD-2025-00001',
  companyId:       'company-id',
  livreurId:       'delivery-id',
  correspondantId: null,
  sousTotal:       100_000,
  fraisLivraison:  15_000,
  total:           115_000,
};

/* ─────────────────────────────────────────────────────────────
 * SUITE 1 : CommissionCalculatorService
 * ─────────────────────────────────────────────────────────────
 * Tests purement mathématiques — aucun mock requis.
 * ───────────────────────────────────────────────────────────── */

describe('CommissionCalculatorService', () => {
  let calculator: CommissionCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommissionCalculatorService],
    }).compile();

    calculator = module.get(CommissionCalculatorService);
  });

  /* ── Calcul produit standard ── */

  describe('calculer() — plan standard', () => {
    it('devrait calculer le taux effectif correct', () => {
      const result = calculator.calculer(
        contextFixture,
        ruleFixture,
        entrepriseFixture,
        null,
        null,
      );

      /* tauxEffectif = 6% × 1.0 = 0.06 */
      expect(result.tauxEffectifProduit).toBeCloseTo(0.06, 5);
    });

    it('devrait calculer la commission produit brute correcte', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, null, null);

      /* commissionBrute = floor(100_000 × 0.06) = 6_000 */
      expect(result.commissionProduitBrute).toBe(6_000);
    });

    it('devrait calculer la part entreprise correcte', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, null, null);

      /* partEntreprise = 100_000 - 6_000 = 94_000 */
      expect(result.partEntreprise).toBe(94_000);
    });

    it('devrait distribuer les ratios shopi/partenaire/admin produit', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, null, null);

      /* shopi: floor(6000 × 60/100) = 3600 */
      /* partenaire: floor(6000 × 20/100) = 1200 */
      /* admin: 6000 - 3600 - 1200 = 1200 (absorbe l'arrondi) */
      expect(result.partShopiProduit).toBe(3_600);
      expect(result.partPartenaireProduit).toBe(1_200);
      expect(result.partAdminProduit).toBe(1_200);
      expect(result.partShopiProduit + result.partPartenaireProduit + result.partAdminProduit)
        .toBe(result.commissionProduitBrute);
    });

    it('devrait calculer la commission livraison brute', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, livreurFixture, null);

      /* commissionLivraison = floor(15_000 × 10/100) = 1500 */
      expect(result.commissionLivraisonBrute).toBe(1_500);
    });

    it('devrait donner au livreur le net livraison entier (sans correspondant)', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, livreurFixture, null);

      /* partLivreur = 15_000 - 1_500 = 13_500 */
      expect(result.partLivreur).toBe(13_500);
      expect(result.partCorrespondant).toBe(0);
    });

    it('devrait garantir que le total distribué = total commande', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entrepriseFixture, livreurFixture, null);

      expect(result.totalDistribue).toBe(contextFixture.total);
    });
  });

  /* ── Plan PRO ── */

  describe('calculer() — plan PRO', () => {
    const entreprisePro = { ...entrepriseFixture, plan: 'pro', planMultiplier: 0.75 };

    it('devrait appliquer la réduction PRO (×0.75)', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entreprisePro, null, null);

      /* tauxEffectif = 6% × 0.75 = 4.5% */
      expect(result.tauxEffectifProduit).toBeCloseTo(0.045, 5);

      /* commissionBrute = floor(100_000 × 0.045) = 4_500 */
      expect(result.commissionProduitBrute).toBe(4_500);
    });

    it('devrait toujours garantir total distribué = total commande', () => {
      const result = calculator.calculer(contextFixture, ruleFixture, entreprisePro, null, null);
      expect(result.totalDistribue).toBe(contextFixture.total);
    });
  });

  /* ── Livreur + Correspondant (50/50) ── */

  describe('calculer() — livreur + correspondant coexistent', () => {
    const correspondantFixture = {
      profileId:           'correspondant-id',
      userId:              'correspondant-user-id',
      nom:                 'Correspondant Kindia',
      partenaireProfileId: null,
      partenaireUserId:    null,
      partenaireNom:       null,
      adminProfileId:      null,
      adminUserId:         null,
      adminNom:            null,
    };

    it('devrait partager le net livraison 50/50', () => {
      const result = calculator.calculer(
        contextFixture,
        ruleFixture,
        entrepriseFixture,
        livreurFixture,
        correspondantFixture,
      );

      /* netLivraison = 15_000 - 1_500 = 13_500 */
      /* partLivreur = floor(13_500 × 0.5) = 6_750 */
      /* partCorrespondant = 13_500 - 6_750 = 6_750 */
      expect(result.partLivreur).toBe(6_750);
      expect(result.partCorrespondant).toBe(6_750);
    });

    it('devrait toujours garantir total distribué = total commande', () => {
      const result = calculator.calculer(
        contextFixture,
        ruleFixture,
        entrepriseFixture,
        livreurFixture,
        correspondantFixture,
      );
      expect(result.totalDistribue).toBe(contextFixture.total);
    });
  });

  /* ── calculerMontantFixe() ── */

  describe('calculerMontantFixe()', () => {
    it('devrait distribuer un montant fixe selon les ratios', () => {
      const result = calculator.calculerMontantFixe(10_000, 60, 20, 20);

      expect(result.partShopi).toBe(6_000);
      expect(result.partPartenaire).toBe(2_000);
      expect(result.partAdmin).toBe(2_000);
    });

    it('admin devrait absorber l\'arrondi résiduel', () => {
      /* 7 divisé par 3 : 33% / 33% / 34% → total exact garanti */
      const result = calculator.calculerMontantFixe(10_001, 33, 33, 34);

      expect(result.partShopi + result.partPartenaire + result.partAdmin).toBe(10_001);
    });
  });

  /* ── calculerPlafonné() ── */

  describe('calculerPlafonné()', () => {
    it('devrait respecter le plafond', () => {
      const commission = calculator.calculerPlafonné(1_000_000, 6, 30_000, 0);
      expect(commission).toBeLessThanOrEqual(30_000);
      expect(commission).toBe(30_000);
    });

    it('devrait respecter le minimum', () => {
      const commission = calculator.calculerPlafonné(1_000, 6, 0, 5_000);
      expect(commission).toBeGreaterThanOrEqual(5_000);
      expect(commission).toBe(5_000);
    });

    it('ne devrait jamais retourner un montant négatif', () => {
      const commission = calculator.calculerPlafonné(0, 6, 0, 0);
      expect(commission).toBeGreaterThanOrEqual(0);
    });
  });
});

/* ─────────────────────────────────────────────────────────────
 * SUITE 2 : CommissionValidatorService
 * ───────────────────────────────────────────────────────────── */

describe('CommissionValidatorService', () => {
  let validator: CommissionValidatorService;
  let mockDistributionRepo: { count: jest.Mock };

  beforeEach(async () => {
    mockDistributionRepo = { count: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionValidatorService,
        {
          provide: getRepositoryToken(PaiementDistribution),
          useValue: mockDistributionRepo,
        },
      ],
    }).compile();

    validator = module.get(CommissionValidatorService);
  });

  /* ── V1 : Règle absente ── */

  describe('validerTout() — V1 règle absente', () => {
    it('devrait rejeter si rule = null', async () => {
      await expect(
        validator.validerTout(contextFixture, null),
      ).rejects.toThrow(CommissionErreur);

      await expect(
        validator.validerTout(contextFixture, null),
      ).rejects.toMatchObject({ type: CommissionErreurType.REGLE_ABSENTE });
    });
  });

  /* ── V1 : Règle désactivée ── */

  describe('validerTout() — V1 règle désactivée', () => {
    it('devrait rejeter si isActive = false', async () => {
      const inactiveRule = { ...ruleFixture, isActive: false };

      await expect(
        validator.validerTout(contextFixture, inactiveRule as CommissionRule),
      ).rejects.toMatchObject({ type: CommissionErreurType.REGLE_DESACTIVEE });
    });
  });

  /* ── V3 : Ratios produit invalides ── */

  describe('validerTout() — V3 ratios produit invalides', () => {
    it('devrait rejeter si shopi + partenaire + admin ≠ 100', async () => {
      const badRule = {
        ...ruleFixture,
        ratioShopiProduit:      60,
        ratioPartenaireProduit: 20,
        ratioAdminProduit:      15,  // 60 + 20 + 15 = 95 ≠ 100
      };

      await expect(
        validator.validerTout(contextFixture, badRule as CommissionRule),
      ).rejects.toMatchObject({ type: CommissionErreurType.RATIOS_INVALIDES });
    });
  });

  /* ── V5 : Montant négatif ── */

  describe('validerTout() — V5 montants négatifs', () => {
    it('devrait rejeter si sousTotal < 0', async () => {
      const badContext = { ...contextFixture, sousTotal: -1000 };

      await expect(
        validator.validerTout(badContext, ruleFixture),
      ).rejects.toMatchObject({ type: CommissionErreurType.MONTANT_INCOHERENT });
    });
  });

  /* ── V7 : Doublon ── */

  describe('validerTout() — V7 doublon', () => {
    it('devrait rejeter si distributions ESCROW existent déjà', async () => {
      mockDistributionRepo.count.mockResolvedValue(3);

      await expect(
        validator.validerTout(contextFixture, ruleFixture, false),
      ).rejects.toMatchObject({ type: CommissionErreurType.DOUBLON_CALCUL });
    });

    it('devrait accepter si skipDoublonCheck = true même avec distributions existantes', async () => {
      mockDistributionRepo.count.mockResolvedValue(3);

      await expect(
        validator.validerTout(contextFixture, ruleFixture, true),
      ).resolves.toBeUndefined();
    });
  });

  /* ── Validations réussies ── */

  describe('validerTout() — cas valides', () => {
    it('devrait passer sans exception pour une règle et un contexte valides', async () => {
      await expect(
        validator.validerTout(contextFixture, ruleFixture),
      ).resolves.toBeUndefined();
    });
  });
});

/* ─────────────────────────────────────────────────────────────
 * SUITE 3 : CommissionDistributorService
 * ───────────────────────────────────────────────────────────── */

describe('CommissionDistributorService', () => {
  let distributor: CommissionDistributorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommissionDistributorService],
    }).compile();

    distributor = module.get(CommissionDistributorService);
  });

  const amounts = {
    tauxEffectifProduit:     0.06,
    tauxEffectifLivraison:   0.10,
    commissionProduitBrute:  6_000,
    partEntreprise:          94_000,
    partShopiProduit:        3_600,
    partPartenaireProduit:   1_200,
    partAdminProduit:        1_200,
    commissionLivraisonBrute:1_500,
    partLivreur:             13_500,
    partCorrespondant:       0,
    partShopiLivraison:      1_050,
    partPartenaireLivraison: 300,
    partAdminLivraison:      150,
    totalDistribue:          115_000,
  };

  const hierarchy = {
    entreprise:     entrepriseFixture,
    livreur:        livreurFixture,
    correspondant:  null,
    plateformeUserId: 'shopi-user-id',
  };

  describe('preparer() — parts complètes avec partenaire et admin', () => {
    it('devrait créer les bonnes parts pour chaque acteur', () => {
      const parts = distributor.preparer(contextFixture, amounts, hierarchy);

      const types = parts.map(p => p.acteurType);
      expect(types).toContain(DistributionActeurType.ENTREPRISE);
      expect(types).toContain(DistributionActeurType.LIVREUR);
      expect(types).toContain(DistributionActeurType.PARTENAIRE_LIVRAISON);
      expect(types).toContain(DistributionActeurType.ADMIN_LIVRAISON);
      expect(types).toContain(DistributionActeurType.PLATEFORME_PRODUIT);
      expect(types).toContain(DistributionActeurType.PLATEFORME_LIVRAISON);
    });

    it('ne devrait PAS créer de part PARTENAIRE_PRODUIT si partenaire entreprise absent', () => {
      const parts = distributor.preparer(contextFixture, amounts, hierarchy);

      const types = parts.map(p => p.acteurType);
      /* partenaireUserId est null dans entrepriseFixture */
      expect(types).not.toContain(DistributionActeurType.PARTENAIRE_PRODUIT);
    });

    it('devrait absorber la part partenaire produit dans PLATEFORME_PRODUIT', () => {
      const parts = distributor.preparer(contextFixture, amounts, hierarchy);

      const shopiProduit = parts.find(p => p.acteurType === DistributionActeurType.PLATEFORME_PRODUIT);
      /* partShopiProduit (3600) + partPartenaireProduit absorbée (1200) + partAdminProduit absorbée (1200) = 6000 */
      expect(shopiProduit?.montant).toBe(6_000);
    });
  });

  describe('preparer() — hiérarchie complète (entreprise avec partenaire+admin)', () => {
    const fullEntreprise = {
      ...entrepriseFixture,
      partenaireUserId: 'partner-enterprise-user-id',
      partenaireNom:    'Partenaire Entreprise',
      adminUserId:      'admin-enterprise-user-id',
      adminNom:         'Admin Entreprise',
    };
    const fullHierarchy = { ...hierarchy, entreprise: fullEntreprise };

    it('devrait créer toutes les 9 parts possibles', () => {
      const parts = distributor.preparer(contextFixture, amounts, fullHierarchy);

      const types = parts.map(p => p.acteurType);
      expect(types).toContain(DistributionActeurType.ENTREPRISE);
      expect(types).toContain(DistributionActeurType.LIVREUR);
      expect(types).toContain(DistributionActeurType.PARTENAIRE_PRODUIT);
      expect(types).toContain(DistributionActeurType.ADMIN_PRODUIT);
      expect(types).toContain(DistributionActeurType.PARTENAIRE_LIVRAISON);
      expect(types).toContain(DistributionActeurType.ADMIN_LIVRAISON);
      expect(types).toContain(DistributionActeurType.PLATEFORME_PRODUIT);
      expect(types).toContain(DistributionActeurType.PLATEFORME_LIVRAISON);
    });

    it('Shopi produit ne devrait recevoir que sa part propre (60%) quand partenaire+admin présents', () => {
      const parts = distributor.preparer(contextFixture, amounts, fullHierarchy);
      const shopiProduit = parts.find(p => p.acteurType === DistributionActeurType.PLATEFORME_PRODUIT);

      /* Shopi produit = partShopiProduit = 3600 (60% de 6000) */
      expect(shopiProduit?.montant).toBe(3_600);
    });
  });
});

/* ─────────────────────────────────────────────────────────────
 * SUITE 4 : CommissionEngine (intégration bouchonnée)
 * ───────────────────────────────────────────────────────────── */

describe('CommissionEngine', () => {
  let engine:           CommissionEngine;
  let mockConfigSvc:    { getActiveRule: jest.Mock };
  let mockValidatorSvc: { validerTout: jest.Mock; validerHierarchie: jest.Mock };
  let mockHierarchySvc: { resolveAll: jest.Mock };
  let mockAuditSvc:     { logCalculReussi: jest.Mock; logErreur: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock };
  let calculator:       CommissionCalculatorService;
  let distributor:      CommissionDistributorService;

  beforeEach(async () => {
    mockConfigSvc = {
      getActiveRule:     jest.fn().mockResolvedValue(ruleFixture),
    };
    mockValidatorSvc = {
      validerTout:       jest.fn().mockResolvedValue(undefined),
      validerHierarchie: jest.fn(),
    };
    mockHierarchySvc = {
      resolveAll: jest.fn().mockResolvedValue({
        entreprise:      entrepriseFixture,
        livreur:         livreurFixture,
        correspondant:   null,
        plateformeUserId:'shopi-user-id',
      }),
    };
    mockAuditSvc = {
      logCalculReussi: jest.fn().mockResolvedValue(undefined),
      logErreur:       jest.fn().mockResolvedValue(undefined),
    };
    mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionEngine,
        CommissionCalculatorService,
        CommissionDistributorService,
        { provide: 'CommissionConfigService',      useValue: mockConfigSvc },
        { provide: 'CommissionValidatorService',   useValue: mockValidatorSvc },
        { provide: 'CommissionHierarchyService',   useValue: mockHierarchySvc },
        { provide: 'CommissionAuditService',       useValue: mockAuditSvc },
        { provide: CommissionEventBus,             useValue: mockEventEmitter },
      ],
    }).compile();

    engine     = module.get(CommissionEngine);
    calculator = module.get(CommissionCalculatorService);
    distributor= module.get(CommissionDistributorService);
  });

  describe('calculer() — cas nominal', () => {
    it('devrait appeler getActiveRule une fois', async () => {
      await engine.calculer(contextFixture);
      expect(mockConfigSvc.getActiveRule).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner un CommissionResult avec des parts', async () => {
      const result = await engine.calculer(contextFixture);

      expect(result.parts.length).toBeGreaterThan(0);
      expect(result.totalDistribue).toBe(contextFixture.total);
    });

    it('devrait émettre l\'événement commission.calculated', async () => {
      await engine.calculer(contextFixture);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'commission.calculated',
        expect.objectContaining({ commandeId: contextFixture.commandeId }),
      );
    });

    it('devrait inclure le snapshotTaux dans le résultat', async () => {
      const result = await engine.calculer(contextFixture);

      expect(result.snapshotTaux).toBeDefined();
      expect(result.snapshotTaux.ruleId).toBe(ruleFixture.id);
      expect(result.snapshotTaux.calculatedAt).toBeDefined();
    });
  });

  describe('calculer() — gestion des erreurs', () => {
    it('devrait propager une CommissionErreur si validation échoue', async () => {
      mockValidatorSvc.validerTout.mockRejectedValue(
        new CommissionErreur(CommissionErreurType.DOUBLON_CALCUL, 'Doublon détecté'),
      );

      await expect(engine.calculer(contextFixture)).rejects.toThrow(CommissionErreur);
      await expect(engine.calculer(contextFixture)).rejects.toMatchObject({
        type: CommissionErreurType.DOUBLON_CALCUL,
      });
    });

    it('devrait logger l\'audit en cas d\'erreur', async () => {
      mockValidatorSvc.validerTout.mockRejectedValue(
        new CommissionErreur(CommissionErreurType.REGLE_ABSENTE, 'Pas de règle'),
      );

      try {
        await engine.calculer(contextFixture);
      } catch {
        /* ignoré */
      }

      /* Attendre le fire-and-forget */
      await new Promise(r => setTimeout(r, 10));
      expect(mockAuditSvc.logErreur).toHaveBeenCalledWith(
        contextFixture,
        expect.any(CommissionErreur),
      );
    });

    it('devrait émettre commission.failed en cas d\'erreur', async () => {
      mockValidatorSvc.validerTout.mockRejectedValue(
        new CommissionErreur(CommissionErreurType.RATIOS_INVALIDES, 'Ratios invalides'),
      );

      try {
        await engine.calculer(contextFixture);
      } catch {
        /* ignoré */
      }

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'commission.failed',
        expect.objectContaining({ commandeId: contextFixture.commandeId }),
      );
    });

    it('devrait wrapper une erreur inconnue en CommissionErreur(ERREUR_INTERNE)', async () => {
      mockValidatorSvc.validerTout.mockRejectedValue(new Error('DB connection lost'));

      await expect(engine.calculer(contextFixture)).rejects.toMatchObject({
        type: CommissionErreurType.ERREUR_INTERNE,
      });
    });
  });
});
