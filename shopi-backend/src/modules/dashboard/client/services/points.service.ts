/* ============================================================
 * src/modules/dashboard/client/services/points.service.ts
 * Section 4 — Points Shopi
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';
import { Client }                 from '../../../../database/entities/profiles/client-profile.entity';
import { User }                          from '../../../../database/entities/user.entity';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!profile) throw new NotFoundException('Profil client introuvable.');

    const points        = (profile as any).shopiPoints       ?? 0;
    const pointsGagnes  = (profile as any).pointsGagnesMois  ?? 0;
    const pointsUtilises= (profile as any).pointsUtilises    ?? 0;
    const niveau        = this.getNiveau(points);
    const prochainNiveau= this.getProchainNiveau(niveau);
    const progression   = prochainNiveau
      ? Math.min(100, Math.round(((points - niveau.seuil) / (prochainNiveau.seuil - niveau.seuil)) * 100))
      : 100;

    return {
      points, pointsGagnes, pointsUtilises,
      niveau:          niveau.nom,
      prochainNiveau:  prochainNiveau?.nom ?? null,
      seuilProchain:   prochainNiveau?.seuil ?? null,
      progression,
      expirationProchaine: (profile as any).pointsExpiration ?? null,
    };
  }

  private getNiveau(pts: number) {
    if (pts >= 10000) return { nom: 'Diamant', seuil: 10000 };
    if (pts >= 4000)  return { nom: 'Platine',  seuil: 4000  };
    if (pts >= 1500)  return { nom: 'Or',       seuil: 1500  };
    if (pts >= 500)   return { nom: 'Argent',   seuil: 500   };
    return               { nom: 'Bronze',    seuil: 0     };
  }

  private getProchainNiveau(actuel: { nom: string }) {
    const niveaux = [
      { nom: 'Argent',  seuil: 500   },
      { nom: 'Or',      seuil: 1500  },
      { nom: 'Platine', seuil: 4000  },
      { nom: 'Diamant', seuil: 10000 },
    ];
    return niveaux.find(n => n.nom !== actuel.nom && !['Bronze','Argent','Or','Platine'].slice(0, niveaux.findIndex(x => x.nom === actuel.nom)).includes(n.nom)) ?? null;
  }
}
