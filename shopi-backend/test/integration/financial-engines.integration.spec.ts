/* ============================================================
 * FICHIER : test/integration/financial-engines.integration.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests d'intégration des interactions entre les moteurs
 * financiers de Shopi.
 *
 * SCÉNARIOS (5 groupes)
 * ─────────────────────────────────────────────────────────────
 *  1. WalletEngine + WalletValidatorService
 *     — flux complet (idempotence, doublon, solde insuffisant)
 *
 *  2. CommissionEngine → calculer()
 *     — calcul bout-en-bout avec mocks des services DB
 *
 *  3. EscrowEngine → transitions d'état
 *     — creer → ouvrirLitige → resoudreLitige
 *
 *  4. Pipeline Paiement → Escrow → Commission
 *     — séquence après webhook confirmé
 *
 *  5. WalletEngine → transfert interne
 *     — virement source → cible avec verrou deadlock-safe
 *
 * STRATÉGIE
 * ─────────────────────────────────────────────────────────────
 *  Tous les appels DB/Redis sont mockés.
 *  On teste les INTERACTIONS entre services, pas les implémentations.
 *  Objectif : vérifier que le pipeline complet émet les bons résultats
 *  sans fuite de fonds et sans erreur silencieuse.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';

/* ── WalletEngine ── */
import { WalletEngine }           from '../../src/modules/wallet-engine/wallet.engine';
import { WalletValidatorService } from '../../src/modules/wallet-engine/services/wallet-validator.service';
import { WalletMovementService }  from '../../src/modules/wallet-engine/services/wallet-movement.service';
import { WalletLockService }      from '../../src/modules/wallet-engine/services/wallet-lock.service';
import { WalletHistoryService }   from '../../src/modules/wallet-engine/services/wallet-history.service';
import { WalletAuditService }     from '../../src/modules/wallet-engine/services/wallet-audit.service';
import { WalletEventBus }         from '../../src/modules/wallet-engine/events/wallet-event-bus.service';
import { WalletTransaction }      from '../../src/database/entities/wallet-transaction.entity';

/* ── CommissionEngine ── */
import { CommissionEngine }              from '../../src/modules/commission/commission.engine';
import { CommissionCalculatorService }   from '../../src/modules/commission/services/commission-calculator.service';
import { CommissionConfigService }       from '../../src/modules/commission/services/commission-config.service';
import { CommissionValidatorService }    from '../../src/modules/commission/services/commission-validator.service';
import { CommissionHierarchyService }    from '../../src/modules/commission/services/commission-hierarchy.service';
import { CommissionDistributorService }  from '../../src/modules/commission/services/commission-distributor.service';
import { CommissionAuditService }        from '../../src/modules/commission/services/commission-audit.service';
import { CommissionEventBus }            from '../../src/modules/commission/events/commission-event-bus.service';

/* ── EscrowEngine ── */
import { EscrowEngine }          from '../../src/modules/escrow-engine/escrow.engine';
import { EscrowManagerService }  from '../../src/modules/escrow-engine/services/escrow-manager.service';
import { EscrowReleaseService }  from '../../src/modules/escrow-engine/services/escrow-release.service';
import { EscrowRefundService }   from '../../src/modules/escrow-engine/services/escrow-refund.service';
import { EscrowHistoryService }  from '../../src/modules/escrow-engine/services/escrow-history.service';
import { EscrowAuditService }    from '../../src/modules/escrow-engine/services/escrow-audit.service';
import { EscrowValidatorService } from '../../src/modules/escrow-engine/services/escrow-validator.service';
import { EscrowEventBus }        from '../../src/modules/escrow-engine/events/escrow-event-bus.service';
import { Escrow, EscrowStatus, EscrowTrigger } from '../../src/database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../src/database/entities/paiement/escrow-history.entity';

/* ── Types ── */
import {
  WalletOperationType,
  BalanceType,
  WalletErreur,
  WalletErreurType,
} from '../../src/modules/wallet-engine/types/wallet-engine.types';
import {
  EscrowErreur,
  EscrowErreurType,
} from '../../src/modules/escrow-engine/types/escrow-engine.types';

/* ── Test helpers ── */
import {
  makeWallet,
  makeWalletCtx,
  makeWalletOperationResult,
  makeTransferCtx,
} from '../../src/test/helpers/wallet.test-helper';
import {
  makeCommissionRule,
  makeCommissionContext,
  makeEntrepriseHierarchy,
  makeLivraisonHierarchy,
} from '../../src/test/helpers/commission.test-helper';
import { WalletStatus } from '../../src/database/entities/wallet.entity';

