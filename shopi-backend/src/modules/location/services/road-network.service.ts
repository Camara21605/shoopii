/* ============================================================
 * FICHIER : src/modules/location/services/road-network.service.ts
 *
 * RÔLE : réseau de chemins d'une zone de la carte — routes carrossables
 * (autoroutes → ruelles, pistes) ET chemins piétons (sentiers, trottoirs,
 * escaliers, voies piétonnes) — issus d'OpenStreetMap (© contributeurs
 * OpenStreetMap, ODbL) via l'API Overpass.
 *
 * Découpage en tuiles z14 (≈ 2,4 km de côté) :
 *   - une tuile = une requête Overpass, mise en cache (7 jours, 500 tuiles) ;
 *   - requêtes identiques simultanées fusionnées ;
 *   - au plus 2 requêtes Overpass en parallèle (politesse envers le service
 *     public), avec repli sur un second serveur ;
 *   - tuile hors de Guinée refusée.
 * Réponse compacte : chaque voie = [id, classe, [lat, lng, lat, lng, …]].
 * Classes : m (autoroute/nationale) p (primaire) s (secondaire) t (tertiaire)
 *   r (rue/ruelle) k (piste) f (chemin piéton) e (escalier)
 * ============================================================ */

import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GUINEA_BBOX } from '../data/guinea-gazetteer';

export type RoadClass = 'm' | 'p' | 's' | 't' | 'r' | 'k' | 'f' | 'e';
export type RoadWay   = [id: number, cls: RoadClass, coords: number[]];

export interface RoadTile { z: 14; x: number; y: number; ways: RoadWay[] }

const Z          = 14;
const TTL_MS     = 7 * 24 * 3_600_000;
const MAX_TILES  = 500;
const MAX_PARALLEL = 2;
const TIMEOUT_MS = 25_000;
const ENDPOINTS  = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const CLASS_OF: Record<string, RoadClass> = {
  motorway: 'm', motorway_link: 'm', trunk: 'm', trunk_link: 'm',
  primary: 'p', primary_link: 'p',
  secondary: 's', secondary_link: 's',
  tertiary: 't', tertiary_link: 't',
  unclassified: 'r', residential: 'r', living_street: 'r', service: 'r', road: 'r',
  track: 'k',
  footway: 'f', path: 'f', pedestrian: 'f', cycleway: 'f', bridleway: 'f', corridor: 'f',
  steps: 'e',
};

const tileLng = (x: number) => (x / 2 ** Z) * 360 - 180;
const tileLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

@Injectable()
export class RoadNetworkService {
  private readonly logger   = new Logger(RoadNetworkService.name);
  private readonly cache    = new Map<string, { at: number; tile: RoadTile }>();
  private readonly inflight = new Map<string, Promise<RoadTile>>();
  private readonly waiting: (() => void)[] = [];
  private active = 0;

  async tile(x: number, y: number): Promise<RoadTile> {
    const n = 2 ** Z;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) throw new BadRequestException('Tuile invalide.');

    const south = tileLat(y + 1), north = tileLat(y), west = tileLng(x), east = tileLng(x + 1);
    if (north < GUINEA_BBOX.latMin || south > GUINEA_BBOX.latMax || east < GUINEA_BBOX.lngMin || west > GUINEA_BBOX.lngMax) {
      throw new BadRequestException('Zone hors de la Guinée.');
    }

    const key = `${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.tile;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const job = this.limited(() => this.fetchTile(x, y, south, west, north, east))
      .then(tile => {
        if (this.cache.size >= MAX_TILES) { const k = this.cache.keys().next().value; if (k !== undefined) this.cache.delete(k); }
        this.cache.set(key, { at: Date.now(), tile });
        return tile;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  /** File d'attente : au plus MAX_PARALLEL requêtes Overpass simultanées. */
  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= MAX_PARALLEL) await new Promise<void>(r => this.waiting.push(r));
    this.active++;
    try { return await fn(); }
    finally { this.active--; this.waiting.shift()?.(); }
  }

  private async fetchTile(x: number, y: number, s: number, w: number, n: number, e: number): Promise<RoadTile> {
    const ql = `[out:json][timeout:20];way["highway"](${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)});out geom qt;`;
    let lastErr = '';

    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method:  'POST',
          headers: { 'User-Agent': 'Shoneya/1.0 (marketplace; road network)', 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(ql)}`,
          signal:  AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
        const json = await res.json() as { elements?: { id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[] };

        const ways: RoadWay[] = [];
        for (const el of json.elements ?? []) {
          const hw  = el.tags?.highway;
          const cls = hw ? CLASS_OF[hw] : undefined;
          if (!cls || !el.geometry || el.geometry.length < 2) continue;
          /* Accès interdit au public non représenté : on garde tout ce qui est cartographié */
          const coords: number[] = [];
          for (const p of el.geometry) coords.push(Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5);
          ways.push([el.id, cls, coords]);
        }
        return { z: Z, x, y, ways };
      } catch (err) {
        lastErr = (err as Error).message;
      }
    }
    this.logger.warn(`Overpass indisponible pour la tuile ${x}/${y} : ${lastErr}`);
    throw new ServiceUnavailableException('Le réseau de chemins est momentanément indisponible.');
  }
}
