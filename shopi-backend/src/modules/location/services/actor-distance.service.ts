/* ============================================================
 * FICHIER : src/modules/location/services/actor-distance.service.ts
 *
 * RÔLE : distance entre le client et une entreprise, un livreur ou un
 * correspondant — calculée par le système de localisation, jamais saisie
 * ni déduite côté affichage.
 *
 *   - point de départ : la position du client (GPS ou adresse enregistrée) ;
 *   - point d'arrivée : position enregistrée de l'acteur (entreprise :
 *     adresse ; correspondant : point de dépôt ; livreur : dernière position
 *     partagée) ; à défaut, position APPROXIMATIVE de son quartier / de sa
 *     ville (GeocodingService), signalée `approx` ;
 *   - distance à vol d'oiseau (Haversine, GeoService), arrondie à 100 m pour
 *     ne pas révéler la position exacte d'un livreur par recoupement ;
 *   - un acteur sans position exploitable est simplement absent du résultat.
 * L'itinéraire routier (durée, tracé) reste fourni par RouteService.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';

import { GeoService }       from './geo.service';
import { GeocodingService } from './geocoding.service';
import type { ApproxPrecision } from './geocoding.service';

export type DistanceRole = 'vendor' | 'delivery' | 'correspondent';

export interface ActorDistance {
  km:        number;
  /** true = position déduite du quartier / de la ville de l'acteur (pas un GPS) */
  approx:    boolean;
  precision: 'exact' | ApproxPrecision;
}

const valid = (n: number | null): n is number => n != null && Number.isFinite(n);

@Injectable()
export class ActorDistanceService {
  constructor(
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:     Repository<Correspondent>,
    private readonly geo:       GeoService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** Clé de résultat : « role:id ». */
  async distances(
    from:   { lat: number; lng: number },
    actors: { role: DistanceRole; id: string }[],
  ): Promise<Record<string, ActorDistance>> {
    const ids = (role: DistanceRole) => [...new Set(actors.filter(a => a.role === role).map(a => a.id))];
    const out: Record<string, ActorDistance> = {};
    const origin = { latitude: from.lat, longitude: from.lng };

    const add = (
      role: DistanceRole, id: string,
      exact: { lat: unknown; lng: unknown },
      where: { ville: string | null; commune: string | null; quartier: string | null },
    ) => {
      const lat = exact.lat != null ? Number(exact.lat) : null;
      const lng = exact.lng != null ? Number(exact.lng) : null;
      let target: { lat: number; lng: number } | null = null;
      let approx = false;
      let precision: ActorDistance['precision'] = 'exact';

      if (valid(lat) && valid(lng) && !(lat === 0 && lng === 0)) {
        target = { lat, lng };
      } else {
        const p = this.geocoding.resolveNow(where);
        if (p) { target = { lat: p.lat, lng: p.lng }; approx = true; precision = p.precision; }
      }
      if (!target) return;

      const km = this.geo.distanceKm(origin, { latitude: target.lat, longitude: target.lng });
      out[`${role}:${id}`] = { km: Math.round(km * 10) / 10, approx, precision };
    };

    const [vIds, dIds, cIds] = [ids('vendor'), ids('delivery'), ids('correspondent')];

    const [vendors, deliveries, corrs] = await Promise.all([
      vIds.length ? this.companyRepo.find({
        where:  { id: In(vIds) },
        select: ['id', 'latitude', 'longitude', 'ville', 'commune', 'quartier'],
      }) : [],
      dIds.length ? this.deliveryRepo.find({
        where:  { id: In(dIds) },
        select: ['id', 'lastLatitude', 'lastLongitude', 'ville', 'commune', 'quartier', 'zone'],
      }) : [],
      cIds.length ? this.corrRepo.find({
        where:  { id: In(cIds) },
        select: ['id', 'depotLatitude', 'depotLongitude', 'depotVille', 'depotCommune', 'depotQuartier'],
      }) : [],
    ]);

    for (const c of vendors)    add('vendor',        c.id, { lat: c.latitude,      lng: c.longitude },
      { ville: c.ville, commune: c.commune, quartier: c.quartier });
    for (const d of deliveries) add('delivery',      d.id, { lat: d.lastLatitude,  lng: d.lastLongitude },
      { ville: d.ville, commune: d.commune ?? d.zone, quartier: d.quartier });
    for (const c of corrs)      add('correspondent', c.id, { lat: c.depotLatitude, lng: c.depotLongitude },
      { ville: c.depotVille, commune: c.depotCommune, quartier: c.depotQuartier });

    return out;
  }
}
