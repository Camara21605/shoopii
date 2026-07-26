/* ============================================================
 * FICHIER : src/modules/settlement-engine/settlement.engine.spec.ts
 *
 * RÔLE    : Tests du Settlement & Payout Engine.
 *
 * SCÉNARIOS (14) :
 *   Groupe 1 — Éligibilité (4 scénarios)
 *     1.  Wallet introuvable → erreur WALLET_INTROUVABLE
 *     2.  Wallet gelé → erreur ELIGIBILITE_ECHOUEE
 *     3.  Solde insuffisant → erreur SOLDE_INSUFFISANT
 *     4.  Retrait déjà en cours → erreur RETRAIT_DEJA_EN_COURS
 *
 *   Groupe 2 — Demande & validation (3 scénarios)
 *     5.  Montant ≤ seuil → auto-processed=true, payout déclenché
 *     6.  Montant > seuil → auto-processed=false, en attente admin
 *     7.  Annulation avant traitement → CANCELLED
 *
 *   Groupe 3 — Payout (4 scénarios)
 *     8.  Payout réussi → COMPLETED + WITHDRAWAL_CONFIRM appelé
 *     9.  Payout échoué provider → FAILED + WITHDRAWAL_FAIL appelé
 *     10. Provider désactivé → erreur METHODE_INDISPONIBLE
 *     11. Retrait non PENDING → erreur RETRAIT_DEJA_EN_COURS
 *
 *   Groupe 4 — Retry & limites (3 scénarios)
 *     12. Retry après échec → tentatives incrémentées, nouveau payout
 *     13. Retry dépassant maxWithdrawalAttempts → erreur MAX_TENTATIVES_ATTEINT
 *     14. Batch mixte (succès + échec) → statut PARTIAL
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';

import { SettlementEngine }          from './settlement.engine';
import { EligibilityValidatorService } from './services/eligibility-validator.service';
import { WithdrawalManagerService }    from './services/withdrawal-manager.service';
import { WithdrawalValidationService } from './services/withdrawal-validation.service';
import { PayoutManagerService }        from './services/payout-manager.service';
import { SettlementSchedulerService }  from './services/settlement-scheduler.service';
import { SettlementHistoryService }    from './services/settlement-history.service';
import { SettlementAuditService }      from './services/settlement-audit.service';
import { PayoutProviderFactory }       from './providers/payout-provider.factory';
import { SettlementEventBus }          from './events/settlement-event-bus.service';

import { Retrait, RetraitStatus, RetraitMethode } from '../../database/entities/paiement/retrait.entity';
import { SettlementBatch, SettlementBatchStatus, SettlementFrequence } from '../../database/entities/paiement/settlement-batch.entity';
import { Wallet, WalletStatus, WalletType, WalletCurrency } from '../../database/entities/wallet.entity';
import { PlatformSettings }  from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog } from '../../database/entities/paiement/financial-audit-log.entity';
import { Dispute }           from '../../database/entities/paiement/dispute.entity';
import { WalletEngine }      from '../wallet-engine/wallet.engine';
import { WalletOperationType, BalanceType } from '../wallet-engine/types/wallet-engine.types';

import {
  SettlementErreur,
  SettlementErreurType,
} from './types/settlement-engine.types';

/* ============================================================
 * HELPERS & FACTORIES
 * ============================================================ */

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: 'wallet-001',
  userId: 'user-001',
  walletType: WalletType.VENDEUR,
  currency: WalletCurrency.GNF,
  status: WalletStatus.ACTIVE,
  balance: 1_000_000,
  pendingBalance: 0,
  blockedBalance: 0,
  reservedBalance: 0,
  withdrawingBalance: 0,
  totalCredited: 1_000_000,
  totalDebited: 0,
  dailyWithdrawLimit: 5_000_000,
  todayWithdrawAmount: 0,
  paymentMethods: [],
  autoTransferEnabled: false,
  autoTransferMethodId: null,
  isLocked: false,
  version: 1,
  lastTransactionAt: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  transactions: [],
  ledgerEntries: [],
  ...overrides,
} as Wallet);