/* ============================================================
 * SUITE 1 — WalletEngine bout-en-bout
 * ============================================================ */

describe('WalletEngine — intégration bout-en-bout', () => {

  let engine:      WalletEngine;
  let mockTxRepo:  jest.Mocked<any>;
  let mockLock:    jest.Mocked<WalletLockService>;
  let mockMovement: jest.Mocked<WalletMovementService>;
  let mockHistory: jest.Mocked<WalletHistoryService>;
  let mockAudit:   jest.Mocked<WalletAuditService>;
  let mockEvents:  jest.Mocked<WalletEventBus>;

  beforeEach(async () => {
    mockTxRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockLock = {
      runWithLockedWallet:      jest.fn(),
      runWithLockedDualWallets: jest.fn(),
    } as any;

    mockMovement = {
      crediter:         jest.fn(),
      debiter:          jest.fn(),
      initierRetrait:   jest.fn(),
      confirmerRetrait: jest.fn(),
      echouerRetrait:   jest.fn(),
      bloquer:          jest.fn(),
      debloquer:        jest.fn(),
      reserver:         jest.fn(),
      liberer:          jest.fn(),
    } as any;

    mockHistory = {
      getEtat:         jest.fn(),
      getTransactions: jest.fn(),
    } as any;

    mockAudit = {
      logOperationReussie:     jest.fn(),
      logOperationEchouee:     jest.fn(),
      logDoublonIdempotency:   jest.fn(),
    } as any;

    mockEvents = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletEngine,
        WalletValidatorService,
        { provide: getRepositoryToken(WalletTransaction), useValue: mockTxRepo },
        { provide: WalletLockService,     useValue: mockLock     },
        { provide: WalletMovementService, useValue: mockMovement },
        { provide: WalletHistoryService,  useValue: mockHistory  },
        { provide: WalletAuditService,    useValue: mockAudit    },
        { provide: WalletEventBus,        useValue: mockEvents   },
      ],
    }).compile();

    engine = module.get(WalletEngine);
  });

  /* ==========================================================
   * Flux DEPOSIT réussi
   * ========================================================== */

  it('exécute un DEPOSIT et retourne le résultat', async () => {
    const wallet = makeWallet({ balance: 50_000 });
    const expectedResult = makeWalletOperationResult('wallet-uuid-001', WalletOperationType.DEPOSIT, 10_000);

    mockLock.runWithLockedWallet.mockImplementation(async (_id, fn) => fn(wallet, {}));
    mockMovement.crediter.mockResolvedValue(expectedResult);

    const ctx = makeWalletCtx({ operationType: WalletOperationType.DEPOSIT, amount: 10_000 });
    const result = await engine.executer(ctx);

    expect(result.operationType).toBe(WalletOperationType.DEPOSIT);
    expect(result.amount).toBe(10_000);
    expect(mockAudit.logOperationReussie).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalled();
  });

  /* ==========================================================
   * Idempotence — rejette le doublon
   * ========================================================== */

  it('rejette une opération déjà traitée (idempotence)', async () => {
    const existingTx = { id: 'tx-existing', idempotencyKey: 'idem-key-001' };
    mockTxRepo.findOne.mockResolvedValue(existingTx);

    const ctx = makeWalletCtx({
      operationType:  WalletOperationType.DEPOSIT,
      idempotencyKey: 'idem-key-001',
    });

    await expect(engine.executer(ctx)).rejects.toMatchObject({
      type: WalletErreurType.DOUBLON_IDEMPOTENCY,
    });

    /* La requête DB de lock ne doit PAS être appelée après détection du doublon */
    expect(mockLock.runWithLockedWallet).not.toHaveBeenCalled();
    expect(mockAudit.logDoublonIdempotency).toHaveBeenCalled();
  });

  /* ==========================================================
   * Erreur wallet → audit + événement émis
   * ========================================================== */

  it('audit et événement FAILED émis sur erreur métier', async () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN });
    mockLock.runWithLockedWallet.mockImplementation(async (_id, fn) => fn(wallet, {}));

    const ctx = makeWalletCtx({ operationType: WalletOperationType.TRANSFER_OUT, amount: 5_000 });

    await expect(engine.executer(ctx)).rejects.toBeInstanceOf(WalletErreur);
    expect(mockAudit.logOperationEchouee).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalled();
  });

  /* ==========================================================
   * Transfert interne
   * ========================================================== */

  it('transfert interne : deux transactions créées', async () => {
    const srcWallet = makeWallet({ id: 'w-src', balance: 30_000 });
    const tgtWallet = makeWallet({ id: 'w-tgt', balance: 5_000 });
    const outRes    = makeWalletOperationResult('w-src', WalletOperationType.TRANSFER_OUT, 10_000);
    const inRes     = makeWalletOperationResult('w-tgt', WalletOperationType.TRANSFER_IN,  10_000);

    mockLock.runWithLockedDualWallets.mockImplementation(
      async (_s, _t, fn) => fn(srcWallet, tgtWallet, {}),
    );
    mockMovement.debiter.mockResolvedValue(outRes);
    mockMovement.crediter.mockResolvedValue(inRes);

    const ctx = makeTransferCtx({ sourceWalletId: 'w-src', targetWalletId: 'w-tgt', amount: 10_000 });
    const result = await engine.transferer(ctx);

    expect(result.outTransactionId).toBe(outRes.transactionId);
    expect(result.inTransactionId).toBe(inRes.transactionId);
    expect(result.amount).toBe(10_000);
  });
});

