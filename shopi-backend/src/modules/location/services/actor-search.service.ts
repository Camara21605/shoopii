/* ============================================================
 * FICHIER : src/modules/location/services/actor-search.service.ts
 *
 * RÔLE : Recherche par nom d'une boutique, d'un livreur ou d'un
 *        correspondant, pour affichage sur la carte "Ma position"
 *        du client (marqueur + distance/itinéraire depuis lui).
 *
 * Positions renvoyées :
 *   - Boutique      : Company.latitude/longitude (adresse publique)
 *   - Correspondant : Correspondent.depotLatitude/depotLongitude
 *                      (point relais physique, déjà public)
 *   - Livreur       : Delivery.lastLatitude/lastLongitude — dernière
 *                      position GPS connue. Décision produit : on
 *                      accepte d'exposer cette position (comme le
 *                      suivi déjà utilisé pendant une livraison
 *                      active) plutôt que de se limiter à sa zone
 *                      approximative, pour une distance/ligne utile.
 *                      Un livreur qui n'a jamais partagé sa position
 *                      n'apparaît simplement pas dans les résultats.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { UserStatus } from '../../../database/entities/user.entity';

export interface ActorSearchResult {
  id: string;
  name: string;
  role: 'vendor' | 'delivery' | 'correspondent';
  lat: number;
  lng: number;
  address: string | null;
}

/** Résultats max par type, pour garder une liste de suggestions courte. */
const LIMIT_PER_TYPE = 5;

@Injectable()
export class ActorSearchService {
  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery) private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly correspondantRepo: Repository<Correspondent>,
  ) {}

  async search(query: string): Promise<ActorSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const like = `%${q}%`;

    const [companies, deliveries, correspondants] = await Promise.all([
      this.companyRepo
        .createQueryBuilder('co')
        .where('co.status = :status', { status: 'active' })
        .andWhere('co.companyName ILIKE :q', { q: like })
        .andWhere('co.latitude IS NOT NULL AND co.longitude IS NOT NULL')
        .take(LIMIT_PER_TYPE)
        .getMany(),

      this.deliveryRepo
        .createQueryBuilder('lp')
        .innerJoin('lp.user', 'u')
        .where('u.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('lp.fullName ILIKE :q', { q: like })
        .andWhere('lp.lastLatitude IS NOT NULL AND lp.lastLongitude IS NOT NULL')
        .take(LIMIT_PER_TYPE)
        .getMany(),

      this.correspondantRepo
        .createQueryBuilder('cp')
        .innerJoin('cp.user', 'u')
        .where('u.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('cp.fullName ILIKE :q', { q: like })
        .andWhere('cp.depotLatitude IS NOT NULL AND cp.depotLongitude IS NOT NULL')
        .take(LIMIT_PER_TYPE)
        .getMany(),
    ]);

    const results: ActorSearchResult[] = [
      ...companies.map(c => ({
        id:      c.id,
        name:    (c as any).companyName ?? 'Boutique',
        role:    'vendor' as const,
        lat:     Number((c as any).latitude),
        lng:     Number((c as any).longitude),
        address: [(c as any).commune, (c as any).ville].filter(Boolean).join(', ') || null,
      })),
      ...deliveries.map(d => ({
        id:      d.id,
        name:    (d as any).fullName ?? 'Livreur',
        role:    'delivery' as const,
        lat:     Number((d as any).lastLatitude),
        lng:     Number((d as any).lastLongitude),
        address: (d as any).zone ?? null,
      })),
      ...correspondants.map(c => ({
        id:      c.id,
        name:    (c as any).fullName ?? 'Correspondant',
        role:    'correspondent' as const,
        lat:     Number((c as any).depotLatitude),
        lng:     Number((c as any).depotLongitude),
        address: [(c as any).depotAdresse, (c as any).depotVille].filter(Boolean).join(', ') || null,
      })),
    ];

    return results;
  }
}
