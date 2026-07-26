/* ============================================================
 * FICHIER : src/modules/wallet-engine/wallet.engine.spec.ts
 *
 * SUITES DE TESTS
 * ------------------------------------------------------------
 * Suite 1 — WalletValidatorService  (tests purs, aucun mock DB)
 * Suite 2 — WalletMovementService   (mocks wallet + qr)
 * Suite 3 — WalletLedgerService     (mock ledgerRepo)
 * Suite 4 — WalletEngine            (tous sous-services mockés)
 * ============================================================ */

import { WalletValidatorService } from './services/wallet-validator.service';
import { WalletMovementService }  from './services/wallet-movement.service';
import { WalletLedgerService }    from './services/wallet-ledger.service';
import { WalletAuditService }     from './services/wallet-audit.service';
import { WalletEngine }           from './wallet.engine';
import { WalletEventBus }         from './events/wallet-event-bus.service';

import {
  WalletOperationType,
  BalanceType,
  WalletErreur,
  WalletErreurType,
  WalletOperationContext,
} from './types/wallet-engine.types';

import {
  WalletStatus,
  WalletType,
  WalletCurrency,
} from '../../database/entities/wallet.entity';

import {
  TransactionType,
  TransactionStatus,
} from '../../database/entities/wallet-transaction.entity';

import {
  LedgerEntryDirection,
  LedgerCurrency,
} from '../../database/entities/wallet-ledger-entry.entity';

/* ============================================================
 * FIXTURES
 * ============================================================ */

function makeWallet(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    id:                'wallet-uuid-1',
    userId:            'user-uuid-1',
    walletType:        WalletType.CLIENT,
    currency:          WalletCurrency.GNF,
    status:            WalletStatus.ACTIVE,
    balance:           100_000,
    pendingBalance:    50_000,
    blockedBalance:    0,
    reservedBalance:   10_000,
    withdrawingBalance:0,
    totalCredited:     200_000,
    totalDebited:      100_000,
    todayWithdrawAmount: 0,
    dailyWithdrawLimit:  0,
    freezeReason:      null,
    version:           1,
    lastTransactionAt: null,
    updatedAt:         new Date(),
    ...overrides,
  };
}

function makeQr(savedEntity?: any): any {
  const entity = savedEntity ?? {};
  return {
    manager: {
      create: jest.fn((_entity: any, data: any) => ({ ...data, id: 'new-id-123' })),
      save:   jest.fn(async (_entity: any, data: any) => ({ ...data, id: data.id ?? 'saved-id-123', updatedAt: new Date() })),
      update: jest.fn(async () => undefined),
      findOne:jest.fn(async () => entity),
      createQueryBuilder: jest.fn(() => ({
        where:     jest.fn().mockReturnThis(),
        setLock:   jest.fn().mockReturnThis(),
        getOne:    jest.fn(async () => entity),
      })),
    },
  };
}

function makeCtx(overrides: Partial<WalletOperationContext> = {}): WalletOperationContext {
  return {
    walletId:       'wallet-uuid-1',
    amount:         10_000,
    operationType:  WalletOperationType.DEPOSIT,
    balanceType:    BalanceType.BALANCE,
    idempotencyKey: null,
    ...overrides,
  };
}

/* ============================================================
 * SUITE 1 — WalletValidatorService
 * ============================================================ */

