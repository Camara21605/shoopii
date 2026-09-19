/* ============================================================
 * FICHIER : src/modules/location/services/actor-map.service.ts
 *
 * RÔLE : moteur de la carte de recherche du client (onglet Localisation
 * de l'accueil) : retrouver une ENTREPRISE, un LIVREUR ou un
 * CORRESPONDANT et le situer sur la carte.
 *
 * Ce que la recherche sait faire (l'ancien /location/search-actor ne
 * comparait que le nom, et ne renvoyait que les acteurs ayant un GPS) :
 *   - cherche dans le nom, le QUARTIER, la commune et la ville,
 *     sans tenir compte des accents ni de la casse (« kindia » = « Kindia ») ;
 *   - classe les résultats (nom exact > début de nom > mot > contenu >
 *     quartier > commune > ville), puis par distance au client ;
 *   - situe aussi un acteur SANS GPS d'après son quartier / sa ville
 *     (position « approximative », signalée comme telle — voir GeocodingService) ;
 *   - mode « autour de moi » (sans texte) : les acteurs dans un rayon ;
 *   - n'expose que des profils ACTIFS (jamais un compte en attente).
 *
 * Positions : entreprise → sa position enregistrée ; correspondant → son point
 * de dépôt ; livreur → sa dernière position GPS partagée (décision produit
 * déjà en place, voir ActorSearchService).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery, DeliveryAvailability } from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { UserStatus }    from '../../../database/entities/user.entity';
import { actorLocation } from '../../../common/utils/actor-location.util';

import { GeoService }       from './geo.service';
import { GeocodingService, fold, type ApproxPrecision } from './geocoding.service';
import type { ActorMapQueryDto } from '../dto/actor-map.dto';

export type MapActorRole = 'vendor' | 'delivery' | 'correspondent';

export interface MapActor {
  id:           string;
  role:         MapActorRole;
  name:         string;
  lat:          number;
  lng:          number;
  /** true = position déduite du quartier / de la ville (pas un GPS) */
  approx:       boolean;
  /** exacte, ou niveau de précision de l'approximation */
  precision:    'exact' | ApproxPrecision;
  ville:        string | null;
  quartier:     string | null;
  localisation: string | null;
  address:      string | null;
  image:        string | null;
  rating:       number;
  /** livreur disponible maintenant (sinon null : sans objet) */
  available:    boolean | null;
  distanceKm:   number | null;
  /** Route du frontend vers le profil */
  profilePath:  string;
}

export interface MapSearchResponse {
  results: MapActor[];
  meta: {
    mode:        'search' | 'nearby';
    total:       number;
    approx:      number;
    byRole:      Record<MapActorRole, number>;
    /** true = résultats coupés à `limit` */
    truncated:   boolean;
  };
}

const DEFAULT_LIMIT   = 30;
const CANDIDATES_CAP  = 400;               // par type, avant classement
const DEFAULT_RADIUS  = 25;
/* Retire les accents côté SQL (l'extension `unaccent` n'est pas installée) */
const ACC_FROM = "àâäáãåéèêëíìîïóòôöõúùûüçñ'-";
const ACC_TO   = 'aaaaaaeeeeiiiiooooouuuucn  ';
const unacc = (col: string) => `translate(lower(coalesce(${col}, '')), '${ACC_FROM.replace(/'/g, "''")}', '${ACC_TO}')`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

/** « restaurant kindia » → chaque mot doit se retrouver quelque part (nom, quartier, commune, ville, adresse). */
function applyTokens(qb: SelectQueryBuilder<any>, cols: string[], tokens: string[]): void {
  tokens.forEach((tok, i) => {
    const conds = cols.map(c => `${unacc(c)} LIKE :tk${i} ESCAPE '\\'`).join(' OR ');
    qb.andWhere(`(${conds})`, { [`tk${i}`]: `%${likeEscape(tok)}%` });
  });
}

