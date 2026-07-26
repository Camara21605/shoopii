/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-ledger.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Grand Livre comptable immuable du Wallet Engine.
 *
 * PRINCIPE
 * ------------------------------------------------------------
 * Chaque opération financière génère une ou deux entrées
 * dans le Grand Livre (WalletLedgerEntry) :
 *
 *   - DÉBIT  : sortie d'un solde (balance -= X)
 *   - CRÉDIT : entrée dans un solde (pendingBalance += X)
 *
 * Pour les transferts entre deux wallets, deux entrées
 * sont créées (TRANSFER_OUT + TRANSFER_IN) — une par wallet.
 *
 * IMMUTABILITÉ
 * ------------------------------------------------------------
 * Ce service ne met jamais à jour ni ne supprime d'entrées.
 * Une erreur se corrige via enregistrerCorrection() qui :
 *   1. Crée une entrée opposée (CORRECTION)
 *   2. Marque l'entrée originale isReversed = true
 *
 * PERFORMANCE
 * ------------------------------------------------------------
 * Toutes les insertions utilisent le QueryRunner actif pour
 * rester dans la même transaction SQL que la WalletTransaction.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  WalletLedgerEntry,
  LedgerEntryDirection,
  LedgerCurrency,
} from '../../../database/entities/wallet-ledger-entry.entity';
import {
  WalletOperationType,
  BalanceType,
  WalletErreur,
  WalletErreurType,
} from '../types/wallet-engine.types';
import { WalletCurrency } from '../../../database/entities/wallet.entity';

/* ============================================================
 * INTERFACE : PARAMÈTRES D'ENREGISTREMENT
 * ============================================================ */

