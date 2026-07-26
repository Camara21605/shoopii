/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-lock.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Verrouillage pessimiste des wallets via SELECT FOR UPDATE.
 *
 * PROBLÈME RÉSOLU
 * ------------------------------------------------------------
 * Sans verrouillage, deux requêtes concurrentes peuvent lire
 * le même solde, valider "solde suffisant", et créer deux débits
 * alors que les fonds ne couvrent qu'un seul.
 *
 * SOLUTION : deux niveaux de protection
 *   1. SELECT FOR UPDATE (pessimiste) — bloque la ligne en DB
 *      pendant toute la transaction SQL
 *   2. @VersionColumn (optimiste) — seconde couche via TypeORM,
 *      intercepte les writes concurrent résiduels
 *
 * USAGE
 * ------------------------------------------------------------
 * Toujours appeler dans un queryRunner.startTransaction() actif.
 *
 *   const qr = dataSource.createQueryRunner();
 *   await qr.connect();
 *   await qr.startTransaction();
 *   try {
 *     const wallet = await walletLockService.lockWallet(walletId, qr);
 *     // ... opérations
 *     await qr.commitTransaction();
 *   } catch (e) {
 *     await qr.rollbackTransaction();
 *     throw e;
 *   } finally {
 *     await qr.release();
 *   }
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

import { Wallet } from '../../../database/entities/wallet.entity';
import { WalletErreur, WalletErreurType } from '../types/wallet-engine.types';

@Injectable()
export class WalletLockService {

  private readonly logger = new Logger(WalletLockService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /* ==========================================================
   * LOCK SIMPLE (un wallet)
   * ========================================================== */

  /**
   * Charge un wallet avec SELECT FOR UPDATE.
   * DOIT être appelé dans une transaction SQL active.
   *
   * @throws WalletErreur(WALLET_INTROUVABLE) si absent
   */
  async lockWallet(walletId: string, qr: QueryRunner): Promise<Wallet> {
    const wallet = await qr.manager
      .createQueryBuilder(Wallet, 'w')
      .where('w.id = :id', { id: walletId })
      .setLock('pessimistic_write')
      .getOne();

    if (!wallet) {
      throw new WalletErreur(
        WalletErreurType.WALLET_INTROUVABLE,
        `Wallet introuvable : ${walletId}`,
        { walletId },
      );
    }

    return wallet;
  }

  /* ==========================================================
   * LOCK DOUBLE (deux wallets — transfert)
   * ========================================================== */

  /**
   * Charge deux wallets avec SELECT FOR UPDATE.
   *
   * ORDRE DÉTERMINISTE : toujours lock dans l'ordre alphabétique
   * des IDs UUID pour éviter les deadlocks.
   *
   * @throws WalletErreur(WALLET_INTROUVABLE) si l'un est absent
   */
  async lockDualWallets(
    sourceWalletId: string,
    targetWalletId: string,
    qr: QueryRunner,
  ): Promise<{ sourceWallet: Wallet; targetWallet: Wallet }> {
    const [firstId, secondId] =
      sourceWalletId < targetWalletId
        ? [sourceWalletId, targetWalletId]
        : [targetWalletId, sourceWalletId];

    const first  = await this.lockWallet(firstId, qr);
    const second = await this.lockWallet(secondId, qr);

    return sourceWalletId === firstId
      ? { sourceWallet: first,  targetWallet: second }
      : { sourceWallet: second, targetWallet: first  };
  }

  /* ==========================================================
   * HELPER : EXÉCUTER DANS UNE TRANSACTION GÉRÉE
   * ========================================================== */

  /**
   * Crée un QueryRunner, démarre une transaction, exécute le callback,
   * commite ou rollback, libère. Retourne le résultat du callback.
   *
   * Pattern recommandé pour les services qui n'ont pas encore
   * un QueryRunner (appels directs depuis WalletEngine).
   */
  async runInTransaction<T>(
    callback: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const result = await callback(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /* ==========================================================
   * HELPER : LOCK + TRANSACTION AUTOMATIQUE
   * ========================================================== */

  /**
   * Démarre une transaction, verrouille le wallet, exécute le callback.
   * Raccourci pour les opérations sur un seul wallet.
   */
  async runWithLockedWallet<T>(
    walletId: string,
    callback: (wallet: Wallet, qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    return this.runInTransaction(async (qr) => {
      const wallet = await this.lockWallet(walletId, qr);
      return callback(wallet, qr);
    });
  }

  /**
   * Démarre une transaction, verrouille les deux wallets (ordre déterministe),
   * exécute le callback.
   */
  async runWithLockedDualWallets<T>(
    sourceWalletId: string,
    targetWalletId: string,
    callback: (
      sourceWallet: Wallet,
      targetWallet: Wallet,
      qr: QueryRunner,
    ) => Promise<T>,
  ): Promise<T> {
    return this.runInTransaction(async (qr) => {
      const { sourceWallet, targetWallet } = await this.lockDualWallets(
        sourceWalletId,
        targetWalletId,
        qr,
      );
      return callback(sourceWallet, targetWallet, qr);
    });
  }
}