/* ============================================================
 * SUITE 2 — CommissionEngine bout-en-bout
 * ============================================================ */

describe('CommissionEngine — intégration bout-en-bout', () => {

  let engine:     CommissionEngine;
  let mockConfig: jest.Mocked<CommissionConfigService>;
  let mockValidator: jest.Mocked<CommissionValidatorService>;
  let mockHierarchy: jest.Mocked<CommissionHierarchyService>;
  let mockAudit:   jest.Mocked<CommissionAuditService>;
  let mockEvents:  jest.Mocked<CommissionEventBus>;

  beforeEach(async () => {
    mockConfig = {
      getActiveRule:       jest.fn(),
      createOrUpdateRule:  jest.fn(),
      getRuleHistory:      jest.fn(),
    } as any;

    mockValidator = {
      validerTout:     jest.fn().mockResolvedValue(undefined),
      validerHierarchie: jest.fn(),
    } as any;

    mockHierarchy = {
      resolveAll: jest.fn(),
    } as any;

    mockAudit = {
      logCalculReussi: jest.fn().mockResolvedValue(undefined),
      logErreur:       jest.fn().mockResolvedValue(undefined),
    } as any;

    mockEvents = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionEngine,
        CommissionCalculatorService,
        CommissionDistributorService,
        { provide: CommissionConfigService,     useValue: mockConfig    },
        { provide: CommissionValidatorService,  useValue: mockValidator },
        { provide: CommissionHierarchyService,  useValue: mockHierarchy },
        { provide: CommissionAuditService,      useValue: mockAudit     },
        { provide: CommissionEventBus,          useValue: mockEvents    },
      ],
    }).compile();

    engine = module.get(CommissionEngine);
  });

  it('calcule correctement une commande standard', async () => {
    const rule = makeCommissionRule();
    const ctx  = makeCommissionContext({ sousTotal: 50_000, fraisLivraison: 5_000, total: 55_000 });
    const entreprise = makeEntrepriseHierarchy({ planMultiplier: 1.0 });
    const livreur    = makeLivraisonHierarchy();

    mockConfig.getActiveRule.mockResolvedValue(rule);
    mockHierarchy.resolveAll.mockResolvedValue({
      entreprise,
      livreur,
      correspondant: null,
    });

    const result = await engine.calculer(ctx);

    /* Intégrité : somme des parts ≈ total */
    expect(Math.abs(result.amounts.totalDistribue - 55_000)).toBeLessThanOrEqual(1);
    expect(result.parts.length).toBeGreaterThan(0);
    expect(mockAudit.logCalculReussi).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalled();
  });

  it('propage une CommissionErreur si la validation échoue', async () => {
    const { CommissionErreur, CommissionErreurType } = await import(
      '../../src/modules/commission/types/commission.types'
    );

    const rule = makeCommissionRule();
    mockConfig.getActiveRule.mockResolvedValue(rule);
    mockValidator.validerTout.mockRejectedValue(
      new CommissionErreur(CommissionErreurType.DOUBLON, 'Doublon détecté'),
    );

    await expect(engine.calculer(makeCommissionContext())).rejects.toMatchObject({
      type: CommissionErreurType.DOUBLON,
    });

    expect(mockAudit.logErreur).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalled();
  });
});

