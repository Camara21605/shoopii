/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.service.ts
 *
 * RÔLE : Stats & données overview du dashboard livreur.
 *        getMissions() branché sur la table `commandes`.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';

import { Delivery }  from 'src/database/entities/profiles/livreur-profile.entity';
import { Commande, CommandeStatus } from 'src/database/entities/commande/commande.entity';
import { Notification, NotificationActorType } from 'src/database/entities/notification/notification.entitiy';
import { PlatformSettings }    from 'src/database/entities/platform-settings.entity';
import { PaiementDistribution, DistributionActeurType, DistributionStatus } from 'src/database/entities/paiement/paiement-distribution.entity';

/** Statuts d'une mission en cours */
const ACTIVE_STATUSES: CommandeStatus[] = [
  CommandeStatus.PAID,
  CommandeStatus.IN_PROGRESS,
  CommandeStatus.AWAITING_CLIENT,
];

/** Statuts d'une mission terminée (historique récent) */
const RECENT_STATUSES: CommandeStatus[] = [
  CommandeStatus.DELIVERED,
  CommandeStatus.AUTO_DELIVERED,
  CommandeStatus.CANCELLED,
  CommandeStatus.DISPUTED,
];

@Injectable()
export class LivreurDashboardService {

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,

    @InjectRepository(PlatformSettings)
    private readonly platformRepo: Repository<PlatformSettings>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET STATS — KPI du profil livreur
   * ────────────────────────────────────────────────────────── */
  async getStats(userId: string) {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      select: [
        'id', 'totalDeliveries', 'totalEarnings',
        'averageRating', 'status', 'verificationStatus',
      ],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    return {
      totalDeliveries:    livreur.totalDeliveries,
      totalEarnings:      livreur.totalEarnings,
      averageRating:      livreur.averageRating,
      status:             livreur.status,
      verificationStatus: livreur.verificationStatus,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET MISSIONS — actives + historique récent
   *
   * active  : commandes en cours (PAID / IN_PROGRESS / AWAITING_CLIENT)
   * recent  : 10 dernières missions terminées (DELIVERED / CANCELLED…)
   * ────────────────────────────────────────────────────────── */
  async getMissions(userId: string) {
    const livreur = await this.livreurRepo.findOne({
      where:  { userId },
      select: ['id'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    /* Les deux requêtes en parallèle pour éviter la séquentialité */
    const [activeMissions, recentMissions] = await Promise.all([
      this.commandeRepo.find({
        where: { livreurId: livreur.id, status: In(ACTIVE_STATUSES) },
        select: [
          'id', 'numero', 'status', 'modeLivraison',
          'total', 'fraisLivraison', 'villeLivraison', 'adresseLivraison',
          'datelivraisonEstimee', 'createdAt',
        ],
        order: { createdAt: 'DESC' },
      }),

      this.commandeRepo.find({
        where: { livreurId: livreur.id, status: In(RECENT_STATUSES) },
        select: [
          'id', 'numero', 'status', 'modeLivraison',
          'total', 'fraisLivraison', 'villeLivraison',
          'dateLivraisonEffective', 'createdAt',
        ],
        order:  { updatedAt: 'DESC' },
        take:   10,
      }),
    ]);

    return {
      active:    activeMissions.map(c => this.formatMission(c)),
      recent:    recentMissions.map(c => this.formatMission(c)),
      nbActives: activeMissions.length,
    };
  }

  /* ── Format compact d'une mission renvoyé au frontend ── */
  private formatMission(c: Commande) {
    return {
      id:            c.id,
      numero:        c.numero,
      status:        c.status,
      modeLivraison: c.modeLivraison,
      montant:       Number(c.fraisLivraison ?? 0),
      total:         Number(c.total ?? 0),
      destination:   [c.adresseLivraison, c.villeLivraison].filter(Boolean).join(', ') || 'Non précisée',
      dateEstimee:   c.datelivraisonEstimee ?? null,
      dateLivraison: c.dateLivraisonEffective ?? null,
      createdAt:     c.createdAt,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET REVENUS — taux plateforme + gains réels depuis distributions
   * ────────────────────────────────────────────────────────── */
  async getRevenus(userId: string) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [platform, totalRow, monthRow, recentDist] = await Promise.all([
      this.platformRepo.findOne({ where: { id: 1 } }),

      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurUserId = :uid',   { uid: userId })
        .andWhere('pd.acteurType = :type', { type: DistributionActeurType.LIVREUR })
        .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
        .getRawOne(),

      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurUserId = :uid',   { uid: userId })
        .andWhere('pd.acteurType = :type', { type: DistributionActeurType.LIVREUR })
        .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),

      this.distRepo.find({
        where: {
          acteurUserId: userId,
          acteurType:   DistributionActeurType.LIVREUR,
        },
        order: { createdAt: 'DESC' },
        take:  20,
      }),
    ]);

    return {
      tauxCommission:   +(platform?.tauxCommissionLivraison ?? 10),
      totalRevenus:     +totalRow?.total  || 0,
      revenusThisMonth: +monthRow?.total  || 0,
      transactions: recentDist.map(tx => ({
        id:      tx.id,
        source:  tx.commandeNumero ?? 'Livraison',
        montant: +tx.montant,
        date:    tx.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        statut:  tx.status,
      })),
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET ACTIVITE — 15 notifications récentes du livreur
   * ────────────────────────────────────────────────────────── */
  async getActivite(userId: string) {
    const livreur = await this.livreurRepo.findOne({
      where:  { userId },
      select: ['id'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    const notifs = await this.notifRepo.find({
      where: {
        recipientType: NotificationActorType.DELIVERY,
        recipientId:   livreur.id,
      },
      select: ['id', 'type', 'title', 'body', 'isRead', 'createdAt'],
      order:  { createdAt: 'DESC' },
      take:   15,
    });

    return notifs.map(n => ({
      id:        n.id,
      type:      n.type,
      title:     n.title,
      body:      n.body,
      isRead:    n.isRead,
      createdAt: n.createdAt,
    }));
  }
}
