/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-validator.service.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires exhaustifs de WalletValidatorService.
 * Service PURE (aucun appel DB) → aucun mock requis.
 *
 * GROUPES (8 — un par validation)
 * ─────────────────────────────────────────────────────────────
 *  1. validerMontant        — positif, NaN, Infinity, 0, négatif
 *  2. validerStatutWallet   — ACTIVE, FROZEN, CLOSED
 *  3. validerSolde          — tous les BalanceType
 *  4. validerLimiteRetrait  — sans limite (0), avec limite
 *  5. validerNoteObligatoire — ops nécessitant note
 *  6. validerDevise         — devise identique / incompatible
 *  7. validerParametresTransfert — même wallet, montant invalide
 *  8. validerTout           — pipeline complet
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { WalletValidatorService } from './wallet-validator.service';
import { makeWallet, makeWalletCtx, makeTransferCtx } from '../../../test/helpers/wallet.test-helper';
import {
  WalletErreur,
  WalletErreurType,
  WalletOperationType,
  BalanceType,
} from '../types/wallet-engine.types';
import { WalletStatus, WalletCurrency } from '../../../database/entities/wallet.entity';

/* ============================================================
 * HELPER
 * ============================================================ */

function expectWalletErreur(fn: () => void, type: WalletErreurType) {
  try {
    fn();
    fail(`Expected WalletErreur(${type}) to be thrown`);
  } catch (err) {
    expect(err).toBeInstanceOf(WalletErreur);
    expect((err as WalletErreur).type).toBe(type);
  }
}

/* ============================================================
 * SUITE
 * ============================================================ */