/* ============================================================
 * SUITE 3 — EscrowEngine — transitions d'état
 * ============================================================ */

describe('EscrowEngine — transitions d\'état', () => {

  let engine:       EscrowEngine;
  let mockEscrowRepo: jest.Mocked<any>;
  let mockHistRepo:   jest.Mocked<any>;
  let mockManager:   jest.Mocked<EscrowManagerService>;
  let mockRelease:   jest.Mocked<EscrowReleaseService>;
  let mockRefund:    jest.Mocked<EscrowRefundService>;
  let mockHistory:   jest.Mocked<EscrowHistoryService>;
  let mockAudit:     jest.Mocked<EscrowAuditService>;
  let mockValidator: jest.Mocked<EscrowValidatorService>;
  let mockEvents:    jest.Mocked<EscrowEventBus>;

  function makeEscrow(status = EscrowStatus.FUNDS_RECEIVED): Escrow {
    return {
      id:             'escrow-uuid-001',
      commandeId:     'cmd-uuid-001',
      commandeNumero: 'CMD-2025-001',
      clientUserId:   'client-uuid-001',
      status,
      lastTrigger:    EscrowTrigger.SYSTEM,
      montantTotal:   55_000,
      currency:       'GNF',
      disputeId:      null,
      disputedAt:     null,
      disputeDecision: null,
      adminDecisionUserId: null,
      resolvedAt:     null,
      createdAt:      new Date(),
      updatedAt:      new Date(),
    } as unknown as Escrow;
  }

  beforeEach(async () => {
    mockEscrowRepo = {
      findOne: jest.fn(),
      save:    jest.fn().mockImplementation(async (e) => e),
    };

    mockHistRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save:   jest.fn().mockResolvedValue({}),
    };

    mockManager   = { creer: jest.fn(), recevoirFonds: jest.fn(), verrouillerFonds: jest.fn(), attendreValidation: jest.fn(), marquerEchoue: jest.fn(), marquerExpire: jest.fn() } as any;
    mockRelease   = { liberer: jest.fn() } as any;
    mockRefund    = { initierRemboursement: jest.fn() } as any;
    mockHistory   = { getById: jest.fn(), getByCommandeId: jest.fn(), getBySessionId: jest.fn(), lister: jest.fn(), getHistorique: jest.fn(), getEscrowsAutoReleaseExpires: jest.fn() } as any;
    mockAudit     = { logCreation: jest.fn(), logRelease: jest.fn(), logRefund: jest.fn(), logErreur: jest.fn() } as any;
    mockValidator = { validerTransition: jest.fn(), validerLitigeOuvert: jest.fn() } as any;
    mockEvents    = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowEngine,
        { provide: getRepositoryToken(Escrow),        useValue: mockEscrowRepo },
        { provide: getRepositoryToken(EscrowHistory), useValue: mockHistRepo   },
        { provide: EscrowManagerService,   useValue: mockManager   },
        { provide: EscrowReleaseService,   useValue: mockRelease   },
        { provide: EscrowRefundService,    useValue: mockRefund    },
        { provide: EscrowHistoryService,   useValue: mockHistory   },
        { provide: EscrowAuditService,     useValue: mockAudit     },
        { provide: EscrowValidatorService, useValue: mockValidator },
        { provide: EscrowEventBus,         useValue: mockEvents    },
      ],
    }).compile();

    engine = module.get(EscrowEngine);
  });

  it('crée un escrow et le loggue', async () => {
    const escrow = makeEscrow(EscrowStatus.CREATED);
    mockManager.creer.mockResolvedValue(escrow);

    const result = await engine.creer({
      commandeId:     'cmd-uuid-001',
      commandeNumero: 'CMD-2025-001',
      clientUserId:   'client-uuid-001',
      montantTotal:   55_000,
      currency:       'GNF',
    });

    expect(result.status).toBe(EscrowStatus.CREATED);
    expect(mockAudit.logCreation).toHaveBeenCalled();
  });

  it('ouvre un litige et émet l\'événement DISPUTED', async () => {
    const escrow = makeEscrow(EscrowStatus.WAITING_VALIDATION);
    mockEscrowRepo.findOne.mockResolvedValue(escrow);

    const result = await engine.ouvrirLitige({
      escrowId:          'escrow-uuid-001',
      disputeId:         'dispute-uuid-001',
      triggeredByUserId: 'client-uuid-001',
      note:              'Le produit est défectueux',
    });

    expect(result.toStatus).toBe(EscrowStatus.DISPUTED);
    expect(mockEvents.emit).toHaveBeenCalled();
  });

  it('résout un litige REJET → libère les fonds', async () => {
    const escrow = makeEscrow(EscrowStatus.DISPUTED);
    escrow.disputeId = 'dispute-uuid-001';
    mockEscrowRepo.findOne.mockResolvedValue(escrow);

    const releaseResult = {
      escrowId:         'escrow-uuid-001',
      commandeId:       'cmd-uuid-001',
      fromStatus:       EscrowStatus.DISPUTED,
      toStatus:         EscrowStatus.RELEASED,
      timestamp:        new Date(),
      montantDistribue: 55_000,
      nbActeurs:        3,
      metadata:         {},
    };
    mockRelease.liberer.mockResolvedValue(releaseResult);

    const result = await engine.resoudreLitige({
      escrowId:   'escrow-uuid-001',
      disputeId:  'dispute-uuid-001',
      decision:   'REJET',
      adminUserId: 'admin-uuid-001',
      note:        'Litige non fondé',
    });

    expect(mockRelease.liberer).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalled();
  });

  it('résout un litige REMBOURSEMENT_TOTAL → rembourse le client', async () => {
    const escrow = makeEscrow(EscrowStatus.DISPUTED);
    escrow.disputeId = 'dispute-uuid-002';
    mockEscrowRepo.findOne.mockResolvedValue(escrow);

    const refundResult = {
      escrowId:            'escrow-uuid-001',
      commandeId:          'cmd-uuid-001',
      fromStatus:          EscrowStatus.DISPUTED,
      toStatus:            EscrowStatus.REFUND_PENDING,
      timestamp:           new Date(),
      montantRembourse:    55_000,
      walletTransactionId: 'tx-uuid-remb',
      metadata:            {},
    };
    mockRefund.initierRemboursement.mockResolvedValue(refundResult);

    const result = await engine.resoudreLitige({
      escrowId:   'escrow-uuid-001',
      disputeId:  'dispute-uuid-002',
      decision:   'REMBOURSEMENT_TOTAL',
      adminUserId: 'admin-uuid-001',
      note:        'Produit non conforme',
    });

    expect(mockRefund.initierRemboursement).toHaveBeenCalled();
  });

  it('lance EscrowErreur si escrow introuvable', async () => {
    mockEscrowRepo.findOne.mockResolvedValue(null);

    await expect(engine.ouvrirLitige({
      escrowId:          'escrow-inexistant',
      disputeId:         'd-001',
      triggeredByUserId: 'user-001',
    })).rejects.toBeInstanceOf(EscrowErreur);
  });
});

