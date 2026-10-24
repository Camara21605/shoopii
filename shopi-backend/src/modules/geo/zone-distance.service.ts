/* ============================================================
 * FICHIER : src/modules/geo/zone-distance.service.ts
 *
 * RÔLE : distance d'une zone de livraison tracée ENTRE DEUX LIEUX du
 * référentiel — deux quartiers, deux communes, deux villes (préfectures),
 * deux régions ou deux pays —, calculée automatiquement, jamais saisie.
 *
 *   1. Position de chaque lieu :
 *        · coordonnées enregistrées dans le référentiel → exacte ;
 *        · sinon (quartier, commune) géocodage du lieu (quartier, commune,
 *          ville) → approximative ;
 *        · sinon coordonnées du premier parent qui en a (commune → ville →
 *          région → pays) ; pour un pays sans coordonnées : centre de ses
 *          régions → approximative.
 *   2. Distance PAR LA ROUTE (voiture) via RouteService (OpenRouteService,
 *      puis OSRM) avec la durée du trajet ; si aucun routeur ne répond :
 *      distance à vol d'oiseau (Haversine), sans durée.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GeoCommune } from '../../database/entities/geo/geo-commune.entity';
import { GeoPays } from '../../database/entities/geo/geo-pays.entity';
import { GeoPrefecture } from '../../database/entities/geo/geo-prefecture.entity';
import { GeoQuartier } from '../../database/entities/geo/geo-quartier.entity';
import { GeoRegion } from '../../database/entities/geo/geo-region.entity';
import type { ZoneCoverageType } from '../../database/entities/geo/geo-zone.entity';
import { GeocodingService } from '../location/services/geocoding.service';
import { GeoService as GeoMath } from '../location/services/geo.service';
import { RouteService } from '../location/services/route.service';

export type PointPrecision = 'exacte' | 'quartier' | 'commune' | 'ville' | 'region' | 'pays';

export interface ZonePoint {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  precision: PointPrecision;
}

export interface ZoneDistance {
  /** Distance en km (2 décimales). */
  distanceKm: number;
  /** Durée du trajet en voiture (min) — null à vol d'oiseau. */
  dureeMin: number | null;
  source: 'route' | 'vol_oiseau';
  /** Au moins une des deux positions est approximative. */
  approx: boolean;
  depart: ZonePoint;
  arrivee: ZonePoint;
}

interface GeoRow { id: string; nom: string; parentId: string | null; latitude: number | string | null; longitude: number | string | null }

const num = (v: number | string | null | undefined): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const coords = (r: GeoRow | null | undefined): { lat: number; lng: number } | null => {
  const lat = num(r?.latitude), lng = num(r?.longitude);
  return lat !== null && lng !== null && !(lat === 0 && lng === 0) ? { lat, lng } : null;
};

@Injectable()
export class ZoneDistanceService {
  private readonly logger = new Logger(ZoneDistanceService.name);

  constructor(
    @InjectRepository(GeoPays)       private readonly paysRepo: Repository<GeoPays>,
    @InjectRepository(GeoRegion)     private readonly regRepo: Repository<GeoRegion>,
    @InjectRepository(GeoPrefecture) private readonly prefRepo: Repository<GeoPrefecture>,
    @InjectRepository(GeoCommune)    private readonly commRepo: Repository<GeoCommune>,
    @InjectRepository(GeoQuartier)   private readonly quartRepo: Repository<GeoQuartier>,
    private readonly route: RouteService,
    private readonly geocoding: GeocodingService,
    private readonly math: GeoMath,
  ) {}

  /** Distance entre deux lieux du même niveau ; null si l'un des deux ne peut pas être situé. */
  async between(type: ZoneCoverageType, idA: string, idB: string): Promise<ZoneDistance | null> {
    const [depart, arrivee] = await Promise.all([this.locate(type, idA), this.locate(type, idB)]);
    if (!depart || !arrivee) return null;
    const approx = depart.precision !== 'exacte' || arrivee.precision !== 'exacte';
    const a = { latitude: depart.lat, longitude: depart.lng };
    const b = { latitude: arrivee.lat, longitude: arrivee.lng };

    const volOiseau = this.math.distanceKm(a, b);
    if (volOiseau < 0.05) return { distanceKm: volOiseau, dureeMin: null, source: 'vol_oiseau', approx, depart, arrivee };

    try {
      const r = await this.route.getRoute([a, b], 'car');
      if (r.provider !== 'straight-line-fallback') {
        return {
          distanceKm: Math.round(r.totalDistanceM / 10) / 100,
          dureeMin: Math.max(1, Math.round(r.totalDurationS / 60)),
          source: 'route', approx, depart, arrivee,
        };
      }
    } catch (e) {
      this.logger.warn(`Itinéraire indisponible (${(e as Error).message}) — distance à vol d'oiseau`);
    }
    return { distanceKm: volOiseau, dureeMin: null, source: 'vol_oiseau', approx, depart, arrivee };
  }

  /** Position d'un lieu du référentiel (voir l'ordre de repli en tête de fichier). */
  async locate(type: ZoneCoverageType, id: string): Promise<ZonePoint | null> {
    const pick = <T extends GeoRow>(repo: Repository<T>, rid: string | null) =>
      rid ? (repo.findOne({ where: { id: rid } as never })) : Promise.resolve(null);

    let quartier: GeoRow | null = null, commune: GeoRow | null = null, ville: GeoRow | null = null;
    let region: GeoRow | null = null, pays: GeoRow | null = null;
    if (type === 'quartier') quartier = await pick(this.quartRepo, id);
    if (type === 'commune') commune = await pick(this.commRepo, id);
    else if (quartier) commune = await pick(this.commRepo, quartier.parentId);
    if (type === 'prefecture') ville = await pick(this.prefRepo, id);
    else if (commune) ville = await pick(this.prefRepo, commune.parentId);
    if (type === 'region') region = await pick(this.regRepo, id);
    else if (ville) region = await pick(this.regRepo, ville.parentId);
    if (type === 'pays') pays = await pick(this.paysRepo, id);
    else if (region) pays = await pick(this.paysRepo, region.parentId);

    const self = { quartier, commune, prefecture: ville, region, pays }[type];
    if (!self) return null;
    const point = (c: { lat: number; lng: number }, precision: PointPrecision): ZonePoint => ({ id: self.id, nom: self.nom, ...c, precision });

    const own = coords(self);
    if (own) return point(own, 'exacte');

    /* Quartier / commune sans coordonnées : géocodage du lieu (quartier, commune, ville). */
    if ((type === 'quartier' || type === 'commune') && ville) {
      try {
        const g = await this.geocoding.resolveAwait({ ville: ville.nom, commune: commune?.nom ?? null, quartier: quartier?.nom ?? null });
        if (g) return point({ lat: g.lat, lng: g.lng }, g.precision);
      } catch { /* repli sur les parents */ }
    }

    for (const [row, precision] of [[commune, 'commune'], [ville, 'ville'], [region, 'region'], [pays, 'pays']] as const) {
      if (row && row !== self) {
        const c = coords(row);
        if (c) return point(c, precision);
      }
    }

    /* Pays sans coordonnées : centre de ses régions. */
    if (type === 'pays') {
      const regions = (await this.regRepo.find({ where: { parentId: self.id } })).map(r => coords(r)).filter(Boolean) as { lat: number; lng: number }[];
      if (regions.length) {
        return point({
          lat: regions.reduce((s, c) => s + c.lat, 0) / regions.length,
          lng: regions.reduce((s, c) => s + c.lng, 0) / regions.length,
        }, 'pays');
      }
    }
    return null;
  }
}
