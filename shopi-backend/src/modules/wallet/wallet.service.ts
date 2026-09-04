/* ============================================================
 * FICHIER : src/modules/wallet/wallet.service.ts
 *
 * RÔLE    : Logique métier du Portefeuille (Wallet), commune
 *           à tous les rôles. Chaque utilisateur possède un
 *           wallet unique (créé à la volée si absent).
 * ============================================================ */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { User } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import {
  Wallet,
  WalletCurrency,
  WalletPaymentMethod,
} from 'src/database/entities/wallet.entity';
import {
  TransactionStatus,
  TransactionType,
  WalletTransaction,
} from 'src/database/entities/wallet-transaction.entity';
import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from 'src/database/entities/paiement/paiement-distribution.entity';

import {
  AddPaymentMethodDto,
  AutoTransferDto,
  ListWalletTransactionsDto,
  WalletChartQueryDto,
  WalletOperationDto,
} from './dto/wallet.dto';
import { PlatformSettingsCacheService } from '../performance-engine/services/platform-settings-cache.service';

@Injectable()
export class WalletService {

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    private readonly dataSource: DataSource,

    /* BUG CORRIGÉ — PlatformSettings.minWithdrawalAmount/maxTransactionAmount/
     * dailyWithdrawalLimit (Paramètres Plateforme > Paiements) se
     * sauvegardaient en base sans jamais être lus : la seule route réelle
     * de retrait (POST /wallet/withdraw → applyOperation ci-dessous)
     * n'appliquait aucun de ces plafonds. Un pipeline distinct et bien
     * écrit (settlement-engine/) applique déjà ces mêmes règles, mais
     * n'est jamais appelé par aucun contrôleur — orphelin. */
    private readonly settingsCache: PlatformSettingsCacheService,
  ) {}

  // ── Récupère (ou crée) le wallet d'un utilisateur ───────────────

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        balance: 0,
        pendingBalance: 0,
        currency: WalletCurrency.GNF,
        totalCredited: 0,
        totalDebited: 0,
        dailyWithdrawLimit: 0,
        todayWithdrawAmount: 0,
        paymentMethods: [],
        autoTransferEnabled: false,
      });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  /**
   * Montant actuellement verrouillé par PlatformSettings.settlementDelayDays
   * — voir le commentaire détaillé dans applyOperation(). Factorisé ici car
   * réutilisé par getSummary() (affichage) et applyOperation() (contrôle).
   */
  private async computeSettlementLocked(
    manager: EntityManager,
    walletId: string,
    settlementDelayDays: number,
  ): Promise<number> {
    if (!settlementDelayDays || settlementDelayDays <= 0) return 0;
    const lockedSince = new Date(Date.now() - settlementDelayDays * 86_400_000);
    const result = await manager
      .createQueryBuilder(WalletTransaction, 'tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.walletId = :walletId', { walletId })
      .andWhere('tx.type = :type', { type: TransactionType.CREDIT })
      .andWhere('tx.referenceType = :rt', { rt: 'escrow' })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt > :lockedSince', { lockedSince })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  // ── Résumé du portefeuille (solde, KPI, méthodes) ───────────────

  async getSummary(user: User) {
    const wallet = await this.getOrCreateWallet(user.id);
    const { settlementDelayDays } = await this.settingsCache.getSettings();
    const settlementLocked = await this.computeSettlementLocked(this.dataSource.manager, wallet.id, Number(settlementDelayDays));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthTx = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :start', { start: startOfMonth })
      .getMany();

    const thisMonthIn = monthTx
      .filter(t => t.type === TransactionType.CREDIT)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const thisMonthOut = monthTx
      .filter(t => t.type === TransactionType.DEBIT)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    /* BUG CORRIGÉ — cette requête filtrait sur WalletTransaction.referenceType
     * = 'commission', une valeur qui n'est écrite NULLE PART dans le code
     * (grep exhaustif) : le flux réel (EscrowReleaseService → WalletEngine)
     * écrit toujours referenceType = 'escrow', quel que soit l'acteurType.
     * `totalCommission` retournait donc 0 pour absolument tous les rôles.
     * On interroge maintenant directement la table faisant autorité
     * (PaiementDistribution) — même motif que correspondant-dashboard.service.ts
     * et admin-taux.service.ts — en ne sommant que les parts où ce user a
     * effectivement joué un rôle de PRÉLÈVEUR de commission (partenaire,
     * admin, plateforme), pas les parts ENTREPRISE/LIVREUR/CORRESPONDANT
     * qui représentent leur revenu produit/livraison, pas une commission. */
    const totalCommission = await this.distRepo
      .createQueryBuilder('pd')
      .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
      .where('pd.acteurUserId = :uid', { uid: user.id })
      .andWhere('pd.status = :s',      { s: DistributionStatus.RELEASED })
      .andWhere('pd.acteurType IN (:...types)', {
        types: [
          DistributionActeurType.PLATEFORME_PRODUIT,
          DistributionActeurType.PLATEFORME_LIVRAISON,
          DistributionActeurType.PARTENAIRE_PRODUIT,
          DistributionActeurType.PARTENAIRE_LIVRAISON,
          DistributionActeurType.ADMIN_PRODUIT,
          DistributionActeurType.ADMIN_LIVRAISON,
          DistributionActeurType.PLATEFORME,   // legacy
          DistributionActeurType.PARTENAIRE,   // legacy
        ],
      })
      .getRawOne<{ total: string }>();

    return {
      balance: Number(wallet.balance),
      pendingBalance: Number(wallet.pendingBalance),
      currency: wallet.currency,
      status: wallet.status,
      totalCredited: Number(wallet.totalCredited),
      totalDebited: Number(wallet.totalDebited),
      thisMonthIn,
      thisMonthOut,
      totalCommission: Number(totalCommission?.total ?? 0),
      dailyWithdrawLimit: Number(wallet.dailyWithdrawLimit),
      todayWithdrawAmount: Number(wallet.todayWithdrawAmount),
      paymentMethods: wallet.paymentMethods ?? [],
      autoTransferEnabled: wallet.autoTransferEnabled,
      autoTransferMethodId: wallet.autoTransferMethodId,
      /* PlatformSettings.settlementDelayDays — montant du solde encore en
       * délai de règlement (non retirable) et montant réellement
       * disponible au retrait dès maintenant. */
      settlementLocked:      settlementLocked,
      withdrawableBalance:   Math.max(Number(wallet.balance) - settlementLocked, 0),
    };
  }

  // ── Liste paginée des transactions ──────────────────────────────

  async getTransactions(user: User, dto: ListWalletTransactionsDto) {
    const wallet = await this.getOrCreateWallet(user.id);

    const page  = dto.page  && dto.page  > 0 ? dto.page  : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id });

    if (dto.type === 'in')  qb.andWhere('tx.type = :type', { type: TransactionType.CREDIT });
    if (dto.type === 'out') qb.andWhere('tx.type IN (:...types)', { types: [TransactionType.DEBIT, TransactionType.TRANSFER] });

    qb.orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map(t => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amount: Number(t.amount),
        description: t.description,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Graphique d'évolution des revenus (entrées) ─────────────────

  async getChart(user: User, dto: WalletChartQueryDto) {
    const wallet = await this.getOrCreateWallet(user.id);
    const period = dto.period ?? 'mois';

    const buckets: { label: string; start: Date; end: Date }[] = [];
    const now = new Date();

    if (period === 'semaine') {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        buckets.push({ label: days[start.getDay()], start, end });
      }
    } else if (period === 'annee') {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        buckets.push({ label: months[start.getMonth()], start, end });
      }
    } else {
      // mois → 4 semaines glissantes
      for (let i = 3; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        buckets.push({ label: `S${4 - i}`, start, end });
      }
    }

    const result: { label: string; value: number }[] = [];
    for (const b of buckets) {
      const sum = await this.txRepo
        .createQueryBuilder('tx')
        .where('tx.walletId = :walletId', { walletId: wallet.id })
        .andWhere('tx.type = :type', { type: TransactionType.CREDIT })
        .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
        .andWhere('tx.createdAt >= :start AND tx.createdAt < :end', { start: b.start, end: b.end })
        .select('COALESCE(SUM(tx.amount), 0)', 'total')
        .getRawOne<{ total: string }>();

      result.push({ label: b.label, value: Number(sum?.total ?? 0) });
    }

    return result;
  }

  // ── Dépôt ────────────────────────────────────────────────────────

  async deposit(user: User, dto: WalletOperationDto) {
    return this.applyOperation(user, dto, TransactionType.CREDIT, 'deposit', 'Dépôt');
  }

  // ── Retrait ──────────────────────────────────────────────────────

  async withdraw(user: User, dto: WalletOperationDto) {
    return this.applyOperation(user, dto, TransactionType.DEBIT, 'withdraw', 'Retrait');
  }

  // ── Transfert ────────────────────────────────────────────────────

  async transfer(user: User, dto: WalletOperationDto) {
    return this.applyOperation(user, dto, TransactionType.TRANSFER, 'transfer', 'Transfert');
  }

  // ── Opération générique (dépôt / retrait / transfert) ───────────

  private async applyOperation(
    user: User,
    dto: WalletOperationDto,
    type: TransactionType,
    referenceType: string,
    label: string,
  ) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const wallet = await qr.manager.findOne(Wallet, { where: { userId: user.id } });
      if (!wallet) throw new NotFoundException('Portefeuille introuvable.');

      const isDebit = type === TransactionType.DEBIT || type === TransactionType.TRANSFER;

      /* Plafonds plateforme (super-admin) — appliqués à TOUTE opération,
       * avant les vérifications de solde spécifiques au débit. */
      const platformSettings = await this.settingsCache.getSettings();

      if (Number(platformSettings.maxTransactionAmount) > 0 &&
          dto.amount > Number(platformSettings.maxTransactionAmount)) {
        throw new BadRequestException(
          `Le montant dépasse le plafond autorisé par transaction (${platformSettings.maxTransactionAmount}).`,
        );
      }

      if (referenceType === 'withdraw' &&
          Number(platformSettings.minWithdrawalAmount) > 0 &&
          dto.amount < Number(platformSettings.minWithdrawalAmount)) {
        throw new BadRequestException(
          `Le montant minimum de retrait est de ${platformSettings.minWithdrawalAmount}.`,
        );
      }

      if (isDebit) {
        /* Garde KYC partenaire — un partenaire dont les documents de
         * vérification obligatoires (CNI + justificatif de domicile) ne
         * sont pas fournis ne peut pas retirer ses commissions. Le
         * justificatif d'activité reste optionnel, il ne bloque jamais.
         * Ne s'applique qu'aux retraits (pas aux dépôts/transferts) et
         * uniquement au rôle PARTNER — les autres rôles n'ont pas de
         * profil Partner et ne sont pas concernés par ce KYC. */
        if (referenceType === 'withdraw' && user.role === UserRole.PARTNER) {
          const partner = await qr.manager.findOne(Partner, { where: { userId: user.id } });
          if (!partner || !partner.documentCni || !partner.documentDomicile) {
            throw new BadRequestException(
              'Retrait bloqué : veuillez fournir votre pièce d\'identité (CNI) et votre '
              + 'justificatif de domicile dans Paramètres > Documents & vérification avant '
              + 'de pouvoir retirer vos commissions.',
            );
          }
        }

        if (Number(wallet.balance) < dto.amount) {
          throw new BadRequestException('Solde insuffisant pour cette opération.');
        }

        /* Plafond journalier : le plafond spécifique au wallet (s'il est
         * défini) prévaut sur le plafond plateforme par défaut — sinon
         * c'est le réglage plateforme qui s'applique à tous. */
        const dailyLimit = Number(wallet.dailyWithdrawLimit) > 0
          ? Number(wallet.dailyWithdrawLimit)
          : Number(platformSettings.dailyWithdrawalLimit);

        if (dailyLimit > 0 &&
            Number(wallet.todayWithdrawAmount) + dto.amount > dailyLimit) {
          throw new BadRequestException('Limite de retrait journalière dépassée.');
        }

        /* BUG CORRIGÉ — PlatformSettings.settlementDelayDays se sauvegardait
         * en base sans jamais être appliqué : un vendeur pouvait retirer une
         * vente confirmée à la seconde près. Le solde reste crédité et
         * VISIBLE immédiatement (choix produit : ne pas dégrader l'affichage
         * du solde) — seul le RETRAIT est bloqué tant que le produit des
         * ventes récentes n'a pas dépassé ce délai.
         *
         * Approche "réserve glissante" : on ne trace pas quel retrait pioche
         * dans quelle vente (le wallet n'a qu'un solde global) — on calcule
         * plutôt le montant total des crédits escrow des N derniers jours et
         * on le verrouille en bloc. Conservateur par construction : ne peut
         * jamais SOUS-estimer le montant verrouillé, seulement le
         * surestimer dans un cas limite (argent ancien déjà dépensé, argent
         * récent qui arrive) — le même compromis qu'une réserve tournante
         * classique (Stripe et similaires). */
        if (referenceType === 'withdraw' && Number(platformSettings.settlementDelayDays) > 0) {
          const locked      = await this.computeSettlementLocked(qr.manager, wallet.id, Number(platformSettings.settlementDelayDays));
          const withdrawable = Number(wallet.balance) - locked;

          if (dto.amount > withdrawable) {
            throw new BadRequestException(
              locked > 0
                ? `Une partie de votre solde (${locked}) est encore en délai de règlement `
                  + `(${platformSettings.settlementDelayDays} jour(s) après la vente). `
                  + `Montant actuellement disponible au retrait : ${Math.max(withdrawable, 0)}.`
                : 'Solde insuffisant pour cette opération.',
            );
          }
        }
      }

      let method: WalletPaymentMethod | undefined;
      if (dto.methodId) {
        method = (wallet.paymentMethods ?? []).find(m => m.id === dto.methodId);
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter  = isDebit ? balanceBefore - dto.amount : balanceBefore + dto.amount;

      wallet.balance = balanceAfter;
      if (isDebit) {
        wallet.totalDebited = Number(wallet.totalDebited) + dto.amount;
        wallet.todayWithdrawAmount = Number(wallet.todayWithdrawAmount) + dto.amount;
      } else {
        wallet.totalCredited = Number(wallet.totalCredited) + dto.amount;
      }
      await qr.manager.save(Wallet, wallet);

      const tx = qr.manager.create(WalletTransaction, {
        walletId: wallet.id,
        type,
        status: TransactionStatus.COMPLETED,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        performedBy: user.id,
        referenceType,
        description: dto.note ?? `${label}${method ? ' — ' + method.label : ''}`,
      });
      await qr.manager.save(WalletTransaction, tx);

      await qr.commitTransaction();

      return {
        balance: Number(wallet.balance),
        transaction: {
          id: tx.id,
          type: tx.type,
          status: tx.status,
          amount: Number(tx.amount),
          description: tx.description,
          createdAt: tx.createdAt,
        },
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Méthodes de paiement ─────────────────────────────────────────

  async addPaymentMethod(user: User, dto: AddPaymentMethodDto) {
    const wallet = await this.getOrCreateWallet(user.id);
    const methods = wallet.paymentMethods ?? [];

    const newMethod: WalletPaymentMethod = {
      id: randomUUID(),
      type: dto.type,
      label: dto.label,
      number: dto.number,
      isDefault: methods.length === 0,
    };

    methods.push(newMethod);
    wallet.paymentMethods = methods;
    await this.walletRepo.save(wallet);

    return wallet.paymentMethods;
  }

  async setDefaultPaymentMethod(user: User, methodId: string) {
    const wallet = await this.getOrCreateWallet(user.id);
    const methods = wallet.paymentMethods ?? [];

    if (!methods.some(m => m.id === methodId)) {
      throw new NotFoundException('Méthode de paiement introuvable.');
    }

    wallet.paymentMethods = methods.map(m => ({ ...m, isDefault: m.id === methodId }));
    await this.walletRepo.save(wallet);

    return wallet.paymentMethods;
  }

  async removePaymentMethod(user: User, methodId: string) {
    const wallet = await this.getOrCreateWallet(user.id);
    const methods = wallet.paymentMethods ?? [];

    const removed = methods.find(m => m.id === methodId);
    if (!removed) throw new NotFoundException('Méthode de paiement introuvable.');

    let remaining = methods.filter(m => m.id !== methodId);
    if (removed.isDefault && remaining.length > 0) {
      remaining = remaining.map((m, i) => ({ ...m, isDefault: i === 0 }));
    }

    wallet.paymentMethods = remaining;
    if (wallet.autoTransferMethodId === methodId) wallet.autoTransferMethodId = null;
    await this.walletRepo.save(wallet);

    return wallet.paymentMethods;
  }

  // ── Virement automatique ─────────────────────────────────────────

  async setAutoTransfer(user: User, dto: AutoTransferDto) {
    const wallet = await this.getOrCreateWallet(user.id);

    if (dto.methodId && !(wallet.paymentMethods ?? []).some(m => m.id === dto.methodId)) {
      throw new NotFoundException('Méthode de paiement introuvable.');
    }

    wallet.autoTransferEnabled = dto.enabled;
    if (dto.methodId) wallet.autoTransferMethodId = dto.methodId;
    await this.walletRepo.save(wallet);

    return {
      autoTransferEnabled: wallet.autoTransferEnabled,
      autoTransferMethodId: wallet.autoTransferMethodId,
    };
  }
}