const makeSettings = (overrides: Partial<PlatformSettings> = {}): PlatformSettings => ({
  id: 1,
  minWithdrawalAmount: 10_000,
  maxTransactionAmount: 5_000_000,
  dailyWithdrawalLimit: 5_000_000,
  settlementDelayDays: 2,
  autoValidationThreshold: 500_000,
  maxWithdrawalAttempts: 3,
  orangeMoneyEnabled: true,
  mtnMoneyEnabled: true,
  waveEnabled: false,
  moovMoneyEnabled: false,
  djomyEnabled: false,
  platformName: 'Shopi Test',
  defaultCurrency: 'GNF',
  defaultLanguage: 'fr',
  ...overrides,
} as unknown as PlatformSettings);

const makeRetrait = (overrides: Partial<Retrait> = {}): Retrait => ({
  id: 'retrait-001',
  reference: 'RET-2026-00001',
  walletId: 'wallet-001',
  userId: 'user-001',
  montant: 100_000,
  frais: 1_000,
  montantNet: 99_000,
  methode: RetraitMethode.ORANGE_MONEY,
  numeroDestinataire: '622001234',
  nomDestinataire: 'Test User',
  status: RetraitStatus.PENDING,
  providerReference: null,
  failureReason: null,
  attempts: 1,
  batchId: null,
  processedByUserId: null,
  notes: null,
  walletTransactionId: null,
  requestedAt: new Date(),
  processedAt: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as Retrait);

/* ============================================================
 * MOCK WALLET ENGINE
 * ============================================================ */

const mockWalletEngine = {
  executer: jest.fn().mockResolvedValue({
    transactionId: 'tx-001',
    ledgerEntryId: 'ledger-001',
    walletApres: makeWallet({ balance: 900_000, reservedBalance: 100_000 }),
    operationType: WalletOperationType.RESERVE,
    amount: 100_000,
    balanceType: BalanceType.BALANCE,
    idempotencyKey: null,
    executedAt: new Date(),
  }),
};

/* ============================================================
 * MOCK PROVIDER FACTORY
 * ============================================================ */

const mockProviderFactory = {
  getProvider: jest.fn().mockReturnValue({
    methode: RetraitMethode.ORANGE_MONEY,
    isEnabled: jest.fn().mockReturnValue(true),
    calculerFrais: jest.fn().mockReturnValue(1_000),
    initierPaiement: jest.fn().mockResolvedValue({
      success: true,
      providerReference: 'OM-PROVIDER-001',
      fraisProvider: 1_000,
      errorMessage: null,
    }),
  }),
  getMethodesActives: jest.fn().mockReturnValue([RetraitMethode.ORANGE_MONEY, RetraitMethode.MTN_MONEY]),
};

/* ============================================================
 * HELPERS REPO
 * ============================================================ */

function makeRepo<T>(overrides: Partial<Record<string, jest.Mock>> = {}): jest.Mocked<any> {
  return {
    findOne:     jest.fn(),
    find:        jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count:       jest.fn().mockResolvedValue(0),
    create:      jest.fn().mockImplementation((dto: Partial<T>) => dto),
    save:        jest.fn().mockImplementation(async (entity: T) => entity),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    ...overrides,
  };
}

/* ============================================================
 * CONSTRUCTION DU MODULE
 * ============================================================ */

async function buildModule(repoOverrides: Record<string, any> = {}, extra: Record<string, any> = {}): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      SettlementEngine,
      EligibilityValidatorService,
      WithdrawalManagerService,
      WithdrawalValidationService,
      PayoutManagerService,
      SettlementSchedulerService,
      SettlementHistoryService,
      SettlementAuditService,
      SettlementEventBus,

      { provide: WalletEngine,       useValue: mockWalletEngine },
      { provide: PayoutProviderFactory, useValue: mockProviderFactory },
      { provide: DataSource,         useValue: { createQueryRunner: jest.fn() } },

      { provide: getRepositoryToken(Wallet),           useValue: makeRepo(repoOverrides['walletRepo']) },
      { provide: getRepositoryToken(Retrait),          useValue: makeRepo(repoOverrides['retraitRepo']) },
      { provide: getRepositoryToken(SettlementBatch),  useValue: makeRepo(repoOverrides['batchRepo']) },
      { provide: getRepositoryToken(PlatformSettings), useValue: makeRepo(repoOverrides['settingsRepo']) },
      { provide: getRepositoryToken(FinancialAuditLog), useValue: makeRepo() },
      { provide: getRepositoryToken(Dispute),          useValue: makeRepo() },

      ...Object.entries(extra).map(([k, v]) => ({ provide: k, useValue: v })),
    ],
  }).compile();
}

