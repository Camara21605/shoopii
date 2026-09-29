/* ============================================================
 * FICHIER : src/modules/wallet-engine/wallet.engine.flux.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de bout en bout du WalletEngine avec les VRAIS services
 * de mouvement et de validation (seuls la base de données, le
 * verrou, l'historique et l'audit sont simulés) :
 *
 *  1. Virement entre deux wallets — conservation de l'argent,
 *     rejets (devise, solde, statut, soi-même), idempotence
 *  2. Garde-fous du séquestre — une libération ne peut pas dépasser
 *     le montant en attente (sinon de l'argent serait créé)
 *  3. Événements émis après chaque type d'opération
 * ============================================================ */

import { WalletEngine } from './wallet.engine';
import { WalletMovementService } from './services/wallet-movement.service';
import { WalletValidatorService } from './services/wallet-validator.service';
import { WalletEventBus, WALLET_EVENTS } from './events/wallet-event-bus.service';
import { Wallet, WalletCurrency, WalletStatus, WalletType } from '../../database/entities/wallet.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import {
  BalanceType,
  WalletErreur,
  WalletErreurType,
  WalletOperationType,
} from './types/wallet-engine.types';
import { makeTransferCtx, makeWallet, makeWalletCtx } from '../../test/helpers/wallet.test-helper';

/* ============================================================
 * MONTAGE
 * ============================================================ */

const argentTotal = (w: Wallet): number =>
  w.balance + w.pendingBalance + w.blockedBalance + w.reservedBalance + w.withdrawingBalance;

function makeQr() {
  let n = 0;
  return {
    manager: {
      create: jest.fn((_e: unknown, d: Record<string, unknown>) => ({ ...d })),
      save:   jest.fn(async (e: unknown, d: Record<string, unknown>) =>
        e === WalletTransaction ? { ...d, id: `tx-${++n}` } : d),
      update: jest.fn(async () => undefined),
    },
  } as any;
}

function monter(wallets: Record<string, Wallet>) {
  const txRepo  = { findOne: jest.fn(async () => null) };
  const lock = {
    runWithLockedWallet: jest.fn(async (id: string, fn: any) => fn(wallets[id], makeQr())),
    runWithLockedDualWallets: jest.fn(async (a: string, b: string, fn: any) => fn(wallets[a], wallets[b], makeQr())),
  };
  const ledger = {
    enregistrerCredit: jest.fn(async () => ({ id: 'led-c' })),
    enregistrerDebit:  jest.fn(async () => ({ id: 'led-d' })),
  };
  const validator = new WalletValidatorService();
  const movement  = new WalletMovementService({} as any, {} as any, ledger as any, validator);
  const audit     = { logOperationReussie: jest.fn(), logOperationEchouee: jest.fn(), logDoublonIdempotency: jest.fn() };
  const eventBus  = new WalletEventBus();
  const emit      = jest.spyOn(eventBus, 'emit');

  const engine = new WalletEngine(
    txRepo as any, lock as any, validator, movement, { getEtat: jest.fn() } as any, audit as any, eventBus,
  );
  return { engine, txRepo, lock, emit, audit };
}

async function attendreErreur(p: Promise<unknown>, type: WalletErreurType) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(WalletErreur);
  expect((err as WalletErreur).type).toBe(type);
}

/* ============================================================
 * 1. VIREMENT ENTRE WALLETS
 * ============================================================ */

