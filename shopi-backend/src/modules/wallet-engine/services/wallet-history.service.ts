/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-history.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Service READ-ONLY pour l'historique paginé du Wallet Engine.
 *
 * Aucune écriture — uniquement des lectures optimisées.
 *
 * Méthodes :
 *   - getTransactions()   — historique paginé (avec filtres)
 *   - getTransaction()    — une transaction par ID
 *   - getLedgerEntries()  — entrées ledger paginées par wallet
 *   - getEtat()           — snapshot des soldes actuels
 *   - agregats()          — totaux crédits/débits par période
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';

import { Wallet } from '../../../database/entities/wallet.entity';
import { WalletTransaction } from '../../../database/entities/wallet-transaction.entity';
import { WalletLedgerEntry } from '../../../database/entities/wallet-ledger-entry.entity';
import {
  WalletTransactionFilter,
  WalletTransactionPage,
  WalletEtat,
  WalletErreur,
  WalletErreurType,
} from '../types/wallet-engine.types';

/* ============================================================
 * INTERFACES LOCALES
 * ============================================================ */

export interface WalletAgregatsPeriode {
  walletId: string;
  dateDebut: Date;
  dateFin: Date;
  totalCredits: number;
  totalDebits: number;
  nbTransactions: number;
  soldeNet: number;
}

@Injectable()
export class WalletHistoryService {

  private readonly logger = new Logger(WalletHistoryService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    @InjectRepository(WalletLedgerEntry)
    private readonly ledgerRepo: Repository<WalletLedgerEntry>,
  ) {}

  /* ==========================================================
   * ÉTAT DU WALLET
   * ========================================================== */

  /**
   * Retourne le snapshot des soldes actuels d'un wallet.
   */
  async getEtat(walletId: string): Promise<WalletEtat> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });

    if (!wallet) {
      throw new WalletErreur(
        WalletErreurType.WALLET_INTROUVABLE,
        `Wallet introuvable : ${walletId}`,
        { walletId },
      );
    }

    return {
      id:                wallet.id,
      walletType:        wallet.walletType,
      userId:            wallet.userId,
      currency:          wallet.currency,
      status:            wallet.status,
      balance:           wallet.balance,
      pendingBalance:    wallet.pendingBalance,
      blockedBalance:    wallet.blockedBalance,
      reservedBalance:   wallet.reservedBalance,
      withdrawingBalance:wallet.withdrawingBalance,
      totalBalance:
        wallet.balance +
        wallet.pendingBalance +
        wallet.blockedBalance +
        wallet.reservedBalance +
        wallet.withdrawingBalance,
      version:           wallet.version,
      lastTransactionAt: wallet.lastTransactionAt,
      updatedAt:         wallet.updatedAt,
    };
  }

  /* ==========================================================
   * TRANSACTIONS PAGINÉES
   * ========================================================== */

  /**
   * Historique des transactions d'un wallet avec filtres et pagination.
   */
  async getTransactions(
    filter: WalletTransactionFilter,
  ): Promise<WalletTransactionPage<WalletTransaction>> {
    const page  = filter.page  ?? 1;
    const limit = filter.limite ?? 20;
    const skip  = (page - 1) * limit;

    const where: FindOptionsWhere<WalletTransaction> = {
      walletId: filter.walletId,
    };

    if (filter.operationType) where.operationType = filter.operationType;
    if (filter.balanceType)   where.balanceType   = filter.balanceType;
    if (filter.referenceType) where.referenceType = filter.referenceType;
    if (filter.referenceId)   where.referenceId   = filter.referenceId;

    if (filter.dateDebut && filter.dateFin) {
      where.createdAt = Between(filter.dateDebut, filter.dateFin) as any;
    }

    const [data, total] = await this.txRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      data,
      total,
      page,
      limite: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ==========================================================
   * TRANSACTION UNIQUE
   * ========================================================== */

  async getTransaction(transactionId: string): Promise<WalletTransaction | null> {
    return this.txRepo.findOne({ where: { id: transactionId } });
  }

  /* ==========================================================
   * ENTRÉES LEDGER PAGINÉES
   * ========================================================== */

  async getLedgerEntries(
    walletId: string,
    options: { page?: number; limite?: number; dateDebut?: Date; dateFin?: Date },
  ): Promise<WalletTransactionPage<WalletLedgerEntry>> {
    const page  = options.page  ?? 1;
    const limit = options.limite ?? 20;
    const skip  = (page - 1) * limit;

    const where: FindOptionsWhere<WalletLedgerEntry> = { walletId };

    if (options.dateDebut && options.dateFin) {
      where.createdAt = Between(options.dateDebut, options.dateFin) as any;
    }

    const [data, total] = await this.ledgerRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      data,
      total,
      page,
      limite: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ==========================================================
   * AGRÉGATS PAR PÉRIODE
   * ========================================================== */

  /**
   * Totaux de crédits et débits sur une période.
   */
  async agregats(
    walletId: string,
    dateDebut: Date,
    dateFin: Date,
  ): Promise<WalletAgregatsPeriode> {
    const result = await this.txRepo
      .createQueryBuilder('t')
      .select('SUM(CASE WHEN t.type = :credit THEN t.amount ELSE 0 END)', 'totalCredits')
      .addSelect('SUM(CASE WHEN t.type = :debit THEN t.amount ELSE 0 END)',  'totalDebits')
      .addSelect('COUNT(t.id)', 'nbTransactions')
      .where('t.walletId = :walletId', { walletId })
      .andWhere('t.createdAt BETWEEN :dateDebut AND :dateFin', { dateDebut, dateFin })
      .setParameter('credit', 'credit')
      .setParameter('debit',  'debit')
      .getRawOne();

    const totalCredits   = parseFloat(result?.totalCredits  ?? '0');
    const totalDebits    = parseFloat(result?.totalDebits   ?? '0');
    const nbTransactions = parseInt(result?.nbTransactions  ?? '0', 10);

    return {
      walletId,
      dateDebut,
      dateFin,
      totalCredits,
      totalDebits,
      nbTransactions,
      soldeNet: totalCredits - totalDebits,
    };
  }
}
