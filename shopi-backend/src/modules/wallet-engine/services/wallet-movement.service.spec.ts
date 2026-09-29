/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-movement.service.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires de WalletMovementService — le SEUL service qui
 * modifie les soldes d'un Wallet.
 *
 * INVARIANT CENTRAL VÉRIFIÉ
 * ─────────────────────────────────────────────────────────────
 *   "Argent total" = balance + pending + blocked + reserved + withdrawing
 *
 *   - Mouvements INTERNES (bloquer, débloquer, réserver, libérer,
 *     libérer escrow, initier retrait, échec retrait) : l'argent total
 *     NE CHANGE PAS, il passe seulement d'un compartiment à l'autre.
 *   - crediter : argent total + montant
 *   - debiter / confirmerRetrait : argent total − montant
 *
 * GROUPES
 * ─────────────────────────────────────────────────────────────
 *  1. crediter / debiter
 *  2. bloquer / débloquer
 *  3. réserver / libérer
 *  4. libérer escrow (pending → balance)
 *  5. cycle de retrait (initier → confirmer / échouer)
 *  6. traçabilité (transaction PENDING → COMPLETED, ledger, résultat)
 * ============================================================ */

import { WalletMovementService } from './wallet-movement.service';
import { WalletValidatorService } from './wallet-validator.service';
import { Wallet, WalletStatus } from '../../../database/entities/wallet.entity';
import {
  WalletTransaction,
  TransactionStatus,
  TransactionType,
} from '../../../database/entities/wallet-transaction.entity';
import {
  BalanceType,
  WalletErreur,
  WalletErreurType,
  WalletOperationType,
} from '../types/wallet-engine.types';
import { makeWallet, makeWalletCtx } from '../../../test/helpers/wallet.test-helper';

/* ============================================================
 * HELPERS
 * ============================================================ */

/** Somme de tous les compartiments d'un wallet */
const argentTotal = (w: Wallet): number =>
  w.balance + w.pendingBalance + w.blockedBalance + w.reservedBalance + w.withdrawingBalance;

/** QueryRunner minimal : enregistre ce qui est créé / sauvegardé / mis à jour */
function makeQr() {
  const manager = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ ...data })),
    save:   jest.fn(async (entity: unknown, data: Record<string, unknown>) =>
      entity === WalletTransaction ? { ...data, id: 'tx-001' } : data),
    update: jest.fn(async () => undefined),
  };
  return { manager } as any;
}

/** Récupère l'objet WalletTransaction passé à manager.create */
const txCree = (qr: any) =>
  qr.manager.create.mock.calls.find(([e]: [unknown]) => e === WalletTransaction)?.[1];

async function attendreErreur(p: Promise<unknown>, type: WalletErreurType) {
  await expect(p).rejects.toBeInstanceOf(WalletErreur);
  await p.catch((e: WalletErreur) => expect(e.type).toBe(type));
}

/* ============================================================
 * SUITE
 * ============================================================ */