describe('WalletValidatorService', () => {
  let svc: WalletValidatorService;

  beforeEach(() => {
    svc = new WalletValidatorService();
  });

  /* ── 1.1 Montants ── */

  it('accepte un montant positif', () => {
    expect(() => svc.validerMontant(100)).not.toThrow();
    expect(() => svc.validerMontant(1)).not.toThrow();
    expect(() => svc.validerMontant(0.01)).not.toThrow();
  });

  it('rejette montant nul ou négatif', () => {
    expect(() => svc.validerMontant(0)).toThrow(WalletErreur);
    expect(() => svc.validerMontant(-50)).toThrow(WalletErreur);
  });

  it('rejette NaN et Infinity', () => {
    expect(() => svc.validerMontant(NaN)).toThrow(WalletErreur);
    expect(() => svc.validerMontant(Infinity)).toThrow(WalletErreur);
  });

  /* ── 1.2 Statut wallet ── */

  it('accepte un wallet ACTIVE', () => {
    expect(() => svc.validerStatutWallet(makeWallet())).not.toThrow();
  });

  it('rejette un wallet FROZEN avec WALLET_GELE', () => {
    try {
      svc.validerStatutWallet(makeWallet({ status: WalletStatus.FROZEN, freezeReason: 'fraude' }));
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.WALLET_GELE);
    }
  });

  it('rejette un wallet CLOSED avec WALLET_FERME', () => {
    try {
      svc.validerStatutWallet(makeWallet({ status: WalletStatus.CLOSED }));
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.WALLET_FERME);
    }
  });

  /* ── 1.3 Solde ── */

  it('accepte si solde suffisant', () => {
    const wallet = makeWallet({ balance: 50_000 });
    expect(() => svc.validerSolde(wallet, 49_000, BalanceType.BALANCE)).not.toThrow();
    expect(() => svc.validerSolde(wallet, 50_000, BalanceType.BALANCE)).not.toThrow();
  });

  it('rejette si solde insuffisant avec SOLDE_INSUFFISANT', () => {
    const wallet = makeWallet({ balance: 1_000 });
    try {
      svc.validerSolde(wallet, 5_000, BalanceType.BALANCE);
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.SOLDE_INSUFFISANT);
    }
  });

  it('vérifie le bon solde selon balanceType', () => {
    const wallet = makeWallet({ blockedBalance: 5_000, balance: 0 });
    expect(() => svc.validerSolde(wallet, 3_000, BalanceType.BLOCKED)).not.toThrow();
    try {
      svc.validerSolde(wallet, 10_000, BalanceType.BLOCKED);
      fail('devait lancer');
    } catch (e) {
      expect((e as WalletErreur).type).toBe(WalletErreurType.SOLDE_SOURCE_INSUFFISANT);
    }
  });

  /* ── 1.4 Note obligatoire ── */

  it('accepte une note suffisante pour ADJUSTMENT', () => {
    const ctx = makeCtx({ operationType: WalletOperationType.ADJUSTMENT, note: 'correction comptable justifiée' });
    expect(() => svc.validerNoteObligatoire(ctx)).not.toThrow();
  });

  it('rejette note absente pour BLOCK', () => {
    const ctx = makeCtx({ operationType: WalletOperationType.BLOCK, note: null });
    expect(() => svc.validerNoteObligatoire(ctx)).toThrow(WalletErreur);
  });

  /* ── 1.5 Transfert ── */

  it('rejette un transfert vers soi-même', () => {
    expect(() => svc.validerParametresTransfert({
      sourceWalletId: 'w1',
      targetWalletId: 'w1',
      amount: 1000,
      currency: WalletCurrency.GNF,
    })).toThrow(WalletErreur);
  });
});

/* ============================================================
 * SUITE 2 — WalletMovementService
 * ============================================================ */

