/* ============================================================
 * FICHIER : src/modules/paiement/services/paiement-distribution.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Libère les fonds en escrow (pendingBalance) vers les wallets
 * disponibles (balance) de chaque acteur, à la confirmation
 * de livraison.
 *
 * ─────────────────────────────────────────────────────────────
 * DÉCLENCHEMENT
 * ─────────────────────────────────────────────────────────────
 *
 * Appelé depuis :
 *   1. CommandeValidationService.validerEtape()
 *      → quand acteurType === CLIENT → DELIVERED
 *
 *   2. CommandeScheduler.processAutoDelivered()
 *      → quand AWAITING_CLIENT + autoValidationAt dépassé → AUTO_DELIVERED
 *
 * ─────────────────────────────────────────────────────────────
 * IDEMPOTENCE
 * ─────────────────────────────────────────────────────────────
 *
 *  distribute() vérifie si les PaiementDistributions sont
 *  déjà en status RELEASED avant de rien faire.
 *  Appel 1 → ESCROW → RELEASED
 *  Appel 2 → déjà RELEASED → no-op
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/services/paiement-distribution.service.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Commande, CommandeStatus }     from '../../../database/entities/commande/commande.entity';
import { Wallet }                       from '../../../database/entities/wallet.entity';
import {
  WalletTransaction,
  TransactionType,
  TransactionStatus,
} from '../../../database/entities/wallet-transaction.entity';
import {
  PaiementDistribution,
  DistributionStatus,
} from '../../../database/entities/paiement/paiement-distribution.entity';
import { NotificationEventService }     from '../../notifications/events/notification-event.service';
import { NotificationActorType }        from '../../../database/entities/notification/notification.entitiy';

@Injectable()
export class PaiementDistributionService {

  private readonly logger = new Logger(PaiementDistributionService.name);

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,

    private readonly dataSource:     DataSource,
    private readonly notifEventSvc:  NotificationEventService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * distribute() — libère les fonds escrow vers balance
   ════════════════════════════════════════════════════════ */

  /**
   * Libère tous les fonds en escrow pour une commande livrée.
   *
   * @param commandeId UUID de la commande DELIVERED ou AUTO_DELIVERED
   * @param triggeredBy 'client' | 'auto' — pour le log d'audit
   */
  async distribute(commandeId: string, triggeredBy: 'client' | 'auto' = 'auto'): Promise<void> {

    /* ── 1. Récupérer les distributions en ESCROW ─────────── */

    const distributions = await this.distributionRepo.find({
      where: { commandeId, status: DistributionStatus.ESCROW },
    });

    if (distributions.length === 0) {
      this.logger.log(`[Distribution] Commande ${commandeId} — aucune distribution en escrow`);
      return;
    }

    /* ── 2. Récupérer la commande pour l'audit ─────────────── */

    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) {
      this.logger.error(`[Distribution] Commande introuvable: ${commandeId}`);
      return;
    }

    this.logger.log(
      `[Distribution] Commande ${commande.numero} — libération de ` +
      `${distributions.length} part(s) — déclencheur: ${triggeredBy}`,
    );

    /* ── 3. Transaction SQL atomique ──────────────────────── */

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const now = new Date();

      /* ── Correctif N+1 (Performance Engine P0) ──────────────
       * Avant : un SELECT wallet par distribution dans la boucle
       *         → N requêtes pour N acteurs (5 acteurs = 5 SELECT)
       * Après : un seul SELECT IN([walletId1, walletId2, ...])
       *         → 1 requête quelle que soit la taille du lot
       * ─────────────────────────────────────────────────────── */
      const walletIds = distributions.map(d => d.walletId).filter(Boolean);
      const walletsArr = await qr.manager.find(Wallet, {
        where: { id: In(walletIds) },
      });
      const walletMap = new Map(walletsArr.map(w => [w.id, w]));

      for (const distribution of distributions) {

        /* Wallet de l'acteur — lookup O(1) depuis la Map */
        const wallet = walletMap.get(distribution.walletId);

        if (!wallet) {
          this.logger.warn(
            `[Distribution] Wallet ${distribution.walletId} introuvable ` +
            `pour acteur ${distribution.acteurNom} — ignoré`,
          );
          continue;
        }

        const balanceBefore     = Number(wallet.balance);
        const pendingBefore     = Number(wallet.pendingBalance);
        const montant           = distribution.montant;
        const balanceAfter      = balanceBefore + montant;
        const pendingAfter      = Math.max(0, pendingBefore - montant);

        /* Mettre à jour le wallet */
        wallet.balance        = balanceAfter;
        wallet.pendingBalance = pendingAfter;
        wallet.totalCredited  = Number(wallet.totalCredited) + montant;
        await qr.manager.save(Wallet, wallet);

        /* WalletTransaction RELEASE */
        const tx = qr.manager.create(WalletTransaction, {
          walletId:      wallet.id,
          type:          TransactionType.CREDIT,
          status:        TransactionStatus.COMPLETED,
          amount:        montant,
          balanceBefore,
          balanceAfter,
          performedBy:   null,
          referenceType: 'distribution_commande',
          referenceId:   distribution.id,
          description:   `Paiement — Commande ${commande.numero} — ${distribution.acteurNom}`,
        });
        const savedTx = await qr.manager.save(WalletTransaction, tx);

        /* Mettre à jour la distribution */
        distribution.status              = DistributionStatus.RELEASED;
        distribution.releasedAt          = now;
        distribution.releaseTransactionId = savedTx.id;
        await qr.manager.save(PaiementDistribution, distribution);

        this.logger.log(
          `[Distribution] ✅ ${distribution.acteurNom} — ` +
          `${montant} GNF → wallet ${wallet.id} ` +
          `(balance: ${balanceBefore} → ${balanceAfter})`,
        );
      }

      await qr.commitTransaction();

      /* ── 4. Notifications (hors transaction) ────────────── */
      this.sendDistributionNotifications(commande, distributions).catch(err =>
        this.logger.error('[Distribution] Erreur notifications:', err),
      );

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`[Distribution] Transaction SQL échouée pour ${commandeId}:`, err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  /* ════════════════════════════════════════════════════════
   * Annulation — retourne les fonds en escrow au client
   ════════════════════════════════════════════════════════ */

  /**
   * Annule toutes les distributions en escrow pour une commande.
   * Appelé lors d'une annulation / remboursement.
   *
   * Note : le remboursement vers le provider (vrai remboursement)
   * est géré séparément par PaiementRemboursementService.
   * Ici on ne fait que libérer les wallets des acteurs.
   */
  async annuler(commandeId: string, raison: string, adminUserId?: string): Promise<void> {

    const distributions = await this.distributionRepo.find({
      where: { commandeId, status: DistributionStatus.ESCROW },
    });

    if (distributions.length === 0) {
      this.logger.log(`[Distribution/Annul] Commande ${commandeId} — rien à annuler`);
      return;
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const now = new Date();

      for (const distribution of distributions) {

        const wallet = await qr.manager.findOne(Wallet, { where: { id: distribution.walletId } });
        if (!wallet) continue;

        /* Décrémenter le pendingBalance */
        wallet.pendingBalance = Math.max(0, Number(wallet.pendingBalance) - distribution.montant);
        await qr.manager.save(Wallet, wallet);

        /* Annuler la distribution */
        distribution.status       = DistributionStatus.CANCELLED;
        distribution.cancelledAt  = now;
        distribution.cancelRaison = raison;
        distribution.actionParUserId = adminUserId ?? null;
        await qr.manager.save(PaiementDistribution, distribution);
      }

      await qr.commitTransaction();

      this.logger.log(`[Distribution/Annul] Commande ${commandeId} — ${distributions.length} escrow annulés`);

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`[Distribution/Annul] Échec pour ${commandeId}:`, err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  /* ── Notifications ──────────────────────────────────────── */

  private async sendDistributionNotifications(
    commande:      Commande,
    distributions: PaiementDistribution[],
  ): Promise<void> {

    for (const dist of distributions) {
      /* Ne notifie pas la plateforme elle-même */
      if (dist.acteurType === 'plateforme') continue;

      const recipientType = this.acteurTypeToNotifType(dist.acteurType);
      if (!recipientType) continue;

      const recipientId = await this.getActeurId(commande, dist.acteurType);
      if (!recipientId) continue;

      void this.notifEventSvc.notifyOrderStatusChanged({
        recipientType,
        recipientId,
        actorType:  null,
        actorId:    null,
        orderRef:   commande.numero,
        commandeId: commande.id,
        newStatus:  commande.status,
        title:      '💳 Fonds disponibles',
        body:       `${dist.montant.toLocaleString('fr-FR')} GNF ont été versés à votre portefeuille pour la commande ${commande.numero}.`,
      });
    }
  }

  private acteurTypeToNotifType(acteurType: string): NotificationActorType | null {
    const MAP: Record<string, NotificationActorType> = {
      entreprise:    NotificationActorType.COMPANY,
      livreur:       NotificationActorType.DELIVERY,
      correspondant: NotificationActorType.CORRESPONDENT,
    };
    return MAP[acteurType] ?? null;
  }

  private async getActeurId(commande: Commande, acteurType: string): Promise<string | null> {
    switch (acteurType) {
      case 'entreprise':    return commande.companyId;
      case 'livreur':       return commande.livreurId;
      case 'correspondant': return commande.correspondantId;
      default:              return null;
    }
  }
}
