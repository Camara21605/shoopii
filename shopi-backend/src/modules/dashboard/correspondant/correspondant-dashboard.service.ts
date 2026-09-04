/* ============================================================
 * FICHIER : correspondant-dashboard.service.ts
 *
 * RÔLE : Fournit les données du dashboard correspondant.
 *   GET /dashboard/correspondant/revenus
 *     → Taux de commission + gains réels depuis les distributions
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSettings }    from '../../../database/entities/platform-settings.entity';
import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../database/entities/paiement/paiement-distribution.entity';

/** Libellés courts des jours de la semaine (index 0 = Dimanche). */
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

@Injectable()
export class CorrespondantDashboardService {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly platformRepo: Repository<PlatformSettings>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,
  ) {}

  async getRevenus(userId: string) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [platform, totalRow, monthRow, commissionRow, recentDist, chartWeek, chartMonth] = await Promise.all([
      this.platformRepo.findOne({ where: { id: 1 } }),

      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurUserId = :uid',   { uid: userId })
        .andWhere('pd.acteurType = :type', { type: DistributionActeurType.CORRESPONDANT })
        .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
        .getRawOne(),

      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurUserId = :uid',   { uid: userId })
        .andWhere('pd.acteurType = :type', { type: DistributionActeurType.CORRESPONDANT })
        .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),

      /* BUG CORRIGÉ — le frontend recalculait "Commission Shoneya" en
       * appliquant tauxCommission à revenusThisMonth, qui est DÉJÀ le net
       * versé au correspondant (post-commission) : ça revenait à prélever
       * une seconde commission sur un montant déjà net, un chiffre sans
       * rapport avec ce que Shopi a réellement prélevé. La vraie commission
       * prélevée sur les commandes que ce correspondant a traitées ce mois
       * est la somme des parts PLATEFORME_LIVRAISON des MÊMES commandes. */
      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurType = :ptype', { ptype: DistributionActeurType.PLATEFORME_LIVRAISON })
        .andWhere('pd.status = :ps',     { ps: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :pfrom', { pfrom: monthStart })
        .andWhere(qb => {
          const sub = qb.subQuery()
            .select('sub.commandeId')
            .from(PaiementDistribution, 'sub')
            .where('sub.acteurUserId = :cuid', { cuid: userId })
            .andWhere('sub.acteurType = :ctype', { ctype: DistributionActeurType.CORRESPONDANT })
            .andWhere('sub.status = :cs', { cs: DistributionStatus.RELEASED })
            .andWhere('sub.createdAt >= :cfrom', { cfrom: monthStart })
            .getQuery();
          return 'pd.commandeId IN ' + sub;
        })
        .getRawOne(),

      this.distRepo.find({
        where: {
          acteurUserId: userId,
          acteurType:   DistributionActeurType.CORRESPONDANT,
        },
        order: { createdAt: 'DESC' },
        take:  20,
      }),

      this.daySlice(userId, 7),
      this.weekSlice(userId, 5),
    ]);

    return {
      tauxCommission:      +(platform?.tauxCommissionLivraison ?? 10),
      totalRevenus:        +totalRow?.total      || 0,
      revenusThisMonth:    +monthRow?.total      || 0,
      commissionThisMonth: +commissionRow?.total || 0,
      transactions: recentDist.map(tx => ({
        id:      tx.id,
        source:  tx.commandeNumero ?? 'Relais colis',
        montant: +tx.montant,
        date:    tx.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        statut:  tx.status,
      })),
      chartWeek,
      chartMonth,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GRAPHES DE REVENUS — dérivés de PaiementDistribution
  // ══════════════════════════════════════════════════════════════

  /** Revenus des N derniers jours, groupés par jour. */
  private async daySlice(userId: string, daysBack: number) {
    const now  = new Date();
    const from = new Date(now.getTime() - daysBack * 86_400_000);

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select("DATE_TRUNC('day', pd.createdAt)", 'period')
      .addSelect('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'v')
      .where('pd.acteurUserId = :uid',   { uid: userId })
      .andWhere('pd.acteurType = :type', { type: DistributionActeurType.CORRESPONDANT })
      .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
      .andWhere('pd.createdAt >= :from', { from })
      .groupBy("DATE_TRUNC('day', pd.createdAt)")
      .getRawMany()
      .catch(() => []);

    const map = new Map(rows.map((r): [string, number] => [new Date(r.period).toISOString().slice(0, 10), +r.v]));

    const result: { j: string; v: number; today?: boolean }[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const d   = new Date(now); d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        j:     DAY_LABELS[d.getDay()],
        v:     map.get(key) ?? 0,
        today: i === 0,
      });
    }
    return result;
  }

  /** Revenus des N dernières semaines, groupés par semaine glissante. */
  private async weekSlice(userId: string, weeks: number) {
    const now  = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 86_400_000);

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select("DATE_TRUNC('day', pd.createdAt)", 'period')
      .addSelect('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'v')
      .where('pd.acteurUserId = :uid',   { uid: userId })
      .andWhere('pd.acteurType = :type', { type: DistributionActeurType.CORRESPONDANT })
      .andWhere('pd.status = :s',        { s: DistributionStatus.RELEASED })
      .andWhere('pd.createdAt >= :from', { from })
      .groupBy("DATE_TRUNC('day', pd.createdAt)")
      .getRawMany()
      .catch(() => []);

    const map = new Map(rows.map((r): [string, number] => [new Date(r.period).toISOString().slice(0, 10), +r.v]));

    const result: { j: string; v: number; today?: boolean }[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      let v = 0;
      for (let day = 0; day < 7; day++) {
        const d   = new Date(now); d.setDate(now.getDate() - w * 7 - day);
        v += map.get(d.toISOString().slice(0, 10)) ?? 0;
      }
      result.unshift({ j: w === 0 ? 'Act' : `S${weeks - w}`, v, today: w === 0 });
    }
    return result;
  }
}
