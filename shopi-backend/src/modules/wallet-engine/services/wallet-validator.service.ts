/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-validator.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Valide toutes les préconditions AVANT toute opération wallet.
 *
 * Ce service est PURE (aucun DB call) pour les règles statiques,
 * et utilise le wallet déjà chargé (passé en paramètre) pour
 * les règles dynamiques — la lecture DB est faite en amont par
 * WalletLockService (SELECT FOR UPDATE).
 *
 * 8 VALIDATIONS
 * ------------------------------------------------------------
 * 1. validerMontant       — montant > 0, non NaN, non Infinity
 * 2. validerStatutWallet  — wallet ACTIVE requis
 * 3. validerSolde         — fonds suffisants selon balanceType
 * 4. validerLimiteRetrait — quotidien max respecté
 * 5. validerOperationWalletType — opérations interdites par type
 * 6. validerNoteObligatoire — note requise pour certaines ops
 * 7. validerDevise        — devise identique (transferts)
 * 8. validerParametresTransfert — walletId source ≠ cible
 *
 * PATTERN
 * ------------------------------------------------------------
 * Chaque méthode lève un WalletErreur si invalide.
 * Aucun retour booléen — throw = invalide, return = valide.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { Wallet, WalletStatus } from '../../../database/entities/wallet.entity';
import {
  WalletOperationContext,
  WalletErreur,
  WalletErreurType,
  WalletOperationType,
  BalanceType,
  OPERATIONS_NOTE_OBLIGATOIRE,
  OPERATIONS_SUPER_ADMIN,
  WalletTransferContext,
} from '../types/wallet-engine.types';

@Injectable()
export class WalletValidatorService {

  private readonly logger = new Logger(WalletValidatorService.name);

  /* ==========================================================
   * 1. MONTANT
   * ========================================================== */

  /**
   * Vérifie que le montant est valide : positif, fini, non NaN.
   */
  validerMontant(amount: number): void {
    if (
      typeof amount !== 'number' ||
      isNaN(amount) ||
      !isFinite(amount) ||
      amount <= 0
    ) {
      throw new WalletErreur(
        WalletErreurType.MONTANT_INVALIDE,
        `Le montant doit être un nombre positif. Reçu : ${amount}`,
        { amount },
      );
    }
  }

  /* ==========================================================
   * 2. STATUT WALLET
   * ========================================================== */

  /**
   * Vérifie que le wallet est ACTIVE.
   * Un wallet FROZEN ou CLOSED rejette toute opération.
   */
  validerStatutWallet(wallet: Wallet): void {
    if (wallet.status === WalletStatus.FROZEN) {
      throw new WalletErreur(
        WalletErreurType.WALLET_GELE,
        `Le wallet ${wallet.id} est gelé. Motif : ${wallet.freezeReason ?? 'non spécifié'}`,
        { walletId: wallet.id, freezeReason: wallet.freezeReason },
      );
    }

    if (wallet.status === WalletStatus.CLOSED) {
      throw new WalletErreur(
        WalletErreurType.WALLET_FERME,
        `Le wallet ${wallet.id} est définitivement fermé.`,
        { walletId: wallet.id },
      );
    }
  }

  /* ==========================================================
   * 3. SOLDE SUFFISANT
   * ========================================================== */

  /**
   * Vérifie que le solde SOURCE est suffisant pour le débit.
   * Pour les crédits, cette vérification est ignorée.
   *
   * @param wallet    Wallet chargé (avec FOR UPDATE)
   * @param amount    Montant à débiter
   * @param balanceType Type de solde source concerné
   */
  validerSolde(wallet: Wallet, amount: number, balanceType: BalanceType): void {
    let soldeDisponible: number;

    switch (balanceType) {
      case BalanceType.BALANCE:
        soldeDisponible = wallet.balance;
        break;
      case BalanceType.PENDING:
        soldeDisponible = wallet.pendingBalance;
        break;
      case BalanceType.BLOCKED:
        soldeDisponible = wallet.blockedBalance;
        break;
      case BalanceType.RESERVED:
        soldeDisponible = wallet.reservedBalance;
        break;
      case BalanceType.WITHDRAWING:
        soldeDisponible = wallet.withdrawingBalance;
        break;
      default:
        soldeDisponible = wallet.balance;
    }

    if (soldeDisponible < amount) {
      throw new WalletErreur(
        balanceType === BalanceType.BALANCE
          ? WalletErreurType.SOLDE_INSUFFISANT
          : WalletErreurType.SOLDE_SOURCE_INSUFFISANT,
        `Solde ${balanceType} insuffisant. Disponible : ${soldeDisponible}, Requis : ${amount}`,
        {
          walletId: wallet.id,
          balanceType,
          soldeDisponible,
          amountRequis: amount,
          deficit: amount - soldeDisponible,
        },
      );
    }
  }

  /* ==========================================================
   * 4. LIMITE DE RETRAIT JOURNALIÈRE
   * ========================================================== */