export interface EnregistrerEntreeParams {
  walletId: string;
  transactionId: string | null;
  operationType: WalletOperationType;
  direction: LedgerEntryDirection;
  amount: number;
  currency: WalletCurrency;
  balanceType: BalanceType;
  balanceBefore: number;
  balanceAfter: number;
  description?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  performedByUserId?: string | null;
  performedByRole?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class WalletLedgerService {

  private readonly logger = new Logger(WalletLedgerService.name);

  constructor(
    @InjectRepository(WalletLedgerEntry)
    private readonly ledgerRepo: Repository<WalletLedgerEntry>,
  ) {}

  /* ==========================================================
   * ENREGISTRER UNE ENTRÉE
   * ========================================================== */

  /**
   * Crée une entrée immuable dans le Grand Livre.
   * Doit être appelé dans un QueryRunner actif (même transaction que la WalletTransaction).
   */
  async enregistrerEntree(
    params: EnregistrerEntreeParams,
    qr: QueryRunner,
  ): Promise<WalletLedgerEntry> {
    const reference = this.genererReference();

    const entree = qr.manager.create(WalletLedgerEntry, {
      reference,
      walletId:         params.walletId,
      transactionId:    params.transactionId,
      operationType:    params.operationType,
      direction:        params.direction,
      debit:  params.direction === LedgerEntryDirection.DEBIT  ? params.amount : 0,
      credit: params.direction === LedgerEntryDirection.CREDIT ? params.amount : 0,
      currency:         params.currency as unknown as LedgerCurrency,
      balanceType:      params.balanceType,
      balanceBefore:    params.balanceBefore,
      balanceAfter:     params.balanceAfter,
      description:      params.description ?? null,
      referenceType:    params.referenceType ?? null,
      referenceId:      params.referenceId   ?? null,
      performedByUserId:params.performedByUserId ?? null,
      performedByRole:  params.performedByRole   ?? null,
      ipAddress:        params.ipAddress         ?? null,
      metadata:         params.metadata          ?? null,
      isReversed:       false,
      reversedByEntryId:null,
    });

    const saved = await qr.manager.save(WalletLedgerEntry, entree);

    this.logger.debug(
      `Ledger: ${params.direction} ${params.amount} — wallet=${params.walletId} op=${params.operationType} ref=${reference}`,
    );

    return saved;
  }

  /* ==========================================================
   * ENREGISTRER UN DÉBIT
   * ========================================================== */

  async enregistrerDebit(
    params: Omit<EnregistrerEntreeParams, 'direction'>,
    qr: QueryRunner,
  ): Promise<WalletLedgerEntry> {
    return this.enregistrerEntree(
      { ...params, direction: LedgerEntryDirection.DEBIT },
      qr,
    );
  }

  /* ==========================================================
   * ENREGISTRER UN CRÉDIT
   * ========================================================== */

  async enregistrerCredit(
    params: Omit<EnregistrerEntreeParams, 'direction'>,
    qr: QueryRunner,
  ): Promise<WalletLedgerEntry> {
    return this.enregistrerEntree(
      { ...params, direction: LedgerEntryDirection.CREDIT },
      qr,
    );
  }

  /* ==========================================================
   * ENREGISTRER DOUBLE ENTRÉE (TRANSFERT)
   * ========================================================== */

  /**
   * Crée deux entrées pour un virement interne :
   *   - DEBIT  sur le wallet source
   *   - CREDIT sur le wallet cible
   *
   * Garantit l'équilibre Σdebits = Σcredits.
   */
  async enregistrerTransfert(
    source: Omit<EnregistrerEntreeParams, 'direction'>,
    cible:  Omit<EnregistrerEntreeParams, 'direction'>,
    qr: QueryRunner,
  ): Promise<{ debitEntry: WalletLedgerEntry; creditEntry: WalletLedgerEntry }> {
    const debitEntry  = await this.enregistrerDebit(source, qr);
    const creditEntry = await this.enregistrerCredit(cible, qr);
    return { debitEntry, creditEntry };
  }

  /* ==========================================================
   * CORRECTION (REVERSEMENT)
   * ========================================================== */

  /**
   * Corrige une erreur comptable par entrée opposée.
   *
   * 1. Crée une entrée CORRECTION dans la direction opposée
   * 2. Marque l'entrée originale isReversed = true
   *
   * Ne jamais modifier l'entrée originale directement.
   */
  async enregistrerCorrection(
    originalEntryId: string,
    params: Omit<EnregistrerEntreeParams, 'direction'> & { motif: string },
    qr: QueryRunner,
  ): Promise<WalletLedgerEntry> {
    const original = await qr.manager.findOne(WalletLedgerEntry, {
      where: { id: originalEntryId },
    });

    if (!original) {
      throw new WalletErreur(
        WalletErreurType.ERREUR_INTERNE,
        `Entrée ledger introuvable pour correction : ${originalEntryId}`,
        { originalEntryId },
      );
    }

    if (original.isReversed) {
      throw new WalletErreur(
        WalletErreurType.OPERATION_NON_AUTORISEE,
        `L'entrée ledger ${originalEntryId} a déjà été corrigée.`,
        { originalEntryId },
      );
    }

    const oppositeDirection =
      original.direction === LedgerEntryDirection.DEBIT
        ? LedgerEntryDirection.CREDIT
        : LedgerEntryDirection.DEBIT;

    const correctionEntry = await this.enregistrerEntree(
      {
        ...params,
        direction: oppositeDirection,
        operationType: WalletOperationType.CORRECTION,
        metadata: {
          ...params.metadata,
          originalEntryId,
          motif: params.motif,
        },
      },
      qr,
    );

    await qr.manager.update(WalletLedgerEntry, originalEntryId, {
      isReversed: true,
      reversedByEntryId: correctionEntry.id,
    });

    this.logger.warn(
      `Correction ledger : entrée ${originalEntryId} annulée par ${correctionEntry.id}. Motif : ${params.motif}`,
    );

    return correctionEntry;
  }

  /* ==========================================================
   * LECTURE (AUDIT)
   * ========================================================== */

  /**
   * Récupère toutes les entrées d'un wallet (non paginé — usage audit uniquement).
   */
  async getEntreesParWallet(walletId: string): Promise<WalletLedgerEntry[]> {
    return this.ledgerRepo.find({
      where: { walletId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Récupère les entrées liées à une transaction.
   */
  async getEntreesParTransaction(transactionId: string): Promise<WalletLedgerEntry[]> {
    return this.ledgerRepo.find({
      where: { transactionId },
      order: { createdAt: 'ASC' },
    });
  }

  /* ==========================================================
   * ÉQUILIBRE COMPTABLE (VÉRIFICATION)
   * ========================================================== */

  /**
   * Vérifie l'équilibre global Σdebits = Σcredits.
   * Usage : audit, rapports de réconciliation.
   * LECTURE SEULE — jamais appelé dans une opération normale.
   */
  async verifierEquilibre(): Promise<{ debits: number; credits: number; equilibre: boolean }> {
    const result = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('SUM(l.debit)',  'totalDebits')
      .addSelect('SUM(l.credit)', 'totalCredits')
      .where('l.isReversed = false')
      .getRawOne();

    const debits  = parseFloat(result?.totalDebits  ?? '0');
    const credits = parseFloat(result?.totalCredits ?? '0');

    return {
      debits,
      credits,
      equilibre: Math.abs(debits - credits) < 0.01,
    };
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private genererReference(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = uuidv4().split('-')[0].toUpperCase();
    return `LED-${dateStr}-${shortId}`;
  }
}