describe('WalletEngine — virement entre deux wallets', () => {

  let src: Wallet;
  let tgt: Wallet;

  beforeEach(() => {
    src = makeWallet({ id: 'wallet-src-001', balance: 50_000 });
    tgt = makeWallet({ id: 'wallet-tgt-001', balance: 10_000, userId: 'user-uuid-002' });
    src.totalDebited = 0;
    tgt.totalCredited = 0;
  });

  it("déplace le montant sans créer ni perdre d'argent", async () => {
    const { engine } = monter({ [src.id]: src, [tgt.id]: tgt });
    const totalAvant = argentTotal(src) + argentTotal(tgt);

    const r = await engine.transferer(makeTransferCtx({ amount: 15_000 }));

    expect(src.balance).toBe(35_000);
    expect(tgt.balance).toBe(25_000);
    expect(argentTotal(src) + argentTotal(tgt)).toBe(totalAvant);
    expect(src.totalDebited).toBe(15_000);
    expect(tgt.totalCredited).toBe(15_000);
    expect(r).toMatchObject({ amount: 15_000 });
    expect(r.sourceWalletApres.balance).toBe(35_000);
  });

  it('dérive des clés d’idempotence distinctes pour la sortie et l’entrée', async () => {
    const { engine } = monter({ [src.id]: src, [tgt.id]: tgt });
    const r = await engine.transferer(makeTransferCtx({ amount: 1_000, idempotencyKey: 'vir-42' }));
    expect(r.outTransactionId).not.toBe(r.inTransactionId);
  });

  it('rejette un solde source insuffisant sans toucher aux deux wallets', async () => {
    const { engine } = monter({ [src.id]: src, [tgt.id]: tgt });
    await attendreErreur(engine.transferer(makeTransferCtx({ amount: 60_000 })), WalletErreurType.SOLDE_INSUFFISANT);
    expect(src.balance).toBe(50_000);
    expect(tgt.balance).toBe(10_000);
  });

  it('rejette un virement vers soi-même avant tout verrouillage', async () => {
    const { engine, lock } = monter({ [src.id]: src });
    await expect(engine.transferer(makeTransferCtx({ targetWalletId: src.id }))).rejects.toBeInstanceOf(WalletErreur);
    expect(lock.runWithLockedDualWallets).not.toHaveBeenCalled();
  });

  it('rejette des devises différentes', async () => {
    tgt.currency = 'XOF' as WalletCurrency;
    const { engine } = monter({ [src.id]: src, [tgt.id]: tgt });
    await expect(engine.transferer(makeTransferCtx({ amount: 1_000 }))).rejects.toBeInstanceOf(WalletErreur);
    expect(src.balance).toBe(50_000);
  });

  it.each([
    ['source gelée', 'src'],
    ['cible gelée',  'tgt'],
  ])('rejette si la %s', async (_label, qui) => {
    (qui === 'src' ? src : tgt).status = WalletStatus.FROZEN;
    const { engine } = monter({ [src.id]: src, [tgt.id]: tgt });
    await attendreErreur(engine.transferer(makeTransferCtx({ amount: 1_000 })), WalletErreurType.WALLET_GELE);
    expect(src.balance).toBe(50_000);
    expect(tgt.balance).toBe(10_000);
  });
});

/* ============================================================
 * 2. GARDE-FOUS DU SÉQUESTRE
 * ============================================================ */

describe('WalletEngine — garde-fous du séquestre', () => {

  it("refuse une libération supérieure au montant en attente (pas de création d'argent)", async () => {
    const w = makeWallet({ balance: 0, pendingBalance: 5_000, walletType: WalletType.ENTREPRISE });
    const { engine } = monter({ [w.id]: w });

    await attendreErreur(
      engine.executer(makeWalletCtx({
        operationType: WalletOperationType.ESCROW_RELEASE, amount: 8_000, balanceType: BalanceType.PENDING,
      })),
      WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
    );
    expect(w.pendingBalance).toBe(5_000);
    expect(w.balance).toBe(0);
  });

  it("crédit séquestre puis libération : l'argent passe d'attente à disponible", async () => {
    const w = makeWallet({ balance: 0, pendingBalance: 0, walletType: WalletType.ENTREPRISE });
    const { engine } = monter({ [w.id]: w });

    await engine.executer(makeWalletCtx({
      operationType: WalletOperationType.ESCROW_CREDIT, amount: 9_000, balanceType: BalanceType.PENDING,
    }));
    expect(w.pendingBalance).toBe(9_000);

    await engine.executer(makeWalletCtx({
      operationType: WalletOperationType.ESCROW_RELEASE, amount: 9_000, balanceType: BalanceType.PENDING,
    }));
    expect(w.pendingBalance).toBe(0);
    expect(w.balance).toBe(9_000);
  });

  it("annulation de séquestre : ne débite que l'attente, jamais le disponible", async () => {
    const w = makeWallet({ balance: 20_000, pendingBalance: 4_000, walletType: WalletType.ENTREPRISE });
    const { engine } = monter({ [w.id]: w });

    await engine.executer(makeWalletCtx({
      operationType: WalletOperationType.ESCROW_CANCEL, amount: 4_000, balanceType: BalanceType.PENDING,
    }));
    expect(w.pendingBalance).toBe(0);
    expect(w.balance).toBe(20_000);
  });
});