describe('WalletMovementService', () => {

  let svc: WalletMovementService;
  let ledger: { enregistrerCredit: jest.Mock; enregistrerDebit: jest.Mock };

  beforeEach(() => {
    ledger = {
      enregistrerCredit: jest.fn(async () => ({ id: 'ledger-credit-001' })),
      enregistrerDebit:  jest.fn(async () => ({ id: 'ledger-debit-001' })),
    };
    svc = new WalletMovementService(
      {} as any,
      {} as any,
      ledger as any,
      new WalletValidatorService(),
    );
  });

  /* ==========================================================
   * 1. CRÉDITER / DÉBITER
   * ========================================================== */

  describe('crediter', () => {

    it('ajoute au solde principal par défaut et au total crédité', async () => {
      const w = makeWallet({ balance: 10_000 });
      w.totalCredited = 0;
      const avant = argentTotal(w);

      const r = await svc.crediter(w, makeWalletCtx({ amount: 2_500 }), makeQr());

      expect(w.balance).toBe(12_500);
      expect(w.totalCredited).toBe(2_500);
      expect(argentTotal(w)).toBe(avant + 2_500);
      expect(r.walletApres.balance).toBe(12_500);
    });

    it('crédite le compartiment demandé (ex : pendingBalance pour un séquestre)', async () => {
      const w = makeWallet({ balance: 10_000, pendingBalance: 0 });
      w.totalCredited = 0;

      await svc.crediter(w, makeWalletCtx({
        amount: 4_000, operationType: WalletOperationType.ESCROW_CREDIT, balanceType: BalanceType.PENDING,
      }), makeQr());

      expect(w.pendingBalance).toBe(4_000);
      expect(w.balance).toBe(10_000);
    });

    it.each([0, -500, NaN, Infinity])('rejette un montant invalide (%p)', async (amount) => {
      const w = makeWallet();
      await attendreErreur(svc.crediter(w, makeWalletCtx({ amount }), makeQr()), WalletErreurType.MONTANT_INVALIDE);
      expect(w.balance).toBe(100_000);
    });

    it.each([
      [WalletStatus.FROZEN, WalletErreurType.WALLET_GELE],
      [WalletStatus.CLOSED, WalletErreurType.WALLET_FERME],
    ])('rejette un wallet %s', async (status, erreur) => {
      const w = makeWallet({ status });
      await attendreErreur(svc.crediter(w, makeWalletCtx(), makeQr()), erreur);
      expect(w.balance).toBe(100_000);
    });
  });

  describe('debiter', () => {

    it('retire du solde principal et du total, ajoute au total débité', async () => {
      const w = makeWallet({ balance: 50_000 });
      w.totalDebited = 0;
      const avant = argentTotal(w);

      await svc.debiter(w, makeWalletCtx({ amount: 20_000, operationType: WalletOperationType.TRANSFER_OUT }), makeQr());

      expect(w.balance).toBe(30_000);
      expect(w.totalDebited).toBe(20_000);
      expect(argentTotal(w)).toBe(avant - 20_000);
    });

    it('rejette un solde insuffisant sans rien modifier ni écrire', async () => {
      const w = makeWallet({ balance: 1_000 });
      const qr = makeQr();

      await attendreErreur(
        svc.debiter(w, makeWalletCtx({ amount: 1_001, operationType: WalletOperationType.TRANSFER_OUT }), qr),
        WalletErreurType.SOLDE_INSUFFISANT,
      );
      expect(w.balance).toBe(1_000);
      expect(qr.manager.save).not.toHaveBeenCalled();
    });

    it('débiter exactement tout le solde est autorisé (solde final 0)', async () => {
      const w = makeWallet({ balance: 7_000 });
      await svc.debiter(w, makeWalletCtx({ amount: 7_000, operationType: WalletOperationType.TRANSFER_OUT }), makeQr());
      expect(w.balance).toBe(0);
    });

    it('débite le compartiment demandé (ESCROW_CANCEL → pendingBalance seul)', async () => {
      const w = makeWallet({ balance: 10_000, pendingBalance: 6_000 });
      await svc.debiter(w, makeWalletCtx({
        amount: 6_000, operationType: WalletOperationType.ESCROW_CANCEL, balanceType: BalanceType.PENDING,
      }), makeQr());

      expect(w.pendingBalance).toBe(0);
      expect(w.balance).toBe(10_000);
    });

    it('applique la limite de retrait journalière pour WITHDRAWAL_INIT', async () => {
      const w = makeWallet({ balance: 100_000, dailyWithdrawLimit: 50_000, todayWithdrawAmount: 40_000 });
      await attendreErreur(
        svc.debiter(w, makeWalletCtx({ amount: 20_000, operationType: WalletOperationType.WITHDRAWAL_INIT }), makeQr()),
        WalletErreurType.LIMITE_RETRAIT_ATTEINTE,
      );
      expect(w.balance).toBe(100_000);
    });
  });

  /* ==========================================================
   * 2. BLOQUER / DÉBLOQUER (gel administratif)
   * ========================================================== */

  describe('bloquer / débloquer', () => {

    const ctxBlocage = (operationType: WalletOperationType, amount = 5_000) =>
      makeWalletCtx({ operationType, amount, note: 'Suspicion de fraude — contrôle en cours' });

    it('bloquer : balance → blockedBalance, argent total inchangé', async () => {
      const w = makeWallet({ balance: 20_000, blockedBalance: 0 });
      const avant = argentTotal(w);

      await svc.bloquer(w, ctxBlocage(WalletOperationType.BLOCK), makeQr());

      expect(w.balance).toBe(15_000);
      expect(w.blockedBalance).toBe(5_000);
      expect(argentTotal(w)).toBe(avant);
    });

    it('bloquer : exige une note de justification', async () => {
      const w = makeWallet();
      await attendreErreur(
        svc.bloquer(w, makeWalletCtx({ operationType: WalletOperationType.BLOCK, note: null }), makeQr()),
        WalletErreurType.PARAMETRE_MANQUANT,
      );
    });

    it('bloquer : impossible au-delà du solde disponible', async () => {
      const w = makeWallet({ balance: 1_000 });
      await attendreErreur(svc.bloquer(w, ctxBlocage(WalletOperationType.BLOCK, 5_000), makeQr()), WalletErreurType.SOLDE_INSUFFISANT);
      expect(w.blockedBalance).toBe(0);
    });

    it('débloquer : blockedBalance → balance, argent total inchangé', async () => {
      const w = makeWallet({ balance: 15_000, blockedBalance: 5_000 });
      const avant = argentTotal(w);

      const r = await svc.debloquer(w, ctxBlocage(WalletOperationType.UNBLOCK), makeQr());

      expect(w.blockedBalance).toBe(0);
      expect(w.balance).toBe(20_000);
      expect(argentTotal(w)).toBe(avant);
      expect(r.balanceType).toBe(BalanceType.BLOCKED);
    });

    it('débloquer : impossible au-delà du montant bloqué', async () => {
      const w = makeWallet({ balance: 15_000, blockedBalance: 2_000 });
      await attendreErreur(
        svc.debloquer(w, ctxBlocage(WalletOperationType.UNBLOCK, 5_000), makeQr()),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
      expect(w.balance).toBe(15_000);
    });
  });

  /* ==========================================================
   * 3. RÉSERVER / LIBÉRER
   * ========================================================== */

  describe('réserver / libérer', () => {

    it('réserver : balance → reservedBalance, argent total inchangé', async () => {
      const w = makeWallet({ balance: 30_000, reservedBalance: 0 });
      const avant = argentTotal(w);

      await svc.reserver(w, makeWalletCtx({ operationType: WalletOperationType.RESERVE, amount: 10_000 }), makeQr());

      expect(w.balance).toBe(20_000);
      expect(w.reservedBalance).toBe(10_000);
      expect(argentTotal(w)).toBe(avant);
    });

    it('réserver : impossible au-delà du solde disponible', async () => {
      const w = makeWallet({ balance: 5_000 });
      await attendreErreur(
        svc.reserver(w, makeWalletCtx({ operationType: WalletOperationType.RESERVE, amount: 10_000 }), makeQr()),
        WalletErreurType.SOLDE_INSUFFISANT,
      );
    });

    it('libérer : reservedBalance → balance, argent total inchangé', async () => {
      const w = makeWallet({ balance: 20_000, reservedBalance: 10_000 });
      const avant = argentTotal(w);

      await svc.liberer(w, makeWalletCtx({ operationType: WalletOperationType.RELEASE, amount: 10_000 }), makeQr());

      expect(w.reservedBalance).toBe(0);
      expect(w.balance).toBe(30_000);
      expect(argentTotal(w)).toBe(avant);
    });

    it('libérer : impossible au-delà du montant réservé', async () => {
      const w = makeWallet({ reservedBalance: 1_000 });
      await attendreErreur(
        svc.liberer(w, makeWalletCtx({ operationType: WalletOperationType.RELEASE, amount: 5_000 }), makeQr()),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });
  });

  /* ==========================================================
   * 4. LIBÉRER ESCROW (pending → balance)
   * ========================================================== */

  describe('libérer escrow', () => {

    it("transfère réellement pending → balance (l'argent devient retirable)", async () => {
      const w = makeWallet({ balance: 1_000, pendingBalance: 9_000 });
      const avant = argentTotal(w);

      const r = await svc.libererEscrow(w, makeWalletCtx({
        operationType: WalletOperationType.ESCROW_RELEASE, amount: 9_000, balanceType: BalanceType.PENDING,
      }), makeQr());

      expect(w.pendingBalance).toBe(0);
      expect(w.balance).toBe(10_000);
      expect(argentTotal(w)).toBe(avant);
      expect(r.balanceType).toBe(BalanceType.PENDING);
      expect(ledger.enregistrerCredit).toHaveBeenCalledWith(
        expect.objectContaining({ balanceType: BalanceType.BALANCE, balanceBefore: 1_000, balanceAfter: 10_000 }),
        expect.anything(),
      );
    });
  });

  /* ==========================================================
   * 5. CYCLE DE RETRAIT
   * ========================================================== */

  describe('cycle de retrait', () => {

    it('initier : reserved → withdrawing, compte dans le cumul journalier', async () => {
      const w = makeWallet({ balance: 0, reservedBalance: 50_000, todayWithdrawAmount: 0 });
      const avant = argentTotal(w);

      await svc.initierRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 50_000 }), makeQr());

      expect(w.reservedBalance).toBe(0);
      expect(w.withdrawingBalance).toBe(50_000);
      expect(w.todayWithdrawAmount).toBe(50_000);
      expect(argentTotal(w)).toBe(avant);
    });

    it('initier : impossible sans réservation préalable suffisante', async () => {
      const w = makeWallet({ balance: 100_000, reservedBalance: 0 });
      await attendreErreur(
        svc.initierRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 10_000 }), makeQr()),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });

    it('initier : bloque au-delà de la limite journalière', async () => {
      const w = makeWallet({ reservedBalance: 50_000, dailyWithdrawLimit: 30_000, todayWithdrawAmount: 0 });
      await attendreErreur(
        svc.initierRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 50_000 }), makeQr()),
        WalletErreurType.LIMITE_RETRAIT_ATTEINTE,
      );
      expect(w.reservedBalance).toBe(50_000);
    });

    it("confirmer : l'argent sort du wallet (withdrawing → 0, total débité)", async () => {
      const w = makeWallet({ balance: 0, withdrawingBalance: 50_000 });
      w.totalDebited = 0;
      const avant = argentTotal(w);

      await svc.confirmerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_CONFIRM, amount: 50_000 }), makeQr());

      expect(w.withdrawingBalance).toBe(0);
      expect(w.totalDebited).toBe(50_000);
      expect(argentTotal(w)).toBe(avant - 50_000);
    });

    it('confirmer : impossible au-delà du montant en cours de retrait', async () => {
      const w = makeWallet({ withdrawingBalance: 1_000 });
      await attendreErreur(
        svc.confirmerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_CONFIRM, amount: 5_000 }), makeQr()),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });

    it("échec : l'argent revient sur le solde et le cumul journalier est rendu", async () => {
      const w = makeWallet({ balance: 0, withdrawingBalance: 50_000, todayWithdrawAmount: 50_000 });
      const avant = argentTotal(w);

      await svc.echouerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_FAIL, amount: 50_000 }), makeQr());

      expect(w.withdrawingBalance).toBe(0);
      expect(w.balance).toBe(50_000);
      expect(w.todayWithdrawAmount).toBe(0);
      expect(argentTotal(w)).toBe(avant);
    });

    it('échec : le cumul journalier ne descend jamais sous 0', async () => {
      const w = makeWallet({ withdrawingBalance: 50_000, todayWithdrawAmount: 10_000 });
      await svc.echouerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_FAIL, amount: 50_000 }), makeQr());
      expect(w.todayWithdrawAmount).toBe(0);
    });

    it('échec : impossible au-delà du montant en cours de retrait', async () => {
      const w = makeWallet({ withdrawingBalance: 1_000 });
      await attendreErreur(
        svc.echouerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_FAIL, amount: 5_000 }), makeQr()),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });

    it('cycle complet réserver → initier → échouer : le client retrouve tout son argent', async () => {
      const w = makeWallet({ balance: 80_000 });
      const qr = makeQr();

      await svc.reserver(w, makeWalletCtx({ operationType: WalletOperationType.RESERVE, amount: 30_000 }), qr);
      await svc.initierRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 30_000 }), qr);
      await svc.echouerRetrait(w, makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_FAIL, amount: 30_000 }), qr);

      expect(w.balance).toBe(80_000);
      expect(w.reservedBalance + w.withdrawingBalance).toBe(0);
    });
  });

  /* ==========================================================
   * 6. TRAÇABILITÉ
   * ========================================================== */

  describe('traçabilité', () => {

    it('crée la transaction en PENDING puis la passe en COMPLETED', async () => {
      const qr = makeQr();
      await svc.crediter(makeWallet(), makeWalletCtx({ amount: 1_000, idempotencyKey: 'idem-1' }), qr);

      expect(txCree(qr)).toMatchObject({
        type: TransactionType.CREDIT, status: TransactionStatus.PENDING,
        amount: 1_000, balanceBefore: 100_000, balanceAfter: 101_000, idempotencyKey: 'idem-1',
      });
      expect(qr.manager.update).toHaveBeenCalledWith(WalletTransaction, 'tx-001', { status: TransactionStatus.COMPLETED });
    });

    it('écrit une ligne de grand livre DÉBIT avec les soldes avant/après', async () => {
      await svc.debiter(makeWallet({ balance: 50_000 }),
        makeWalletCtx({ amount: 5_000, operationType: WalletOperationType.TRANSFER_OUT }), makeQr());

      expect(ledger.enregistrerDebit).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: 'tx-001', amount: 5_000, balanceBefore: 50_000, balanceAfter: 45_000 }),
        expect.anything(),
      );
    });

    it("le résultat reflète l'état final et le total de tous les compartiments", async () => {
      const w = makeWallet({ balance: 10_000, pendingBalance: 1_000, blockedBalance: 2_000, reservedBalance: 3_000, withdrawingBalance: 4_000 });

      const r = await svc.crediter(w, makeWalletCtx({ amount: 500, idempotencyKey: 'k-9' }), makeQr());

      expect(r).toMatchObject({
        transactionId: 'tx-001', ledgerEntryId: 'ledger-credit-001',
        amount: 500, idempotencyKey: 'k-9', balanceType: BalanceType.BALANCE,
      });
      expect(r.walletApres.totalBalance).toBe(20_500);
    });

    it('description par défaut sur un blocage sans description', async () => {
      const qr  = makeQr();
      const ctx = makeWalletCtx({ operationType: WalletOperationType.BLOCK, amount: 1_000, note: 'Contrôle conformité' });
      ctx.description = null; // le helper remplace undefined par une valeur par défaut
      await svc.bloquer(makeWallet(), ctx, qr);
      expect(txCree(qr).description).toBe('Blocage administratif');
    });
  });
});
