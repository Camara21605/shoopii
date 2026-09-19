/* ============================================================
 * FICHIER : src/modules/location/services/place-search.service.ts
 *
 * RÔLE : recherche de LIEUX (villes, communes, quartiers de Guinée) pour la
 * carte : taper « Boussoura » ou « Kaloum » propose le lieu lui-même, en plus
 * des entreprises / livreurs / correspondants qui s'y trouvent.
 *
 *  - suggestions : recherche locale dans le référentiel (aucun appel externe,
 *    donc sans limite de débit — adaptée à la saisie à la frappe) ;
 *  - locate     : coordonnées d'UN lieu choisi (géocodage précis, une seule
 *    requête par choix — voir GeocodingService.resolveAwait).
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { GUINEA_CITIES } from '../data/guinea-gazetteer';
import { GUINEA_PLACES, type PlaceType } from '../data/guinea-places';
import { GeocodingService, fold, type ApproxPosition } from './geocoding.service';

export interface MapPlace {
  /** Identifiant stable côté client : type|nom|commune|ville */
  key:      string;
  name:     string;
  type:     PlaceType;
  ville:    string;
  commune:  string | null;
  /** « Quartier · Commune, Ville » prêt à afficher */
  label:    string;
}

export interface LocatedPlace {
  lat:       number;
  lng:       number;
  precision: ApproxPosition['precision'];
  /** Nom trouvé (recherche libre uniquement) */
  label?:    string;
}

const LIMIT = 6;
const TYPE_BONUS: Record<PlaceType, number> = { ville: 6, commune: 3, quartier: 0 };

@Injectable()
export class PlaceSearchService {
  constructor(private readonly geocoding: GeocodingService) {}

  /** Toutes les entrées du référentiel, préparées une fois (≈ 220 lignes). */
  private readonly index: (MapPlace & { f: string })[] = [
    ...GUINEA_CITIES.map(c => this.entry('ville', c.nom, c.nom, null)),
    ...GUINEA_PLACES.map(p => this.entry(p.t, p.n, p.v, p.c ?? null)),
  ];

  private entry(type: PlaceType, name: string, ville: string, commune: string | null) {
    /* « Kindia » · « Kaloum, Conakry » · « Boussoura · Kaloum, Conakry » */
    const label = type === 'ville'
      ? name
      : [type === 'quartier' && commune ? `${name} · ${commune}` : name, ville].join(', ');
    return { key: [type, fold(name), fold(commune), fold(ville)].join('|'), name, type, ville, commune, label, f: fold(name) };
  }

  suggestions(query: string): MapPlace[] {
    const q = fold(query);
    if (q.length < 2) return [];

    const scored: { p: MapPlace; s: number }[] = [];
    for (const e of this.index) {
      let s = 0;
      if (e.f === q)                                  s = 100;
      else if (e.f.startsWith(q))                     s = 85;
      else if (e.f.split(' ').some(w => w.startsWith(q))) s = 70;
      else if (e.f.includes(q))                       s = 55;
      if (s) scored.push({ p: e, s: s + TYPE_BONUS[e.type] });
    }
    scored.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, 'fr'));

    /* Le champ interne de comparaison (`f`) n'est pas exposé */
    return scored.slice(0, LIMIT).map(({ p }) => {
      const { f: _f, ...rest } = p as MapPlace & { f: string };
      return rest;
    });
  }

  async locate(input: { nom: string; type: PlaceType | 'libre'; commune?: string; ville?: string }): Promise<LocatedPlace | null> {
    if (input.type === 'libre') {
      const r = await this.geocoding.searchFree(input.nom);
      return r ? { lat: r.lat, lng: r.lng, precision: 'quartier', label: r.label } : null;
    }
    const place =
      input.type === 'ville'   ? { ville: input.nom } :
      input.type === 'commune' ? { commune: input.nom, ville: input.ville } :
                                 { quartier: input.nom, commune: input.commune, ville: input.ville };
    const p = await this.geocoding.resolveAwait(place);
    return p ? { lat: p.lat, lng: p.lng, precision: p.precision } : null;
  }
}