/* ============================================================
 * 3. ÉVÉNEMENTS
 * ============================================================ */

describe('WalletEngine — événements émis', () => {

  const cas: Array<[WalletOperationType, Partial<Wallet>, BalanceType, string, Record<string, unknown> | null]> = [
    [WalletOperationType.ESCROW_CREDIT,      {},                            BalanceType.PENDING,     WALLET_EVENTS.ESCROW_CREDITED, null],
    [WalletOperationType.ESCROW_RELEASE,     { pendingBalance: 5_000 },     BalanceType.PENDING,     WALLET_EVENTS.ESCROW_RELEASED, null],
    [WalletOperationType.ESCROW_CANCEL,      { pendingBalance: 5_000 },     BalanceType.PENDING,     WALLET_EVENTS.ESCROW_CANCELLED, null],
    [WalletOperationType.WITHDRAWAL_INIT,    { reservedBalance: 5_000 },    BalanceType.RESERVED,    WALLET_EVENTS.WITHDRAWAL_INITIATED, { provider: 'orange', method: 'mobile_money' }],
    [WalletOperationType.WITHDRAWAL_CONFIRM, { withdrawingBalance: 5_000 }, BalanceType.WITHDRAWING, WALLET_EVENTS.WITHDRAWAL_CONFIRMED, { providerReference: 'OM-1' }],
    [WalletOperationType.WITHDRAWAL_FAIL,    { withdrawingBalance: 5_000 }, BalanceType.WITHDRAWING, WALLET_EVENTS.WITHDRAWAL_FAILED, { failureReason: 'timeout' }],
    [WalletOperationType.BLOCK,              {},                            BalanceType.BALANCE,     WALLET_EVENTS.WALLET_FROZEN, null],
    [WalletOperationType.UNBLOCK,            { blockedBalance: 5_000 },     BalanceType.BLOCKED,     WALLET_EVENTS.WALLET_UNFROZEN, null],
  ];

  it.each(cas)('%s émet son événement dédié', async (operationType, soldes, balanceType, evenement, metadata) => {
    const w = makeWallet({ balance: 50_000, walletType: WalletType.ENTREPRISE, ...soldes });
    const { engine, emit } = monter({ [w.id]: w });

    await engine.executer(makeWalletCtx({
      operationType, amount: 5_000, balanceType, metadata: metadata ?? null,
      note: 'Justification administrative', referenceId: 'cmd-001',
    }));

    expect(emit).toHaveBeenCalledWith(evenement, expect.anything());
  });

  it('un échec émet OPERATION_FAILED et journalise l’audit d’échec', async () => {
    const w = makeWallet({ balance: 100 });
    const { engine, emit, audit } = monter({ [w.id]: w });

    await expect(engine.executer(makeWalletCtx({
      operationType: WalletOperationType.TRANSFER_OUT, amount: 5_000,
    }))).rejects.toBeInstanceOf(WalletErreur);

    expect(emit).toHaveBeenCalledWith(WALLET_EVENTS.OPERATION_FAILED, expect.anything());
    expect(audit.logOperationEchouee).toHaveBeenCalled();
    expect(audit.logOperationReussie).not.toHaveBeenCalled();
  });

  it("une erreur lors de l'émission d'un événement ne fait pas échouer l'opération", async () => {
    const w = makeWallet({ balance: 1_000 });
    const { engine, emit } = monter({ [w.id]: w });
    emit.mockImplementation(() => { throw new Error('bus en panne'); });

    const r = await engine.executer(makeWalletCtx({ amount: 500 }));

    expect(r.amount).toBe(500);
    expect(w.balance).toBe(1_500);
  });
});
