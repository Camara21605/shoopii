/* ============================================================
 * FICHIER : src/shared/location/utils/nominatim.ts
 * RÔLE    : Client Nominatim (OpenStreetMap) pour le geocoding
 *           inverse et la recherche d'adresses.
 *           Entièrement gratuit, aucune clé API requise.
 *           Respecte la politique d'utilisation Nominatim :
 *           - Max 1 requête/seconde
 *           - User-Agent obligatoire
 * ============================================================ */

import type { NominatimResult } from '../types/location.types';

const BASE_URL  = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Shopi/1.0 (contact@shopi.com)';
const LANG       = 'fr';

/** Cache simple en mémoire pour éviter les requêtes redondantes */
const cache = new Map<string, NominatimResult | NominatimResult[]>();

/** Throttle : timestamp de la dernière requête */
let lastRequestTs = 0;
async function throttle(): Promise<void> {
  const now   = Date.now();
  const delta = now - lastRequestTs;
  if (delta < 1_100) await new Promise(r => setTimeout(r, 1_100 - delta));
  lastRequestTs = Date.now();
}

/* ── Geocoding inverse : coordonnées → adresse ──────────────── */

/**
 * Convertit des coordonnées GPS en adresse lisible.
 * @param lat  Latitude
 * @param lng  Longitude
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<NominatimResult | null> {
  const key = `rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key) as NominatimResult;

  try {
    await throttle();
    const res = await fetch(
      `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=${LANG}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = parseNominatimItem(data);
    if (result) cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

/* ── Recherche par texte : adresse → coordonnées ─────────────── */

/**
 * Recherche des adresses à partir d'un texte.
 * @param query  Texte de recherche
 * @param limit  Nombre maximum de résultats (défaut : 5)
 */
export async function searchAddress(
  query: string,
  limit = 5,
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const key = `search:${query.toLowerCase()}:${limit}`;
  if (cache.has(key)) return cache.get(key) as NominatimResult[];

  try {
    await throttle();
    const params = new URLSearchParams({
      q:                   query,
      format:              'jsonv2',
      limit:               String(limit),
      'accept-language':   LANG,
      addressdetails:      '1',
      countrycodes:        'gn',   // priorité Guinée
    });
    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];
    const items: unknown[] = await res.json();
    const results = (items as any[]).map(parseNominatimItem).filter(Boolean) as NominatimResult[];
    cache.set(key, results);
    return results;
  } catch {
    return [];
  }
}

/* ── Parsing ─────────────────────────────────────────────────── */

function parseNominatimItem(item: any): NominatimResult | null {
  if (!item?.lat || !item?.lon) return null;
  const a = item.address ?? {};
  return {
    displayName: item.display_name ?? '',
    adresse:     [a.road, a.house_number].filter(Boolean).join(' ') || undefined,
    quartier:    a.suburb         || a.neighbourhood || undefined,
    commune:     a.city_district  || a.town          || a.municipality || undefined,
    ville:       a.city           || a.town          || a.village      || undefined,
    region:      a.state          || a.region        || undefined,
    pays:        a.country        || undefined,
    codePostal:  a.postcode       || undefined,
    latitude:    parseFloat(item.lat),
    longitude:   parseFloat(item.lon),
  };
}

/** Vide le cache (utile en test) */
export function clearCache(): void {
  cache.clear();
}
