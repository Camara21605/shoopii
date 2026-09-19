/* ============================================================
 * FICHIER : src/modules/location/services/geocoding.service.ts
 *
 * RÔLE : situer sur la carte un acteur qui n'a PAS de position GPS
 * mais dont on connaît le quartier / la commune / la ville.
 *
 * Deux niveaux, pour que la recherche ne soit jamais bloquée :
 *   1. INSTANTANÉ — cache, sinon centre de la ville (guinea-gazetteer.ts).
 *      Renvoyé tout de suite, sans appel réseau.
 *   2. AFFINAGE en arrière-plan — géocodage OpenStreetMap (Nominatim) du
 *      quartier / de la commune, mis en cache. Les appels sont espacés
 *      (≥ 1,1 s : règle d'usage de Nominatim), sérialisés dans une file
 *      bornée, avec délai d'expiration ; un échec n'a aucune conséquence.
 *      La recherche suivante bénéficie du résultat précis.
 *
 * Précision renvoyée : 'quartier' | 'commune' | 'ville' — jamais présentée
 * comme une position exacte (l'appelant marque le point « approximatif »).
 *
 * Config (facultative) : NOMINATIM_URL, NOMINATIM_EMAIL, GEOCODING_ENABLED=false.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

import { GUINEA_CITIES, GUINEA_BBOX } from '../data/guinea-gazetteer';

export interface PlaceInput {
  ville?:    string | null;
  commune?:  string | null;
  quartier?: string | null;
}

export type ApproxPrecision = 'quartier' | 'commune' | 'ville';

export interface ApproxPosition {
  lat:       number;
  lng:       number;
  precision: ApproxPrecision;
}

interface CacheEntry {
  value:   ApproxPosition | null;
  at:      number;
  /** true = résultat Nominatim (ou échec définitif) ; false = simple repli sur la ville */
  refined: boolean;
}

const POSITIVE_TTL_MS = 30 * 24 * 3_600_000;   // 30 jours
const NEGATIVE_TTL_MS = 24 * 3_600_000;        // 1 jour (introuvable chez Nominatim)
const MAX_CACHE       = 3_000;
const MAX_QUEUE       = 60;
const MIN_GAP_MS      = 1_100;                 // 1 requête / seconde max vers Nominatim
const HTTP_TIMEOUT_MS = 4_000;

/** Minuscules, sans accents, ponctuation → espaces : « N'Zérékoré » → « n zerekore ». */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

@Injectable()
export class GeocodingService {

  private readonly logger  = new Logger(GeocodingService.name);
  private readonly cache   = new Map<string, CacheEntry>();
  private readonly queue: { key: string; place: PlaceInput }[] = [];
  private readonly queued  = new Set<string>();
  private readonly freeCache = new Map<string, { v: { lat: number; lng: number; label: string } | null; at: number }>();
  private running = false;
  private lastCallAt = 0;
  /** Chaîne d'attente commune : garantit ≥ 1,1 s entre deux appels Nominatim, quel que soit l'appelant. */
  private gate: Promise<void> = Promise.resolve();

  private readonly baseUrl: string;
  private readonly email:   string | null;
  private readonly enabled: boolean;

  private readonly cityIndex: Map<string, { lat: number; lng: number }>;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('NOMINATIM_URL') ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
    this.email   = config.get<string>('NOMINATIM_EMAIL') ?? null;
    this.enabled = config.get<string>('GEOCODING_ENABLED') !== 'false';

