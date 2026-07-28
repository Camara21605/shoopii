/* ============================================================
 * SERVICE : admin-partenaires.service.ts
 *
 * Liste des partenaires de la zone avec leur classement,
 * score de confiance et top-3 mis en avant dans le widget.
 *
 * Les scores (conversion, confiance) sont estimés à partir du
 * nombre de recrues jusqu'à ce que les colonnes dédiées soient
 * alimentées par des agrégations sur les commandes réelles.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Partner }          from '../../../../database/entities/profiles/partenaire-profile.entity';
import { UserStatus }       from '../../../../database/entities/user.entity';
import { initials, userName } from '../helpers/admin.helpers';

/** Dégradés de couleur attribués aux 3 premiers du classement. */
const GRADS = [
  'linear-gradient(135deg,#0E7490,#22D3EE)', // 1er — cyan
  'linear-gradient(135deg,#6D28D9,#9F67E8)', // 2ème — violet
  'linear-gradient(135deg,#047857,#34D399)', // 3ème — vert
];

@Injectable()
export class AdminPartenairesService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
  ) {}

  /**
   * Retourne la liste complète des partenaires de la zone,
   * triée par nombre de recrues décroissant, avec :
   *   • tier   — 'or' (1er), 'arg' (2e/3e), 'brz' (autres)
   *   • top3   — les 3 premiers avec gradient pour le widget
   *
   * Le nombre de recrues = totalCompanies + totalDeliveries + totalCorrespondants
   * (colonnes dénormalisées sur Partner, mises à jour par triggers / events).
   */
  async getPartenaires(userId: string) {
    const admin    = await this.zoneService.adminOf(userId);
    const partners = await this.partnerRepo.find({
      where:     { adminId: admin.id },
      relations: ['user'],
      order:     { totalCompanies: 'DESC' },
    });

    const list = partners.map((p, i) => {
      const nom     = userName(p.user);
      const recrues = ((p as any).totalCompanies      ?? 0)
                    + ((p as any).totalDeliveries     ?? 0)
                    + ((p as any).totalCorrespondants ?? 0);

      return {
        id:         p.id,
        nom,
        avatar:     initials(nom),
        commune:    (p as any).commune ?? '—',
        depuis:     new Date(p.user.createdAt).toLocaleDateString('fr-FR', {
          month: 'short', year: 'numeric',
        }),
        tier:       i === 0 ? 'or' : i < 3 ? 'arg' : 'brz',
        recrues,
        // Taux de conversion estimé : minimum 20%, plafonné à 95%
        conversion: Math.min(95, Math.max(20, recrues * 3 + 40)),
        // Score de confiance : élevé si actif, réduit si suspendu
        confiance:  p.user.status === UserStatus.ACTIVE
                    ? Math.min(98, 70 + recrues) : 40,
        statut:     p.user.status === UserStatus.ACTIVE ? 'act' : 'pend',
        grad:       GRADS[Math.min(i, 2)],
      };
    });

    // Top 3 pour le widget de mise en avant (sans données redondantes)
    const top3 = list.slice(0, 3).map(p => ({
      nom:    p.nom,
      avatar: p.avatar,
      v:      p.recrues,
      sub:    `recrues · ${p.conversion}% conversion`,
      grad:   p.grad,
    }));

    return { list, top3 };
  }
}