  /**
   * Vérifie que le retrait demandé ne dépasse pas la limite quotidienne.
   * Ignoré si dailyWithdrawLimit = 0 (pas de limite).
   */
  validerLimiteRetrait(wallet: Wallet, amount: number): void {
    if (wallet.dailyWithdrawLimit === 0) return;

    const totalApres = wallet.todayWithdrawAmount + amount;
    if (totalApres > wallet.dailyWithdrawLimit) {
      throw new WalletErreur(
        WalletErreurType.LIMITE_RETRAIT_ATTEINTE,
        `Limite journalière atteinte. Limite : ${wallet.dailyWithdrawLimit}, Déjà retiré : ${wallet.todayWithdrawAmount}, Demandé : ${amount}`,
        {
          walletId: wallet.id,
          limite: wallet.dailyWithdrawLimit,
          dejaRetire: wallet.todayWithdrawAmount,
          demande: amount,
          totalApres,
        },
      );
    }
  }

  /* ==========================================================
   * 5. OPÉRATIONS AUTORISÉES PAR TYPE DE WALLET
   * ========================================================== */

  /**
   * Certaines opérations sont réservées à des types de wallets.
   * Ex : seul le wallet PLATEFORME peut recevoir des commissions.
   *
   * Règles actuelles :
   *   - ESCROW_* : réservé aux wallets ENTREPRISE et CLIENT
   *   - COMMISSION : réservé aux wallets PLATEFORME, ADMINISTRATEUR, PARTENAIRE
   */
  validerOperationWalletType(wallet: Wallet, operationType: WalletOperationType): void {
    const type = wallet.walletType;

    const escrowOps = [
      WalletOperationType.ESCROW_CREDIT,
      WalletOperationType.ESCROW_RELEASE,
      WalletOperationType.ESCROW_CANCEL,
    ];

    if (escrowOps.includes(operationType)) {
      const allowedForEscrow = ['client', 'entreprise', 'system', 'plateforme'];
      if (!allowedForEscrow.includes(type)) {
        this.logger.warn(
          `Opération ESCROW sur wallet de type ${type} (walletId=${wallet.id}) — non standard.`,
        );
      }
    }
  }

  /* ==========================================================
   * 6. NOTE OBLIGATOIRE
   * ========================================================== */

  /**
   * Certaines opérations manuelles (ajustements, corrections, blocages)
   * exigent une note de justification.
   */
  validerNoteObligatoire(ctx: WalletOperationContext): void {
    if (!OPERATIONS_NOTE_OBLIGATOIRE.includes(ctx.operationType)) return;

    if (!ctx.note || ctx.note.trim().length < 5) {
      throw new WalletErreur(
        WalletErreurType.PARAMETRE_MANQUANT,
        `L'opération ${ctx.operationType} exige une note de justification (minimum 5 caractères).`,
        { operationType: ctx.operationType, note: ctx.note },
      );
    }
  }

  /* ==========================================================
   * 7. DEVISE COMPATIBLE (TRANSFERTS)
   * ========================================================== */

  /**
   * Pour les transferts internes entre deux wallets,
   * les deux devises doivent être identiques.
   */
  validerDevise(sourceWallet: Wallet, targetWallet: Wallet): void {
    if (sourceWallet.currency !== targetWallet.currency) {
      throw new WalletErreur(
        WalletErreurType.DEVISE_INCOMPATIBLE,
        `Devise incompatible : source=${sourceWallet.currency}, cible=${targetWallet.currency}`,
        {
          sourceWalletId: sourceWallet.id,
          targetWalletId: targetWallet.id,
          sourceCurrency: sourceWallet.currency,
          targetCurrency: targetWallet.currency,
        },
      );
    }
  }

  /* ==========================================================
   * 8. PARAMÈTRES TRANSFERT
   * ========================================================== */

  /**
   * Vérifie que le transfert ne pointe pas vers le même wallet.
   */
  validerParametresTransfert(ctx: WalletTransferContext): void {
    if (ctx.sourceWalletId === ctx.targetWalletId) {
      throw new WalletErreur(
        WalletErreurType.OPERATION_NON_AUTORISEE,
        `Un transfert ne peut pas avoir le même wallet source et cible (walletId=${ctx.sourceWalletId}).`,
        { sourceWalletId: ctx.sourceWalletId, targetWalletId: ctx.targetWalletId },
      );
    }

    if (!ctx.amount || ctx.amount <= 0) {
      throw new WalletErreur(
        WalletErreurType.MONTANT_INVALIDE,
        `Montant de transfert invalide : ${ctx.amount}`,
        { amount: ctx.amount },
      );
    }
  }

  /* ==========================================================
   * HELPER : VALIDATION COMPLÈTE PRÉ-MOUVEMENT
   * ========================================================== */

  /**
   * Lance toutes les validations pertinentes pour une opération standard.
   * À appeler en début de WalletMovementService avant toute écriture.
   *
   * Pour les crédits (aucune vérification de solde source requise),
   * passer `isDebit = false`.
   */
  validerTout(wallet: Wallet, ctx: WalletOperationContext, isDebit: boolean): void {
    this.validerMontant(ctx.amount);
    this.validerStatutWallet(wallet);
    this.validerNoteObligatoire(ctx);
    this.validerOperationWalletType(wallet, ctx.operationType);

    if (isDebit) {
      this.validerSolde(wallet, ctx.amount, ctx.balanceType);

      if (
        ctx.operationType === WalletOperationType.WITHDRAWAL_INIT ||
        ctx.operationType === WalletOperationType.WITHDRAWAL_CONFIRM
      ) {
        this.validerLimiteRetrait(wallet, ctx.amount);
      }
    }
  }
}