    this.cityIndex = new Map(GUINEA_CITIES.map(c => [fold(c.nom), { lat: c.lat, lng: c.lng }]));
  }

  /**
   * Position approximative IMMÉDIATE d'un lieu (jamais d'attente réseau).
   * Déclenche en arrière-plan l'affinage précis si le lieu n'est pas encore en cache.
   */
  resolveNow(place: PlaceInput): ApproxPosition | null {
    const key = this.keyOf(place);
    if (!key) return null;

    const hit = this.cache.get(key);
    if (hit && this.isFresh(hit)) {
      if (hit.value) return hit.value;
      /* Nominatim ne connaît pas ce lieu : repli ville */
      return this.cityFallback(place);
    }

    /* Pas (encore) de résultat précis : centre de la ville, et affinage à venir */
    this.scheduleRefine(key, place);
    return this.cityFallback(place);
  }

  /**
   * Position d'un lieu CHOISI par l'utilisateur (quartier, commune, ville) : on attend le
   * géocodage précis (au plus quelques secondes) pour zoomer au bon endroit ; repli sur le
   * centre de la ville. Une seule requête par choix : conforme à l'usage de Nominatim.
   */
  async resolveAwait(place: PlaceInput): Promise<ApproxPosition | null> {
    const key = this.keyOf(place);
    if (!key) return null;

    const hit = this.cache.get(key);
    if (hit && hit.refined && this.isFresh(hit)) return hit.value ?? this.cityFallback(place);

    if (this.enabled && (fold(place.quartier) || (fold(place.commune) && fold(place.commune) !== fold(place.ville)))) {
      const value = await this.geocode(place);
      this.store(key, { value, at: Date.now(), refined: true });
      if (value) return value;
    }
    return this.cityFallback(place);
  }

  /**
   * Recherche LIBRE d'un lieu (point de repère, rue, quartier absent du référentiel…) : une
   * requête Nominatim par demande explicite de l'utilisateur (jamais à la frappe), mise en cache.
   */
  async searchFree(text: string): Promise<{ lat: number; lng: number; label: string } | null> {
    const key = fold(text);
    if (key.length < 3 || !this.enabled) return null;

    const hit = this.freeCache.get(key);
    if (hit && Date.now() - hit.at < (hit.v ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS)) return hit.v;

    const r = await this.nominatimRaw(`${text.trim()}, Guinée`);
    const v = r ? { lat: r.lat, lng: r.lng, label: r.display.split(',').slice(0, 3).join(',').trim() } : null;
    if (this.freeCache.size >= 500) { const k = this.freeCache.keys().next().value; if (k !== undefined) this.freeCache.delete(k); }
    this.freeCache.set(key, { v, at: Date.now() });
    return v;
  }

  /** Centre de la ville connue (via la ville, sinon la commune qui porte souvent le même nom). */
  private cityFallback(p: PlaceInput): ApproxPosition | null {
    for (const name of [p.ville, p.commune]) {
      const c = this.cityIndex.get(fold(name));
      if (c) return { lat: c.lat, lng: c.lng, precision: 'ville' };
    }
    return null;
  }

  private keyOf(p: PlaceInput): string {
    const k = [fold(p.quartier), fold(p.commune), fold(p.ville)].join('|');
    return k === '||' ? '' : k;
  }

  private isFresh(e: CacheEntry): boolean {
    return Date.now() - e.at < (e.value ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);
  }

  /* ── File d'affinage (Nominatim) ─────────────────────────── */

  private scheduleRefine(key: string, place: PlaceInput): void {
    if (!this.enabled) return;
    /* Rien à affiner si on ne connaît ni quartier ni commune distincte de la ville */
    if (!fold(place.quartier) && (!fold(place.commune) || fold(place.commune) === fold(place.ville))) return;
    if (this.queued.has(key) || this.queue.length >= MAX_QUEUE) return;

    this.queued.add(key);
    this.queue.push({ key, place });
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        this.queued.delete(job.key);

        const value = await this.geocode(job.place);
        this.store(job.key, { value, at: Date.now(), refined: true });
      }
    } finally {
      this.running = false;
    }
  }

  private store(key: string, e: CacheEntry): void {
    if (this.cache.size >= MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, e);
  }

  /** Quartier + commune + ville, puis commune + ville si le quartier est inconnu. */
  private async geocode(p: PlaceInput): Promise<ApproxPosition | null> {
    const parts = {
      quartier: (p.quartier ?? '').trim(), commune: (p.commune ?? '').trim(), ville: (p.ville ?? '').trim(),
    };
    const attempts: { q: string; precision: ApproxPrecision }[] = [];
    if (parts.quartier) attempts.push({ q: [parts.quartier, parts.commune, parts.ville].filter(Boolean).join(', '), precision: 'quartier' });
    if (parts.commune && fold(parts.commune) !== fold(parts.ville)) attempts.push({ q: [parts.commune, parts.ville].filter(Boolean).join(', '), precision: 'commune' });

    for (const a of attempts) {
      const hit = await this.nominatim(`${a.q}, Guinée`);
      if (hit) return { ...hit, precision: a.precision };
    }
    return null;
  }

  private throttle(): Promise<void> {
    const turn = this.gate.then(async () => {
      const wait = this.lastCallAt + MIN_GAP_MS - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.lastCallAt = Date.now();
    });
    this.gate = turn.catch(() => undefined);
    return turn;
  }

  private async nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
    const r = await this.nominatimRaw(q);
    return r ? { lat: r.lat, lng: r.lng } : null;
  }

  private async nominatimRaw(q: string): Promise<{ lat: number; lng: number; display: string } | null> {
    await this.throttle();
    try {
      const url = `${this.baseUrl}/search?format=jsonv2&limit=1&countrycodes=gn&q=${encodeURIComponent(q)}`
        + (this.email ? `&email=${encodeURIComponent(this.email)}` : '');
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Shoneya/1.0 (marketplace; geocoding)', 'Accept-Language': 'fr' },
        signal:  AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const rows = await res.json() as { lat?: string; lon?: string; display_name?: string }[];
      const r = rows?.[0];
      const lat = Number(r?.lat), lng = Number(r?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      /* Garde-fou : un homonyme à l'étranger ne doit jamais placer un acteur hors de Guinée */
      if (lat < GUINEA_BBOX.latMin || lat > GUINEA_BBOX.latMax || lng < GUINEA_BBOX.lngMin || lng > GUINEA_BBOX.lngMax) return null;
      return { lat, lng, display: r?.display_name ?? q };
    } catch (err) {
      this.logger.debug(`Nominatim indisponible pour « ${q} » : ${(err as Error).message}`);
      return null;
    }
  }
}
