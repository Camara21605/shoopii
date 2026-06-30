/* ============================================================
 * FICHIER : returns/services/returns-stats.service.ts
 *
 * RÔLE : Calcul des statistiques des retours depuis PostgreSQL.
 *        Toutes les métriques sont calculées dynamiquement.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReturnRequest, ReturnStatus, ReturnReason }
  from 'src/database/entities/returns/return-request.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';

@Injectable()
export class ReturnsStatsService {

  constructor(
    @InjectRepository(ReturnRequest) private readonly returnRepo:  Repository<ReturnRequest>,
    @InjectRepository(Company)       private readonly companyRepo: Repository<Company>,
  ) {}

  async getStats(userId: string) {
    const company = await this.companyRepo.findOne({
      where: { userId }, select: ['id'],
    });
    if (!company) return this.emptyStats();

    const companyId = company.id;

    /* ── Toutes les stats en parallèle ── */
    const now      = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      total,
      today,
      thisWeek,
      thisMonth,
      pending,
      accepted,
      refused,
      refunded,
      montantStats,
      topMotifsRaw,
      topProduitsRaw,
      evolutionRaw,
    ] = await Promise.all([
      /* total */
      this.returnRepo.count({ where: { companyId } }),

      /* today */
      this.returnRepo
        .createQueryBuilder('r')
        .where('r.companyId = :companyId', { companyId })
        .andWhere('r.createdAt >= :todayStart', { todayStart })
        .getCount(),

      /* this week */
      this.returnRepo
        .createQueryBuilder('r')
        .where('r.companyId = :companyId', { companyId })
        .andWhere('r.createdAt >= :weekStart', { weekStart })
        .getCount(),

      /* this month */
      this.returnRepo
        .createQueryBuilder('r')
        .where('r.companyId = :companyId', { companyId })
        .andWhere('r.createdAt >= :monthStart', { monthStart })
        .getCount(),

      /* pending */
      this.returnRepo.count({ where: { companyId, status: ReturnStatus.PENDING } }),

      /* accepted */
      this.returnRepo.count({ where: { companyId, status: ReturnStatus.ACCEPTED } }),

      /* refused */
      this.returnRepo.count({ where: { companyId, status: ReturnStatus.REFUSED } }),

      /* refunded */
      this.returnRepo.count({ where: { companyId, status: ReturnStatus.REFUNDED } }),

      /* montant total remboursé + délai moyen */
      this.returnRepo
        .createQueryBuilder('r')
        .select('SUM(r.montantAccorde)', 'totalRembourse')
        .addSelect(
          'AVG(EXTRACT(EPOCH FROM (r.acceptedAt - r.createdAt)) / 3600)',
          'delaiMoyenHeures',
        )
        .where('r.companyId = :companyId', { companyId })
        .andWhere('r.status IN (:...statuses)', {
          statuses: [ReturnStatus.REFUNDED, ReturnStatus.EXCHANGED],
        })
        .getRawOne(),

      /* top motifs */
      this.returnRepo
        .createQueryBuilder('r')
        .select('r.reason', 'reason')
        .addSelect('COUNT(*)', 'count')
        .where('r.companyId = :companyId', { companyId })
        .groupBy('r.reason')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),

      /* top produits */
      this.returnRepo
        .createQueryBuilder('r')
        .select('r.productName', 'productName')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(r.montantDemande)', 'totalMontant')
        .where('r.companyId = :companyId', { companyId })
        .groupBy('r.productName')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),

      /* évolution mensuelle sur 6 mois */
      this.returnRepo
        .createQueryBuilder('r')
        .select("TO_CHAR(r.createdAt, 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN r.status = 'accepted' OR r.status = 'refunded' THEN 1 ELSE 0 END)`,
          'accepted',
        )
        .addSelect(
          `SUM(CASE WHEN r.status = 'refused' THEN 1 ELSE 0 END)`,
          'refused',
        )
        .where('r.companyId = :companyId', { companyId })
        .andWhere('r.createdAt >= :sixMonthsAgo', {
          sixMonthsAgo: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        })
        .groupBy("TO_CHAR(r.createdAt, 'YYYY-MM')")
        .orderBy('month', 'ASC')
        .getRawMany(),
    ]);

    const totalAccepted = accepted + refunded;
    const totalDecided  = totalAccepted + refused;
    const tauxAcceptation = totalDecided > 0
      ? Math.round((totalAccepted / totalDecided) * 100)
      : 0;

    return {
      total,
      today,
      thisWeek,
      thisMonth,
      pending,
      accepted,
      refused,
      refunded,
      totalMontantRembourse: Number(montantStats?.totalRembourse ?? 0),
      tauxAcceptation,
      delaiMoyenHeures: Math.round(Number(montantStats?.delaiMoyenHeures ?? 0)),

      topMotifs: topMotifsRaw.map((r, i) => ({
        reason:     r.reason as ReturnReason,
        count:      Number(r.count),
        percentage: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
      })),

      topProduits: topProduitsRaw.map(r => ({
        productName:  r.productName as string,
        count:        Number(r.count),
        montantTotal: Number(r.totalMontant ?? 0),
      })),

      evolutionMensuelle: evolutionRaw.map(r => ({
        month:    r.month as string,
        total:    Number(r.total),
        accepted: Number(r.accepted),
        refused:  Number(r.refused),
      })),
    };
  }

  private emptyStats() {
    return {
      total: 0, today: 0, thisWeek: 0, thisMonth: 0,
      pending: 0, accepted: 0, refused: 0, refunded: 0,
      totalMontantRembourse: 0, tauxAcceptation: 0, delaiMoyenHeures: 0,
      topMotifs: [], topProduits: [], evolutionMensuelle: [],
    };
  }
}
