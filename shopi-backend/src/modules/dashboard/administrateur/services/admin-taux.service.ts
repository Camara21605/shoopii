/* ============================================================
 * SERVICE : admin-taux.service.ts
 *
 * Lecture des taux de commission (PlatformSettings) et cumul
 * des distributions perçues par l'admin (PaiementDistribution).
 *
 * Ces données sont globales à la plateforme (non filtrées par zone)
 * et n'ont donc pas besoin du profil Admin.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { PlatformSettings } from '../../../../database/entities/platform-settings.entity';
import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../../database/entities/paiement/paiement-distribution.entity';

@Injectable()
export class AdminTauxService {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly platformRepo: Repository<PlatformSettings>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,
  ) {}

  /**
   * Lit les taux de commission depuis PlatformSettings (ligne id = 1)
   * et calcule les cumuls de distributions admin RELEASED.
   *
   * 4 agrégations parallèles pour minimiser la latence :
   *   1. Total admin (produit + livraison) — cumulatif global
   *   2. Total livraison seule — pour afficher le split
   *   3. Mois en cours admin (produit + livraison)
   *   4. Mois en cours livraison seule
   */
  async getTaux() {
    const platform   = await this.platformRepo.findOne({ where: { id: 1 } });
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [prodRow, livrRow, prodMonthRow, livrMonthRow] = await Promise.all([
      this.distRepo.createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurType IN (:...types)', {
          types: [DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON],
        })
        .andWhere('pd.status = :s', { s: DistributionStatus.RELEASED })
        .getRawOne(),

      this.distRepo.createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurType = :type', { type: DistributionActeurType.ADMIN_LIVRAISON })
        .andWhere('pd.status = :s', { s: DistributionStatus.RELEASED })
        .getRawOne(),

      this.distRepo.createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurType IN (:...types)', {
          types: [DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON],
        })
        .andWhere('pd.status = :s', { s: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),

      this.distRepo.createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .where('pd.acteurType = :type', { type: DistributionActeurType.ADMIN_LIVRAISON })
        .andWhere('pd.status = :s', { s: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),
    ]);

    return {
      // Taux bruts Shopi (lus depuis PlatformSettings, avec valeurs par défaut)
      tauxCommissionProduit:    +(platform?.tauxCommissionProduit    ?? 6),
      tauxCommissionLivraison:  +(platform?.tauxCommissionLivraison  ?? 10),
      // Ratios de répartition admin / partenaire / Shopi
      ratioAdminProduit:        +(platform?.ratioAdminProduit        ?? 10),
      ratioAdminLivraison:      +(platform?.ratioAdminLivraison      ?? 15),
      ratioPartenaireProduit:   +(platform?.ratioPartenaireProduit   ?? 20),
      ratioPartenaireLivraison: +(platform?.ratioPartenaireLivraison ?? 25),
      ratioShopiProduit:        +(platform?.ratioShopiProduit        ?? 70),
      ratioShopiLivraison:      +(platform?.ratioShopiLivraison      ?? 60),
      // Cumuls de commissions perçues par les admins
      totalCommissionsAdmin:      +prodRow?.total      || 0,
      totalCommissionsLivraison:  +livrRow?.total      || 0,
      commissionsAdminThisMonth:  +prodMonthRow?.total || 0,
      commissionsLivrThisMonth:   +livrMonthRow?.total || 0,
    };
  }
}
