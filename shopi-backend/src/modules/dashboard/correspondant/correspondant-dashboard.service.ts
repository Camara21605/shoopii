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

    const [platform, totalRow, monthRow, recentDist] = await Promise.all([
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

      this.distRepo.find({
        where: {
          acteurUserId: userId,
          acteurType:   DistributionActeurType.CORRESPONDANT,
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
        source:  tx.commandeNumero ?? 'Relais colis',
        montant: +tx.montant,
        date:    tx.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        statut:  tx.status,
      })),
    };
  }
}