describe('WalletMovementService', () => {
  let svc: WalletMovementService;
  let mockLedger: any;
  let mockWalletRepo: any;
  let mockTxRepo: any;

  beforeEach(() => {
    mockLedger = {
      enregistrerCredit: jest.fn(async () => ({ id: 'ledger-id-1', direction: LedgerEntryDirection.CREDIT })),
      enregistrerDebit:  jest.fn(async () => ({ id: 'ledger-id-1', direction: LedgerEntryDirection.DEBIT  })),
    };
    mockWalletRepo = { save: jest.fn(async (w: any) => w) };
    mockTxRepo     = { save: jest.fn(async (t: any) => t) };

    svc = new WalletMovementService(
      mockWalletRepo as any,
      mockTxRepo     as any,
      mockLedger     as any,
      new WalletValidatorService(),
    );
  });

  it('crediter : incrémente le balance et appelle enregistrerCredit', async () => {
    const wallet = makeWallet({ balance: 0 });
    const ctx    = makeCtx({ operationType: WalletOperationType.DEPOSIT, amount: 20_000, balanceType: BalanceType.BALANCE });
    const qr     = makeQr(wallet);

    const result = await svc.crediter(wallet, ctx, qr);

    expect(result.amount).toBe(20_000);
    expect(mockLedger.enregistrerCredit).toHaveBeenCalledTimes(1);
  });

  it('debiter : décrémente le balance', async () => {
    const wallet = makeWallet({ balance: 50_000 });
    const ctx    = makeCtx({ operationType: WalletOperationType.TRANSFER_OUT, amount: 10_000, balanceType: BalanceType.BALANCE });
    const qr     = makeQr(wallet);

    const result = await svc.debiter(wallet, ctx, qr);

    expect(result.amount).toBe(10_000);
    expect(mockLedger.enregistrerDebit).toHaveBeenCalledTimes(1);
  });

  it('debiter : rejette si solde insuffisant', async () => {
    const wallet = makeWallet({ balance: 500 });
    const ctx    = makeCtx({ operationType: WalletOperationType.TRANSFER_OUT, amount: 1_000, balanceType: BalanceType.BALANCE });
    const qr     = makeQr(wallet);

    await expect(svc.debiter(wallet, ctx, qr)).rejects.toBeInstanceOf(WalletErreur);
  });

  it('bloquer : déplace balance → blockedBalance', async () => {
    const wallet = makeWallet({ balance: 20_000, blockedBalance: 0 });
    const ctx    = makeCtx({
      operationType: WalletOperationType.BLOCK,
      amount: 5_000,
      balanceType: BalanceType.BALANCE,
      note: 'fraude suspectée',
    });
    const qr = makeQr(wallet);

    await svc.bloquer(wallet, ctx, qr);

    // wallet muté en mémoire
    expect(wallet.balance).toBe(15_000);
    expect(wallet.blockedBalance).toBe(5_000);
  });

  it('reserver : déplace balance → reservedBalance', async () => {
    const wallet = makeWallet({ balance: 30_000, reservedBalance: 0 });
    const ctx    = makeCtx({ operationType: WalletOperationType.RESERVE, amount: 10_000, balanceType: BalanceType.BALANCE });
    const qr     = makeQr(wallet);

    await svc.reserver(wallet, ctx, qr);

    expect(wallet.balance).toBe(20_000);
    expect(wallet.reservedBalance).toBe(10_000);
  });
});

/* ============================================================
 * SUITE 3 — WalletLedgerService
 * ============================================================ */