/** Distance de Levenshtein bornée (abandonne dès qu'elle dépasse `max`). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Tolérance aux fautes de frappe : 1 erreur dès 4 lettres, 2 dès 8 (« famoussa » ≈ « famousssa »). */
function fuzzyMatches(token: string, word: string): boolean {
  if (token.length < 4) return false;
  const max = token.length >= 8 ? 2 : 1;
  return editDistance(token, word, max) <= max
    || (word.length > token.length && editDistance(token, word.slice(0, token.length + max), max) <= max);
}

/** Empreinte stable d'un id — sert à écarter légèrement deux points approximatifs identiques. */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

@Injectable()
export class ActorMapService {
  constructor(
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:     Repository<Correspondent>,
    private readonly geo:       GeoService,
    private readonly geocoding: GeocodingService,
  ) {}

  async search(dto: ActorMapQueryDto): Promise<MapSearchResponse> {
    const raw   = (dto.q ?? '').trim();
    const q     = fold(raw);
    const mode  = q ? 'search' : 'nearby';
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const types = new Set((dto.types ?? 'vendor,delivery,correspondent').split(',') as MapActorRole[]);
    const me    = dto.lat != null && dto.lng != null ? { latitude: dto.lat, longitude: dto.lng } : null;

    /* « Autour de moi » exige la position du client ; sans texte ni position : rien à chercher */
    if (mode === 'nearby' && !me) return this.empty(mode);
    if (mode === 'search' && q.length < 2) return this.empty(mode);

    const tokens = q ? q.split(' ').filter(Boolean).slice(0, 5) : [];
    const collect = async (toks: string[]) => {
      const [vendors, deliveries, corrs] = await Promise.all([
        types.has('vendor')        ? this.vendors(toks)    : [],
        types.has('delivery')      ? this.deliveries(toks) : [],
        types.has('correspondent') ? this.correspondents(toks) : [],
      ]);
      return [...vendors, ...deliveries, ...corrs];
    };

    let all: (MapActor & { score: number })[] = (await collect(tokens)).map(a => this.withScore(a, q, false));
    if (mode === 'search') all = all.filter(a => a.score > 0);

    /* Peu (ou pas) de résultats : on retente en tolérant les fautes de frappe. Le second passage
     * relit les candidats sans filtre SQL puis classe en mémoire (volume borné par CANDIDATES_CAP). */
    if (mode === 'search' && all.length < 3) {
      const wide = (await collect([])).map(a => this.withScore(a, q, true)).filter(a => a.score > 0);
      const seen = new Set(all.map(a => `${a.role}:${a.id}`));
      all = [...all, ...wide.filter(a => !seen.has(`${a.role}:${a.id}`))];
    }

    /* Distance au client */
    for (const a of all) {
      a.distanceKm = me ? this.geo.distanceKm(me, { latitude: a.lat, longitude: a.lng }) : null;
    }

    if (mode === 'nearby') {
      const radius = dto.radiusKm ?? DEFAULT_RADIUS;
      all = all.filter(a => a.distanceKm != null && a.distanceKm <= radius);
    }

    all.sort((a, b) =>
      (b.score - a.score)
      || ((a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      || a.name.localeCompare(b.name, 'fr'));

    const total   = all.length;
    const results = all.slice(0, limit).map(({ score: _score, ...a }) => a);

    const byRole: Record<MapActorRole, number> = { vendor: 0, delivery: 0, correspondent: 0 };
    for (const a of results) byRole[a.role]++;

    return {
      results,
      meta: {
        mode, total, byRole,
        approx:    results.filter(a => a.approx).length,
        truncated: total > results.length,
      },
    };
  }

  private empty(mode: 'search' | 'nearby'): MapSearchResponse {
    return { results: [], meta: { mode, total: 0, approx: 0, truncated: false, byRole: { vendor: 0, delivery: 0, correspondent: 0 } } };
  }

  /* ── Score de pertinence (0 = ne correspond pas) ───────────── */
  private withScore(a: MapActor, q: string, fuzzy: boolean): MapActor & { score: number } {
    if (!q) return { ...a, score: 1 };       // mode « autour de moi »

    const name = fold(a.name);
    let score = 0;
    if (name === q)                                          score = 100;
    else if (name.startsWith(q))                             score = 85;
    else if (name.split(' ').some(w => w.startsWith(q)))     score = 75;
    else if (name.includes(q))                               score = 60;
    else if (fold(a.quartier).includes(q))                   score = 50;
    else if (fold(a.ville).includes(q))                      score = 40;
    else if (fold(a.address).includes(q))                    score = 30;
    else {
      /* Plusieurs mots (« restaurant kindia ») : tous présents quelque part */
      const hay = fold(`${a.name} ${a.quartier ?? ''} ${a.ville ?? ''} ${a.address ?? ''}`);
      if (q.split(' ').every(t => hay.includes(t)))          score = 45;
    }

    /* Faute de frappe : chaque mot cherché ressemble à un mot du nom ou du lieu */
    if (score === 0 && fuzzy) {
      const words = fold(`${a.name} ${a.quartier ?? ''} ${a.ville ?? ''}`).split(' ').filter(Boolean);
      if (q.split(' ').every(t => words.some(w => w.includes(t) || fuzzyMatches(t, w)))) score = 25;
    }

    /* Léger avantage aux mieux notés à pertinence égale */
    return { ...a, score: score > 0 ? score + Math.min(a.rating, 5) / 10 : 0 };
  }

  /* ── Position finale : exacte si GPS, sinon approximative (+ écart déterministe) ── */
  private place(
    id: string,
    exact: { lat: number | null; lng: number | null },
    where: { ville: string | null; commune: string | null; quartier: string | null },
  ): { lat: number; lng: number; approx: boolean; precision: MapActor['precision'] } | null {
    if (exact.lat != null && exact.lng != null && Number.isFinite(exact.lat) && Number.isFinite(exact.lng)
        && !(exact.lat === 0 && exact.lng === 0)) {
      return { lat: exact.lat, lng: exact.lng, approx: false, precision: 'exact' };
    }
    const p = this.geocoding.resolveNow(where);
    if (!p) return null;

    /* Plusieurs acteurs d'un même quartier/ville partagent le même point : on les écarte un peu,
     * de façon stable (même id → même décalage), pour qu'ils restent tous visibles. */
    const spread = p.precision === 'ville' ? 0.012 : p.precision === 'commune' ? 0.004 : 0.0015;
    const h = hash32(id);
    const angle = (h % 360) * Math.PI / 180;
    const dist  = (((h >>> 9) % 100) + 20) / 120 * spread;
    return {
      lat: p.lat + Math.sin(angle) * dist,
      lng: p.lng + Math.cos(angle) * dist,
      approx: true,
      precision: p.precision,
    };
  }

  /* ── Entreprises ─────────────────────────────────────────── */
  private async vendors(tokens: string[]): Promise<MapActor[]> {
    const qb = this.companyRepo.createQueryBuilder('co')
      .select(['co.id', 'co.companyName', 'co.logo', 'co.ville', 'co.commune', 'co.quartier', 'co.adresse',
               'co.latitude', 'co.longitude', 'co.averageRating'])
      .where('co.status = :st', { st: 'active' });
    applyTokens(qb, ['co.companyName', 'co.quartier', 'co.commune', 'co.ville', 'co.adresse'], tokens);
    const rows = await qb.take(CANDIDATES_CAP).getMany();

    return rows.flatMap(c => {
      const loc = actorLocation({ ville: c.ville, commune: c.commune, quartier: c.quartier });
      const pos = this.place(c.id,
        { lat: c.latitude != null ? Number(c.latitude) : null, lng: c.longitude != null ? Number(c.longitude) : null },
        { ville: c.ville, commune: c.commune, quartier: c.quartier });
      if (!pos) return [];
      return [{
        id: c.id, role: 'vendor' as const, name: c.companyName ?? 'Boutique',
        lat: pos.lat, lng: pos.lng, approx: pos.approx, precision: pos.precision,
        ville: loc.ville, quartier: loc.quartier, localisation: loc.localisation, address: c.adresse ?? null,
        image: c.logo ?? null, rating: Number(c.averageRating) || 0, available: null, distanceKm: null,
        profilePath: `/boutique/${c.id}`,
      }];
    });
  }

  /* ── Livreurs ────────────────────────────────────────────── */
  private async deliveries(tokens: string[]): Promise<MapActor[]> {
    const qb = this.deliveryRepo.createQueryBuilder('d')
      .innerJoin('d.user', 'u')
      .select(['d.id', 'd.fullName', 'd.photoUrl', 'd.ville', 'd.commune', 'd.quartier', 'd.zone',
               'd.lastLatitude', 'd.lastLongitude', 'd.averageRating', 'd.availability'])
      .where('u.status = :ust', { ust: UserStatus.ACTIVE })
      .andWhere('d.status = :st', { st: 'active' });
    applyTokens(qb, ['d.fullName', 'd.quartier', 'd.commune', 'd.ville', 'd.zone'], tokens);
    const rows = await qb.take(CANDIDATES_CAP).getMany();

    return rows.flatMap(d => {
      const loc = actorLocation({ ville: d.ville, commune: d.commune, quartier: d.quartier });
      const pos = this.place(d.id,
        { lat: d.lastLatitude != null ? Number(d.lastLatitude) : null, lng: d.lastLongitude != null ? Number(d.lastLongitude) : null },
        { ville: d.ville, commune: d.commune ?? d.zone, quartier: d.quartier });
      if (!pos) return [];
      return [{
        id: d.id, role: 'delivery' as const, name: d.fullName ?? 'Livreur',
        lat: pos.lat, lng: pos.lng, approx: pos.approx, precision: pos.precision,
        ville: loc.ville, quartier: loc.quartier, localisation: loc.localisation ?? d.zone ?? null, address: null,
        image: d.photoUrl ?? null, rating: Number(d.averageRating) || 0,
        available: d.availability === DeliveryAvailability.AVAILABLE, distanceKm: null,
        profilePath: `/livreurs/${d.id}`,
      }];
    });
  }

  /* ── Correspondants ──────────────────────────────────────── */
  private async correspondents(tokens: string[]): Promise<MapActor[]> {
    const qb = this.corrRepo.createQueryBuilder('c')
      .innerJoin('c.user', 'u')
      .addSelect(['u.id', 'u.profilePicture'])
      .where('u.status = :ust', { ust: UserStatus.ACTIVE })
      .andWhere('c.status = :st', { st: 'active' });
    applyTokens(qb, ['c.fullName', 'c.depotQuartier', 'c.depotCommune', 'c.depotVille', 'c.depotAdresse'], tokens);
    const rows = await qb.take(CANDIDATES_CAP).getMany();

    return rows.flatMap(c => {
      const loc = actorLocation({ ville: c.depotVille, commune: c.depotCommune, quartier: c.depotQuartier });
      const pos = this.place(c.id,
        { lat: c.depotLatitude != null ? Number(c.depotLatitude) : null, lng: c.depotLongitude != null ? Number(c.depotLongitude) : null },
        { ville: c.depotVille, commune: c.depotCommune, quartier: c.depotQuartier });
      if (!pos) return [];
      return [{
        id: c.id, role: 'correspondent' as const, name: c.fullName ?? 'Correspondant',
        lat: pos.lat, lng: pos.lng, approx: pos.approx, precision: pos.precision,
        ville: loc.ville, quartier: loc.quartier, localisation: loc.localisation, address: c.depotAdresse ?? null,
        image: (c as any).user?.profilePicture ?? null, rating: Number(c.averageRating) || 0, available: null, distanceKm: null,
        profilePath: `/profil/correspondant/${c.id}`,
      }];
    });
  }
}