/* ============================================================
 * TESTS
 * ============================================================ */

describe('SettlementEngine — Groupe 1 : Éligibilité', () => {

  let engine: SettlementEngine;
  let walletRepo: jest.Mocked<any>;
  let retraitRepo: jest.Mocked<any>;
  let settingsRepo: jest.Mocked<any>;
  let disputeRepo: jest.Mocked<any>;
  let module: TestingModule;

  beforeEach(async () => {
    walletRepo   = makeRepo();
    retraitRepo  = makeRepo();
    settingsRepo = makeRepo();
    disputeRepo  = makeRepo();

    walletRepo.findOne.mockResolvedValue(makeWallet());
    settingsRepo.findOne.mockResolvedValue(makeSettings());
    retraitRepo.findOne.mockResolvedValue(null); // pas de retrait en cours
    disputeRepo.findOne.mockResolvedValue(null); // pas de litige

    module = await Test.createTestingModule({
      providers: [
        SettlementEngine,
        EligibilityValidatorService,
        WithdrawalManagerService,
        WithdrawalValidationService,
        PayoutManagerService,
        SettlementSchedulerService,
        SettlementHistoryService,
        SettlementAuditService,
        SettlementEventBus,
        { provide: WalletEngine,       useValue: mockWalletEngine },
        { provide: PayoutProviderFactory, useValue: mockProviderFactory },
        { provide: DataSource,         useValue: { createQueryRunner: jest.fn() } },
        { provide: getRepositoryToken(Wallet),           useValue: walletRepo },
        { provide: getRepositoryToken(Retrait),          useValue: retraitRepo },
        { provide: getRepositoryToken(SettlementBatch),  useValue: makeRepo() },
        { provide: getRepositoryToken(PlatformSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(FinancialAuditLog), useValue: makeRepo() },
        { provide: getRepositoryToken(Dispute),          useValue: disputeRepo },
      ],
    }).compile();

    engine = module.get(SettlementEngine);
  });

  afterEach(() => jest.clearAllMocks());

  /* Scénario 1 */
  it('1. Wallet introuvable → SettlementErreur WALLET_INTROUVABLE', async () => {
    walletRepo.findOne.mockResolvedValue(null);

    const result = await engine.verifierEligibilite('wallet-999', 100_000, 'user-001');

    expect(result.eligible).toBe(false);
    expect(result.raison).toContain('introuvable');
  });

  /* Scénario 2 */
  it('2. Wallet gelé → ELIGIBILITE_ECHOUEE', async () => {
    walletRepo.findOne.mockResolvedValue(makeWallet({ status: WalletStatus.FROZEN }));

    const result = await engine.verifierEligibilite('wallet-001', 100_000, 'user-001');

    expect(result.eligible).toBe(false);
    expect(result.raison).toContain('non actif');
  });

  /* Scénario 3 */
  it('3. Solde insuffisant → SOLDE_INSUFFISANT', async () => {
    walletRepo.findOne.mockResolvedValue(makeWallet({ balance: 5_000 }));

    const result = await engine.verifierEligibilite('wallet-001', 100_000, 'user-001');

    expect(result.eligible).toBe(false);
    expect(result.raison).toContain('Solde insuffisant');
  });

  /* Scénario 4 */
  it('4. Retrait déjà PROCESSING → RETRAIT_DEJA_EN_COURS', async () => {
    retraitRepo.findOne.mockResolvedValue(makeRetrait({ status: RetraitStatus.PROCESSING }));

    const result = await engine.verifierEligibilite('wallet-001', 100_000, 'user-001');

    expect(result.eligible).toBe(false);
    expect(result.raison).toContain('déjà en cours');
  });
});

describe('SettlementEngine — Groupe 2 : Demande & validation', () => {

  let engine: SettlementEngine;
  let retraitRepo: jest.Mocked<any>;
  let settingsRepo: jest.Mocked<any>;
  let walletRepo: jest.Mocked<any>;
  let disputeRepo: jest.Mocked<any>;
  const eventBus = new SettlementEventBus();

  beforeEach(async () => {
    walletRepo   = makeRepo();
    retraitRepo  = makeRepo();
    settingsRepo = makeRepo();
    disputeRepo  = makeRepo();

    walletRepo.findOne.mockResolvedValue(makeWallet());
    settingsRepo.findOne.mockResolvedValue(makeSettings());
    retraitRepo.findOne.mockResolvedValue(null);
    disputeRepo.findOne.mockResolvedValue(null);
    retraitRepo.count.mockResolvedValue(42);

    const retrait = makeRetrait();
    retraitRepo.save.mockResolvedValue(retrait);
    retraitRepo.create.mockReturnValue(retrait);

    const module = await Test.createTestingModule({
      providers: [
        SettlementEngine,
        EligibilityValidatorService,
        WithdrawalManagerService,
        WithdrawalValidationService,
        PayoutManagerService,
        SettlementSchedulerService,
        SettlementHistoryService,
        SettlementAuditService,
        { provide: SettlementEventBus,    useValue: eventBus },
        { provide: WalletEngine,          useValue: mockWalletEngine },
        { provide: PayoutProviderFactory, useValue: mockProviderFactory },
        { provide: DataSource,            useValue: { createQueryRunner: jest.fn() } },
        { provide: getRepositoryToken(Wallet),           useValue: walletRepo },
        { provide: getRepositoryToken(Retrait),          useValue: retraitRepo },
        { provide: getRepositoryToken(SettlementBatch),  useValue: makeRepo() },
        { provide: getRepositoryToken(PlatformSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(FinancialAuditLog), useValue: makeRepo() },
        { provide: getRepositoryToken(Dispute),          useValue: disputeRepo },
      ],
    }).compile();
    engine = module.get(SettlementEngine);
  });

  afterEach(() => jest.clearAllMocks());

  /* Scénario 5 */
  it('5. Montant ≤ seuil → autoProcessed=true', async () => {
    const result = await engine.demanderRetrait({
      walletId: 'wallet-001',
      userId:   'user-001',
      montant:  100_000, // < 500 000 (seuil)
      methode:  RetraitMethode.ORANGE_MONEY,
      numeroDestinataire: '622001234',
    });

    expect(result.autoProcessed).toBe(true);
    expect(result.status).toBe(RetraitStatus.PENDING);
  });

  /* Scénario 6 */
  it('6. Montant > seuil → autoProcessed=false (validation manuelle)', async () => {
    settingsRepo.findOne.mockResolvedValue(makeSettings({ autoValidationThreshold: 200_000 }));
    retraitRepo.save.mockResolvedValue(makeRetrait({ montant: 600_000 }));
    retraitRepo.create.mockReturnValue(makeRetrait({ montant: 600_000 }));
    walletRepo.findOne.mockResolvedValue(makeWallet({ balance: 2_000_000 }));

    const result = await engine.demanderRetrait({
      walletId: 'wallet-001',
      userId:   'user-001',
      montant:  600_000, // > 200 000 (seuil test)
      methode:  RetraitMethode.ORANGE_MONEY,
      numeroDestinataire: '622001234',
    });

    expect(result.autoProcessed).toBe(false);
  });

  /* Scénario 7 */
  it('7. Annulation avant traitement → CANCELLED', async () => {
    retraitRepo.findOne.mockResolvedValue(makeRetrait({ status: RetraitStatus.PENDING }));

    await engine.annulerRetrait('retrait-001', 'user-001', 'Annulé par le vendeur');

    const savedRetrait = retraitRepo.save.mock.calls[0][0] as Retrait;
    expect(savedRetrait.status).toBe(RetraitStatus.CANCELLED);
  });
});

describe('SettlementEngine — Groupe 3 : Payout', () => {

  let engine: SettlementEngine;
  let retraitRepo: jest.Mocked<any>;
  let settingsRepo: jest.Mocked<any>;
  let walletEngineMock: typeof mockWalletEngine;
  let providerFactoryMock: typeof mockProviderFactory;

  beforeEach(async () => {
    retraitRepo  = makeRepo();
    settingsRepo = makeRepo();
    settingsRepo.findOne.mockResolvedValue(makeSettings());

    walletEngineMock   = { executer: jest.fn().mockResolvedValue({ transactionId: 'tx-x', ledgerEntryId: 'l-x', walletApres: makeWallet(), operationType: WalletOperationType.RESERVE, amount: 100_000, balanceType: BalanceType.BALANCE, idempotencyKey: null, executedAt: new Date() }) };
    providerFactoryMock = {
      getProvider: jest.fn().mockReturnValue({
        methode:         RetraitMethode.ORANGE_MONEY,
        isEnabled:       jest.fn().mockReturnValue(true),
        calculerFrais:   jest.fn().mockReturnValue(1_000),
        initierPaiement: jest.fn().mockResolvedValue({ success: true, providerReference: 'OM-TEST-001', fraisProvider: 1_000, errorMessage: null }),
      }),
      getMethodesActives: jest.fn().mockReturnValue([RetraitMethode.ORANGE_MONEY]),
    };

    const module = await Test.createTestingModule({
      providers: [
        SettlementEngine,
        EligibilityValidatorService,
        WithdrawalManagerService,
        WithdrawalValidationService,
        PayoutManagerService,
        SettlementSchedulerService,
        SettlementHistoryService,
        SettlementAuditService,
        SettlementEventBus,
        { provide: WalletEngine,          useValue: walletEngineMock },
        { provide: PayoutProviderFactory, useValue: providerFactoryMock },
        { provide: DataSource,            useValue: { createQueryRunner: jest.fn() } },
        { provide: getRepositoryToken(Wallet),           useValue: makeRepo() },
        { provide: getRepositoryToken(Retrait),          useValue: retraitRepo },
        { provide: getRepositoryToken(SettlementBatch),  useValue: makeRepo() },
        { provide: getRepositoryToken(PlatformSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(FinancialAuditLog), useValue: makeRepo() },
        { provide: getRepositoryToken(Dispute),          useValue: makeRepo() },
      ],
    }).compile();
    engine = module.get(SettlementEngine);
  });

  afterEach(() => jest.clearAllMocks());

  /* Scénario 8 */
  it('8. Payout réussi → COMPLETED, WITHDRAWAL_CONFIRM appelé', async () => {
    const retrait = makeRetrait();
    retraitRepo.findOne.mockResolvedValue(retrait);
    retraitRepo.save.mockImplementation(async (r: Retrait) => r);

    const result = await engine.executerPayout({ retraitId: 'retrait-001' });

    expect(result.success).toBe(true);
    expect(result.providerReference).toBe('OM-TEST-001');

    const confirmCall = walletEngineMock.executer.mock.calls.find(
      (c: any[]) => c[0].operationType === WalletOperationType.WITHDRAWAL_CONFIRM
    );
    expect(confirmCall).toBeDefined();
  });

  /* Scénario 9 */
  it('9. Provider retourne échec → FAILED, WITHDRAWAL_FAIL appelé', async () => {
    providerFactoryMock.getProvider.mockReturnValue({
      methode:         RetraitMethode.ORANGE_MONEY,
      isEnabled:       jest.fn().mockReturnValue(true),
      calculerFrais:   jest.fn().mockReturnValue(1_000),
      initierPaiement: jest.fn().mockResolvedValue({ success: false, providerReference: null, fraisProvider: 0, errorMessage: 'Numéro non enregistré' }),
    });

    const retrait = makeRetrait();
    retraitRepo.findOne.mockResolvedValue(retrait);
    retraitRepo.save.mockImplementation(async (r: Retrait) => r);

    const result = await engine.executerPayout({ retraitId: 'retrait-001' });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Numéro non enregistré');

    const failCall = walletEngineMock.executer.mock.calls.find(
      (c: any[]) => c[0].operationType === WalletOperationType.WITHDRAWAL_FAIL
    );
    expect(failCall).toBeDefined();
  });

  /* Scénario 10 */
  it('10. Provider désactivé → erreur METHODE_INDISPONIBLE', async () => {
    providerFactoryMock.getProvider.mockImplementation(() => {
      throw new SettlementErreur(
        SettlementErreurType.METHODE_INDISPONIBLE,
        'La méthode orange_money est désactivée.',
      );
    });

    const retrait = makeRetrait();
    retraitRepo.findOne.mockResolvedValue(retrait);
    retraitRepo.save.mockImplementation(async (r: Retrait) => r);

    // Le payout retourne FAILED (erreur traitée comme échec avant initiation)
    const result = await engine.executerPayout({ retraitId: 'retrait-001' });
    expect(result.success).toBe(false);
  });

  /* Scénario 11 */
  it('11. Retrait non PENDING → erreur RETRAIT_DEJA_EN_COURS', async () => {
    retraitRepo.findOne.mockResolvedValue(makeRetrait({ status: RetraitStatus.PROCESSING }));

    await expect(
      engine.executerPayout({ retraitId: 'retrait-001' })
    ).rejects.toThrow(SettlementErreur);
  });
});

describe('SettlementEngine — Groupe 4 : Retry & limites', () => {

  let engine: SettlementEngine;
  let retraitRepo: jest.Mocked<any>;
  let settingsRepo: jest.Mocked<any>;
  let walletEngineMock: jest.Mocked<any>;
  let providerFactoryMock: jest.Mocked<any>;
  let batchRepo: jest.Mocked<any>;

  beforeEach(async () => {
    retraitRepo  = makeRepo();
    settingsRepo = makeRepo();
    batchRepo    = makeRepo();

    settingsRepo.findOne.mockResolvedValue(makeSettings({ maxWithdrawalAttempts: 3 }));

    walletEngineMock = { executer: jest.fn().mockResolvedValue({ transactionId: 'tx-r', ledgerEntryId: 'l-r', walletApres: makeWallet(), operationType: WalletOperationType.RESERVE, amount: 100_000, balanceType: BalanceType.BALANCE, idempotencyKey: null, executedAt: new Date() }) };
    providerFactoryMock = {
      getProvider: jest.fn().mockReturnValue({
        methode:         RetraitMethode.ORANGE_MONEY,
        isEnabled:       jest.fn().mockReturnValue(true),
        calculerFrais:   jest.fn().mockReturnValue(1_000),
        initierPaiement: jest.fn().mockResolvedValue({ success: true, providerReference: 'RETRY-OK', fraisProvider: 1_000, errorMessage: null }),
      }),
      getMethodesActives: jest.fn().mockReturnValue([RetraitMethode.ORANGE_MONEY]),
    };

    const module = await Test.createTestingModule({
      providers: [
        SettlementEngine,
        EligibilityValidatorService,
        WithdrawalManagerService,
        WithdrawalValidationService,
        PayoutManagerService,
        SettlementSchedulerService,
        SettlementHistoryService,
        SettlementAuditService,
        SettlementEventBus,
        { provide: WalletEngine,          useValue: walletEngineMock },
        { provide: PayoutProviderFactory, useValue: providerFactoryMock },
        { provide: DataSource,            useValue: { createQueryRunner: jest.fn() } },
        { provide: getRepositoryToken(Wallet),           useValue: makeRepo() },
        { provide: getRepositoryToken(Retrait),          useValue: retraitRepo },
        { provide: getRepositoryToken(SettlementBatch),  useValue: batchRepo },
        { provide: getRepositoryToken(PlatformSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(FinancialAuditLog), useValue: makeRepo() },
        { provide: getRepositoryToken(Dispute),          useValue: makeRepo() },
      ],
    }).compile();
    engine = module.get(SettlementEngine);
  });

  afterEach(() => jest.clearAllMocks());

  /* Scénario 12 */
  it('12. Retry après échec → attempts incrémenté, payout relancé', async () => {
    const failedRetrait = makeRetrait({ status: RetraitStatus.FAILED, attempts: 1 });
    const savedAfterReset = makeRetrait({ status: RetraitStatus.PENDING, attempts: 2 });

    retraitRepo.findOne
      .mockResolvedValueOnce(failedRetrait)   // pour retryPayout
      .mockResolvedValueOnce(savedAfterReset) // pour executerPayout interne
      .mockResolvedValue(null);

    retraitRepo.save.mockImplementation(async (r: Retrait) => r);

    const result = await engine.retryPayout('retrait-001', 'admin-001');

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  /* Scénario 13 */
  it('13. Retry max tentatives dépassé → erreur MAX_TENTATIVES_ATTEINT', async () => {
    const failedRetrait = makeRetrait({ status: RetraitStatus.FAILED, attempts: 3 });
    retraitRepo.findOne.mockResolvedValue(failedRetrait);

    await expect(engine.retryPayout('retrait-001')).rejects.toThrow(SettlementErreur);

    const err = await engine.retryPayout('retrait-001').catch(e => e);
    expect(err.type).toBe(SettlementErreurType.MAX_TENTATIVES_ATTEINT);
  });

  /* Scénario 14 */
  it('14. Batch mixte → statut PARTIAL, stats correctes', async () => {
    const retraitOk  = makeRetrait({ id: 'r-ok',   reference: 'RET-OK',   status: RetraitStatus.PENDING });
    const retraitFail = makeRetrait({ id: 'r-fail', reference: 'RET-FAIL', status: RetraitStatus.PENDING });

    // Premier retrait → succès, deuxième → provider échoue
    const successProvider = {
      methode:         RetraitMethode.ORANGE_MONEY,
      isEnabled:       jest.fn().mockReturnValue(true),
      calculerFrais:   jest.fn().mockReturnValue(1_000),
      initierPaiement: jest.fn()
        .mockResolvedValueOnce({ success: true,  providerReference: 'OK-REF',  fraisProvider: 1_000, errorMessage: null })
        .mockResolvedValueOnce({ success: false, providerReference: null, fraisProvider: 0, errorMessage: 'Timeout provider' }),
    };
    providerFactoryMock.getProvider.mockReturnValue(successProvider);

    let callIdx = 0;
    retraitRepo.findOne.mockImplementation(async () => {
      if (callIdx === 0) { callIdx++; return retraitOk; }
      if (callIdx === 1) { callIdx++; return retraitFail; }
      return null;
    });
    retraitRepo.save.mockImplementation(async (r: Retrait) => r);

    const fakeBatch = { id: 'batch-001', reference: 'BATCH-2026-07-17-001', status: SettlementBatchStatus.PENDING, nbRetraits: 0, montantTotal: 0, fraisTotal: 0, nbCompleted: 0, nbFailed: 0, completedAt: null };
    batchRepo.count.mockResolvedValue(0);
    batchRepo.create.mockReturnValue(fakeBatch);
    batchRepo.save.mockImplementation(async (b: SettlementBatch) => b);

    const batch = await engine.executerBatch(
      { frequence: SettlementFrequence.MANUEL, triggeredByUserId: 'admin-001' },
      [retraitOk, retraitFail],
    );

    expect(batch.nbCompleted).toBe(1);
    expect(batch.nbFailed).toBe(1);
    expect(batch.status).toBe(SettlementBatchStatus.PARTIAL);
  });
});