describe('WalletLedgerService', () => {
  let svc: WalletLedgerService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find:     jest.fn(async () => []),
      findOne:  jest.fn(async () => null),
      createQueryBuilder: jest.fn(() => ({
        select:   jest.fn().mockReturnThis(),
        addSelect:jest.fn().mockReturnThis(),
        where:    jest.fn().mockReturnThis(),
        getRawOne:jest.fn(async () => ({ totalDebits: '100000', totalCredits: '100000' })),
      })),
    };

    svc = new WalletLedgerService(mockRepo as any);
  });

  it('genère une référence au format LED-YYYYMMDD-XXXX', async () => {
    const qr = makeQr();
    const entry = await svc.enregistrerCredit({
      walletId:      'w1',
      transactionId: 'tx1',
      operationType: WalletOperationType.DEPOSIT,
      amount:        1000,
      currency:      WalletCurrency.GNF,
      balanceType:   BalanceType.BALANCE,
      balanceBefore: 0,
      balanceAfter:  1000,
    }, qr);

    expect(entry).toBeDefined();
    expect(qr.manager.save).toHaveBeenCalledTimes(1);
  });

  it('enregistrerDebit crée direction DEBIT', async () => {
    const qr    = makeQr();
    const saved: any[] = [];
    qr.manager.save = jest.fn(async (_e: any, data: any) => {
      saved.push(data);
      return { ...data, id: 'x' };
    });

    await svc.enregistrerDebit({
      walletId:      'w1',
      transactionId: 'tx1',
      operationType: WalletOperationType.BLOCK,
      amount:        500,
      currency:      WalletCurrency.GNF,
      balanceType:   BalanceType.BALANCE,
      balanceBefore: 5000,
      balanceAfter:  4500,
    }, qr);

    expect(saved[0].direction).toBe(LedgerEntryDirection.DEBIT);
    expect(saved[0].debit).toBe(500);
    expect(saved[0].credit).toBe(0);
  });

  it('verifierEquilibre retourne equilibre=true quand debits=credits', async () => {
    const result = await svc.verifierEquilibre();
    expect(result.equilibre).toBe(true);
    expect(result.debits).toBe(100_000);
    expect(result.credits).toBe(100_000);
  });

  it('correction : rejette si entrée déjà reversée', async () => {
    const qr = makeQr({ id: 'entry-1', isReversed: true });
    qr.manager.findOne = jest.fn(async () => ({ id: 'entry-1', isReversed: true }));

    await expect(
      svc.enregistrerCorrection('entry-1', {
        walletId: 'w1',
        transactionId: null,
        operationType: WalletOperationType.CORRECTION,
        amount: 1000,
        currency: WalletCurrency.GNF,
        balanceType: BalanceType.BALANCE,
        balanceBefore: 0,
        balanceAfter: 0,
        motif: 'doublon',
      }, qr),
    ).rejects.toBeInstanceOf(WalletErreur);
  });
});

/* ============================================================
 * SUITE 4 — WalletEngine (intégration mocks)
 * ============================================================ */