describe('WalletValidatorService', () => {

  let validator: WalletValidatorService;

  beforeEach(() => {
    validator = new WalletValidatorService();
  });

  /* ==========================================================
   * 1. validerMontant
   * ========================================================== */

  describe('validerMontant', () => {

    it('accepte un montant positif entier', () => {
      expect(() => validator.validerMontant(100)).not.toThrow();
    });

    it('accepte un montant positif décimal', () => {
      expect(() => validator.validerMontant(0.01)).not.toThrow();
    });

    it('rejette montant = 0', () => {
      expectWalletErreur(
        () => validator.validerMontant(0),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette montant négatif', () => {
      expectWalletErreur(
        () => validator.validerMontant(-500),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette NaN', () => {
      expectWalletErreur(
        () => validator.validerMontant(NaN),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette Infinity', () => {
      expectWalletErreur(
        () => validator.validerMontant(Infinity),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette -Infinity', () => {
      expectWalletErreur(
        () => validator.validerMontant(-Infinity),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette une chaîne de caractères', () => {
      expectWalletErreur(
        () => validator.validerMontant('abc' as unknown as number),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });
  });

  /* ==========================================================
   * 2. validerStatutWallet
   * ========================================================== */

  describe('validerStatutWallet', () => {

    it('accepte un wallet ACTIVE', () => {
      const wallet = makeWallet({ status: WalletStatus.ACTIVE });
      expect(() => validator.validerStatutWallet(wallet)).not.toThrow();
    });

    it('rejette un wallet FROZEN', () => {
      const wallet = makeWallet({ status: WalletStatus.FROZEN, freezeReason: 'Fraude suspectée' });
      expectWalletErreur(
        () => validator.validerStatutWallet(wallet),
        WalletErreurType.WALLET_GELE,
      );
    });

    it('inclut le motif de gel dans le message d\'erreur', () => {
      const wallet = makeWallet({ status: WalletStatus.FROZEN, freezeReason: 'Litige en cours' });
      try {
        validator.validerStatutWallet(wallet);
      } catch (err) {
        expect((err as WalletErreur).message).toContain('Litige en cours');
      }
    });

    it('rejette un wallet CLOSED', () => {
      const wallet = makeWallet({ status: WalletStatus.CLOSED });
      expectWalletErreur(
        () => validator.validerStatutWallet(wallet),
        WalletErreurType.WALLET_FERME,
      );
    });
  });

  /* ==========================================================
   * 3. validerSolde
   * ========================================================== */

  describe('validerSolde', () => {

    it('accepte débit = solde exact (BALANCE)', () => {
      const wallet = makeWallet({ balance: 5_000 });
      expect(() => validator.validerSolde(wallet, 5_000, BalanceType.BALANCE)).not.toThrow();
    });

    it('accepte débit < solde (BALANCE)', () => {
      const wallet = makeWallet({ balance: 10_000 });
      expect(() => validator.validerSolde(wallet, 3_000, BalanceType.BALANCE)).not.toThrow();
    });

    it('rejette débit > balance (BALANCE)', () => {
      const wallet = makeWallet({ balance: 1_000 });
      expectWalletErreur(
        () => validator.validerSolde(wallet, 2_000, BalanceType.BALANCE),
        WalletErreurType.SOLDE_INSUFFISANT,
      );
    });

    it('rejette débit > pendingBalance (PENDING)', () => {
      const wallet = makeWallet({ pendingBalance: 500 });
      expectWalletErreur(
        () => validator.validerSolde(wallet, 1_000, BalanceType.PENDING),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });

    it('rejette débit > blockedBalance (BLOCKED)', () => {
      const wallet = makeWallet({ blockedBalance: 0 });
      expectWalletErreur(
        () => validator.validerSolde(wallet, 100, BalanceType.BLOCKED),
        WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
      );
    });

    it('accepte débit = reservedBalance exact (RESERVED)', () => {
      const wallet = makeWallet({ reservedBalance: 2_000 });
      expect(() => validator.validerSolde(wallet, 2_000, BalanceType.RESERVED)).not.toThrow();
    });

    it('accepte débit sur WITHDRAWING si suffisant', () => {
      const wallet = makeWallet({ withdrawingBalance: 8_000 });
      expect(() => validator.validerSolde(wallet, 5_000, BalanceType.WITHDRAWING)).not.toThrow();
    });
  });

  /* ==========================================================
   * 4. validerLimiteRetrait
   * ========================================================== */

  describe('validerLimiteRetrait', () => {

    it('ignore la vérification si dailyWithdrawLimit = 0 (pas de limite)', () => {
      const wallet = makeWallet({ dailyWithdrawLimit: 0, todayWithdrawAmount: 9_999_999 });
      expect(() => validator.validerLimiteRetrait(wallet, 9_999_999)).not.toThrow();
    });

    it('accepte un retrait dans la limite', () => {
      const wallet = makeWallet({ dailyWithdrawLimit: 100_000, todayWithdrawAmount: 50_000 });
      expect(() => validator.validerLimiteRetrait(wallet, 30_000)).not.toThrow();
    });

    it('rejette un retrait qui dépasse la limite', () => {
      const wallet = makeWallet({ dailyWithdrawLimit: 100_000, todayWithdrawAmount: 80_000 });
      expectWalletErreur(
        () => validator.validerLimiteRetrait(wallet, 30_000),
        WalletErreurType.LIMITE_RETRAIT_ATTEINTE,
      );
    });

    it('rejette un retrait exactement à la limite (0 restant)', () => {
      const wallet = makeWallet({ dailyWithdrawLimit: 100_000, todayWithdrawAmount: 100_000 });
      expectWalletErreur(
        () => validator.validerLimiteRetrait(wallet, 1),
        WalletErreurType.LIMITE_RETRAIT_ATTEINTE,
      );
    });
  });

  /* ==========================================================
   * 5. validerNoteObligatoire
   * ========================================================== */

  describe('validerNoteObligatoire', () => {

    const opsAvecNote = [
      WalletOperationType.ADJUSTMENT,
      WalletOperationType.CORRECTION,
      WalletOperationType.BLOCK,
      WalletOperationType.UNBLOCK,
    ];

    opsAvecNote.forEach(op => {
      it(`${op} exige une note (au moins 5 chars)`, () => {
        const ctx = makeWalletCtx({ operationType: op, note: null });
        expectWalletErreur(
          () => validator.validerNoteObligatoire(ctx),
          WalletErreurType.PARAMETRE_MANQUANT,
        );
      });

      it(`${op} accepte une note valide`, () => {
        const ctx = makeWalletCtx({ operationType: op, note: 'Note valide de justification' });
        expect(() => validator.validerNoteObligatoire(ctx)).not.toThrow();
      });

      it(`${op} rejette une note trop courte (< 5 chars)`, () => {
        const ctx = makeWalletCtx({ operationType: op, note: 'abc' });
        expectWalletErreur(
          () => validator.validerNoteObligatoire(ctx),
          WalletErreurType.PARAMETRE_MANQUANT,
        );
      });
    });

    it('DEPOSIT n\'exige pas de note', () => {
      const ctx = makeWalletCtx({ operationType: WalletOperationType.DEPOSIT, note: null });
      expect(() => validator.validerNoteObligatoire(ctx)).not.toThrow();
    });
  });

  /* ==========================================================
   * 6. validerDevise
   * ========================================================== */

  describe('validerDevise', () => {

    it('accepte deux wallets avec la même devise (GNF/GNF)', () => {
      const src = makeWallet({ currency: WalletCurrency.GNF });
      const tgt = makeWallet({ currency: WalletCurrency.GNF });
      expect(() => validator.validerDevise(src, tgt)).not.toThrow();
    });

    it('rejette une devise incompatible', () => {
      const src = makeWallet({ currency: WalletCurrency.GNF });
      const tgt = makeWallet({ currency: 'USD' as WalletCurrency });
      expectWalletErreur(
        () => validator.validerDevise(src, tgt),
        WalletErreurType.DEVISE_INCOMPATIBLE,
      );
    });
  });

  /* ==========================================================
   * 7. validerParametresTransfert
   * ========================================================== */

  describe('validerParametresTransfert', () => {

    it('accepte un transfert valide source ≠ cible', () => {
      const ctx = makeTransferCtx({ sourceWalletId: 'w-1', targetWalletId: 'w-2', amount: 1_000 });
      expect(() => validator.validerParametresTransfert(ctx)).not.toThrow();
    });

    it('rejette source === cible (même wallet)', () => {
      const ctx = makeTransferCtx({ sourceWalletId: 'w-1', targetWalletId: 'w-1', amount: 1_000 });
      expectWalletErreur(
        () => validator.validerParametresTransfert(ctx),
        WalletErreurType.OPERATION_NON_AUTORISEE,
      );
    });

    it('rejette montant = 0 dans le transfert', () => {
      const ctx = makeTransferCtx({ sourceWalletId: 'w-1', targetWalletId: 'w-2', amount: 0 });
      expectWalletErreur(
        () => validator.validerParametresTransfert(ctx),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });

    it('rejette montant négatif dans le transfert', () => {
      const ctx = makeTransferCtx({ sourceWalletId: 'w-1', targetWalletId: 'w-2', amount: -500 });
      expectWalletErreur(
        () => validator.validerParametresTransfert(ctx),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });
  });

  /* ==========================================================
   * 8. validerTout — pipeline complet
   * ========================================================== */

  describe('validerTout (pipeline)', () => {

    it('valide un crédit standard sans erreur', () => {
      const wallet = makeWallet({ status: WalletStatus.ACTIVE, balance: 50_000 });
      const ctx    = makeWalletCtx({ operationType: WalletOperationType.DEPOSIT, amount: 10_000 });
      expect(() => validator.validerTout(wallet, ctx, false)).not.toThrow();
    });

    it('valide un débit standard avec solde suffisant', () => {
      const wallet = makeWallet({ status: WalletStatus.ACTIVE, balance: 50_000 });
      const ctx    = makeWalletCtx({ operationType: WalletOperationType.TRANSFER_OUT, amount: 10_000, balanceType: BalanceType.BALANCE });
      expect(() => validator.validerTout(wallet, ctx, true)).not.toThrow();
    });

    it('bloque si wallet FROZEN sur débit', () => {
      const wallet = makeWallet({ status: WalletStatus.FROZEN });
      const ctx    = makeWalletCtx({ operationType: WalletOperationType.WITHDRAWAL_INIT, amount: 5_000 });
      expectWalletErreur(
        () => validator.validerTout(wallet, ctx, true),
        WalletErreurType.WALLET_GELE,
      );
    });

    it('bloque si solde insuffisant sur débit', () => {
      const wallet = makeWallet({ status: WalletStatus.ACTIVE, balance: 500 });
      const ctx    = makeWalletCtx({ operationType: WalletOperationType.TRANSFER_OUT, amount: 10_000 });
      expectWalletErreur(
        () => validator.validerTout(wallet, ctx, true),
        WalletErreurType.SOLDE_INSUFFISANT,
      );
    });

    it('bloque montant NaN en pipeline', () => {
      const wallet = makeWallet();
      const ctx    = makeWalletCtx({ amount: NaN });
      expectWalletErreur(
        () => validator.validerTout(wallet, ctx, false),
        WalletErreurType.MONTANT_INVALIDE,
      );
    });
  });
});
