/* ============================================================
 * src/modules/dashboard/client/services/points.service.ts
 * Section 4 — Shoneya Points
 *
 * BUG CORRIGÉ — le « prochain niveau » était calculé par une expression
 * incohérente : un client Bronze se voyait proposer Platine, un client Or se
 * voyait proposer Argent (et la progression était calculée contre le mauvais
 * palier). Les niveaux sont maintenant une simple table ordonnée.
 * Un client sans profil n'est plus une erreur 404 : il a 0 point.
 *
 * NB : aucune règle d'attribution de points n'existe encore dans la plateforme
 * (rien n'incrémente shopiPoints) ; `actif` l'indique honnêtement à l'interface.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Client }           from '../../../../database/entities/profiles/client-profile.entity';
import { User }             from '../../../../database/entities/user.entity';

/** Paliers, du plus bas au plus haut. */
export const NIVEAUX = [
  { nom: 'Bronze',  seuil: 0     },
  { nom: 'Argent',  seuil: 500   },
  { nom: 'Or',      seuil: 1500  },
  { nom: 'Platine', seuil: 4000  },
  { nom: 'Diamant', seuil: 10000 },
] as const;

export function niveauPour(points: number) {
  const pts = Math.max(0, Math.floor(points) || 0);
  let idx = 0;
  NIVEAUX.forEach((n, i) => { if (pts >= n.seuil) idx = i; });
  const actuel  = NIVEAUX[idx];
  const suivant = NIVEAUX[idx + 1] ?? null;
  const progression = suivant
    ? Math.min(100, Math.max(0, Math.round(((pts - actuel.seuil) / (suivant.seuil - actuel.seuil)) * 100)))
    : 100;
  return { actuel, suivant, progression };
}

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    const points         = Number((profile as any)?.shopiPoints)      || 0;
    const pointsGagnes   = Number((profile as any)?.pointsGagnesMois) || 0;
    const pointsUtilises = Number((profile as any)?.pointsUtilises)   || 0;
    const { actuel, suivant, progression } = niveauPour(points);

    return {
      points, pointsGagnes, pointsUtilises,
      niveau:         actuel.nom,
      prochainNiveau: suivant?.nom ?? null,
      seuilProchain:  suivant?.seuil ?? null,
      progression,
      expirationProchaine: (profile as any)?.pointsExpiration ?? null,
      /** false = aucun point n'a jamais été attribué : le programme n'est pas encore ouvert */
      actif: points > 0 || pointsGagnes > 0 || pointsUtilises > 0,
    };
  }
}