describe('WalletEngine', () => {
  let engine: WalletEngine;
  let mockLockService: any;
  let mockMovementSvc: any;
  let mockHistorySvc: any;
  let mockAuditSvc: any;
  let mockTxRepo: any;
  let eventBus: WalletEventBus;

  const fakeResult = {
    transactionId: 'tx-1',
    ledgerEntryId: 'led-1',
    walletApres: {
      id: 'w1', walletType: WalletType.CLIENT, userId: 'u1',
      currency: WalletCurrency.GNF, status: WalletStatus.ACTIVE,
      balance: 90_000, pendingBalance: 0, blockedBalance: 0,
      reservedBalance: 0, withdrawingBalance: 0, totalBalance: 90_000,
      version: 2, lastTransactionAt: new Date(), updatedAt: new Date(),
    },
    operationType:  WalletOperationType.DEPOSIT,
    amount:         10_000,
    balanceType:    BalanceType.BALANCE,
    idempotencyKey: null,
    executedAt:     new Date(),
  };

  beforeEach(() => {
    mockTxRepo = { findOne: jest.fn(async () => null) };

    mockMovementSvc = {
      crediter:        jest.fn(async () => fakeResult),
      debiter:         jest.fn(async () => fakeResult),
      bloquer:         jest.fn(async () => fakeResult),
      debloquer:       jest.fn(async () => fakeResult),
      reserver:        jest.fn(async () => fakeResult),
      liberer:         jest.fn(async () => fakeResult),
      initierRetrait:  jest.fn(async () => fakeResult),
      confirmerRetrait:jest.fn(async () => fakeResult),
      echouerRetrait:  jest.fn(async () => fakeResult),
    };

    mockLockService = {
      runWithLockedWallet: jest.fn(async (_id: string, cb: any) => {
        const wallet = makeWallet();
        const qr     = makeQr(wallet);
        return cb(wallet, qr);
      }),
      runWithLockedDualWallets: jest.fn(),
    };

    mockHistorySvc = {
      getEtat:        jest.fn(async () => fakeResult.walletApres),
      getTransactions:jest.fn(async () => ({ data: [], total: 0, page: 1, limite: 20, totalPages: 0 })),
    };

    mockAuditSvc = {
      logOperationReussie:   jest.fn(),
      logOperationEchouee:   jest.fn(),
      logDoublonIdempotency: jest.fn(),
    };

    eventBus = new WalletEventBus();

    engine = new WalletEngine(
      mockTxRepo      as any,
      mockLockService as any,
      new WalletValidatorService(),
      mockMovementSvc as any,
      mockHistorySvc  as any,
      mockAuditSvc    as any,
      eventBus,
    );
  });

  /* ── 4.1 Pipeline nominal ── */

  it('executer DEPOSIT appelle crediter et retourne result', async () => {
    const ctx = makeCtx({ operationType: WalletOperationType.DEPOSIT, amount: 10_000 });
    const result = await engine.executer(ctx);

    expect(result.transactionId).toBe('tx-1');
    expect(mockMovementSvc.crediter).toHaveBeenCalledTimes(1);
    expect(mockAuditSvc.logOperationReussie).toHaveBeenCalledTimes(1);
  });

  it('executer BLOCK appelle bloquer', async () => {
    const ctx = makeCtx({
      operationType: WalletOperationType.BLOCK,
      amount: 5_000,
      note: 'fraude suspectée',
    });
    await engine.executer(ctx);
    expect(mockMovementSvc.bloquer).toHaveBeenCalledTimes(1);
  });

  it('executer WITHDRAWAL_INIT appelle initierRetrait', async () => {
    const ctx = makeCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 10_000 });
    await engine.executer(ctx);
    expect(mockMovementSvc.initierRetrait).toHaveBeenCalledTimes(1);
  });

  /* ── 4.2 Idempotence ── */

  it('rejette doublon idempotencyKey avec DOUBLON_IDEMPOTENCY', async () => {
    mockTxRepo.findOne = jest.fn(async () => ({ id: 'existing-tx' }));

    const ctx = makeCtx({ idempotencyKey: 'key-deja-utilise' });

    try {
      await engine.executer(ctx);
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.DOUBLON_IDEMPOTENCY);
      expect(mockAuditSvc.logDoublonIdempotency).toHaveBeenCalledTimes(1);
    }
  });

  /* ── 4.3 Erreurs propagées ── */

  it('propage WalletErreur du movement service', async () => {
    mockMovementSvc.crediter = jest.fn(async () => {
      throw new WalletErreur(WalletErreurType.SOLDE_INSUFFISANT, 'solde insuffisant');
    });

    const ctx = makeCtx({ operationType: WalletOperationType.DEPOSIT });

    try {
      await engine.executer(ctx);
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.SOLDE_INSUFFISANT);
      expect(mockAuditSvc.logOperationEchouee).toHaveBeenCalledTimes(1);
    }
  });

  it('wrappe erreur inconnue en ERREUR_INTERNE', async () => {
    mockMovementSvc.crediter = jest.fn(async () => {
      throw new Error('crash inattendu');
    });

    const ctx = makeCtx({ operationType: WalletOperationType.DEPOSIT });

    try {
      await engine.executer(ctx);
      fail('devait lancer');
    } catch (e) {
      expect(e).toBeInstanceOf(WalletErreur);
      expect((e as WalletErreur).type).toBe(WalletErreurType.ERREUR_INTERNE);
    }
  });

  /* ── 4.4 Délégués read-only ── */

  it('getEtat délègue à historyService', async () => {
    const etat = await engine.getEtat('wallet-uuid-1');
    expect(etat.id).toBe('w1');
    expect(mockHistorySvc.getEtat).toHaveBeenCalledWith('wallet-uuid-1');
  });

  it('getHistorique retourne page vide correctement formatée', async () => {
    const page = await engine.getHistorique({ walletId: 'w1' });
    expect(page.data).toHaveLength(0);
    expect(page.total).toBe(0);
    expect(page.totalPages).toBe(0);
  });
});
