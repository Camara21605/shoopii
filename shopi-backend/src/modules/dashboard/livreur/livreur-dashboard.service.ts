/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.service.ts
 *
 * RÔLE : Stats & données overview du dashboard livreur.
 *        getMissions() branché sur la table `commandes`.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';

import { Delivery }  from 'src/database/entities/profiles/livreur-profile.entity';
import { Commande, CommandeStatus } from 'src/database/entities/commande/commande.entity';
import { Notification, NotificationActorType } from 'src/database/entities/notification/notification.entitiy';
import { PlatformSettings }    from 'src/database/entities/platform-settings.entity';
import { PaiementDistribution, DistributionActeurType, DistributionStatus } from 'src/database/entities/paiement/paiement-distribution.entity';
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';

/** Statuts d'une livraison effectivement terminée (compte "livraisons du mois") */
const DELIVERED_STATUSES: CommandeStatus[] = [
  CommandeStatus.DELIVERED,
  CommandeStatus.AUTO_DELIVERED,
];

/** Libellés courts des jours, index = Date.getDay() (0 = dimanche) */
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET STATS — KPI du profil livreur
   *
   * totalDeliveries/totalEarnings/averageRating : compteurs lifetime
   * (colonnes Delivery). deliveriesThisMonth et boutiquesAbonnees
   * sont calculés à la volée — pas de colonne dédiée pour eux.
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

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [deliveriesThisMonth, boutiquesAbonnees] = await Promise.all([
      this.commandeRepo.count({
        where: {
          livreurId: livreur.id,
          status:    In(DELIVERED_STATUSES),
          dateLivraisonEffective: MoreThanOrEqual(monthStart),
        },
      }),
      this.followRepo.count({
        where: {
          followerType: FollowerActorType.DELIVERY,
          followerId:   livreur.id,
          targetType:   TargetActorType.COMPANY,
          isSubscribed: true,
        },
      }),
    ]);

    return {
      totalDeliveries:     livreur.totalDeliveries,
      totalEarnings:       livreur.totalEarnings,
      averageRating:       livreur.averageRating,
      status:              livreur.status,
      verificationStatus:  livreur.verificationStatus,
      deliveriesThisMonth,
      boutiquesAbonnees,
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
   * GET REVENUS/CHART — revenus réels groupés par jour, pour le
   * graphique "Revenus" du dashboard (remplace les données factices
   * REV_WEEK/REV_MONTH qui vivaient côté frontend).
   *
   * period='semaine' → 7 derniers jours, un point par jour.
   * period='mois'    → 5 derniers "paquets" de 7 jours, un point
   *                    par paquet (le plus récent = "Actuel").
   *
   * Une seule requête groupée par jour ; le remplissage des jours
   * sans transaction (valeur 0) se fait ensuite en mémoire.
   * ────────────────────────────────────────────────────────── */
  async getRevenusChart(userId: string, period: 'semaine' | 'mois' = 'semaine') {
    const now      = new Date();
    const daysBack = period === 'semaine' ? 6 : 34; // 5 paquets de 7 jours
    const from     = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select('DATE(pd.createdAt)', 'day')
      .addSelect('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
      .where('pd.acteurUserId = :uid',   { uid: userId })
      .andWhere('pd.acteurType = :type', { type: DistributionActeurType.LIVREUR })
      .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
      .andWhere('pd.createdAt >= :from', { from })
      .groupBy('DATE(pd.createdAt)')
      .getRawMany();

    const byDay = new Map<string, number>(
      rows.map(r => [new Date(r.day).toDateString(), Number(r.total)]),
    );

    if (period === 'semaine') {
      const out: { j: string; v: number; today?: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toDateString();
        out.push({
          j:     i === 0 ? 'Auj' : DAY_LABELS[d.getDay()],
          v:     byDay.get(key) ?? 0,
          ...(i === 0 ? { today: true } : {}),
        });
      }
      return out;
    }

    /* Mois : 5 paquets de 7 jours, du plus ancien au plus récent */
    const out: { j: string; v: number; today?: boolean }[] = [];
    for (let w = 4; w >= 0; w--) {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        const dayOffset = w * 7 + i;
        if (dayOffset > daysBack) continue;
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
        sum += byDay.get(d.toDateString()) ?? 0;
      }
      out.push({
        j: w === 0 ? 'Actuel' : `S${5 - w}`,
        v: sum,
        ...(w === 0 ? { today: true } : {}),
      });
    }
    return out;
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