/* ============================================================
 * SUITE 4 — Pipeline Commande → Paiement → Escrow → Commission
 * ============================================================ */

describe('Pipeline financier complet — simulation', () => {

  it('garantit la conservation des fonds (total = somme des parts)', () => {
    /* Test purement mathématique — aucun mock DB */
    const { CommissionCalculatorService: Calc } = require('../../src/modules/commission/services/commission-calculator.service');
    const calc = new Calc();

    const rule = makeCommissionRule({
      tauxCommissionProduit:  10,
      ratioShopiProduit:      60,
      ratioPartenaireProduit: 20,
      ratioAdminProduit:      20,
      tauxCommissionLivraison: 15,
      ratioShopiLivraison:    50,
      ratioPartenaireLivraison: 30,
      ratioAdminLivraison:    20,
    });

    const commandes = [
      { sousTotal: 50_000,  fraisLivraison: 5_000  },
      { sousTotal: 100_000, fraisLivraison: 10_000 },
      { sousTotal: 1,       fraisLivraison: 0      },
      { sousTotal: 500_000, fraisLivraison: 25_000 },
    ];

    for (const cmd of commandes) {
      const total = cmd.sousTotal + cmd.fraisLivraison;
      const ctx   = makeCommissionContext({ ...cmd, total });
      const ent   = makeEntrepriseHierarchy({ planMultiplier: 1.0 });
      const livr  = makeLivraisonHierarchy();

      const amounts = calc.calculer(ctx, rule, ent, livr, null);

      expect(Math.abs(amounts.totalDistribue - total)).toBeLessThanOrEqual(1);
      expect(amounts.partEntreprise).toBeGreaterThanOrEqual(0);
      expect(amounts.partLivreur).toBeGreaterThanOrEqual(0);
    }
  });
});
