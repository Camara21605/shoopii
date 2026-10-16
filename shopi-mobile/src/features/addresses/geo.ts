/**
 * Référentiel géographique du super admin (pays → villes → communes →
 * quartiers) pour le formulaire d'adresse, et « Remplir avec ma position » :
 *   GET /geo/items?niveau=pays                 pays actifs
 *   GET /geo/villes?paysId=…                   villes (préfectures) du pays
 *   GET /geo/items?niveau=commune&parentId=…   communes d'une ville
 *   GET /geo/items?niveau=quartier&parentId=…  quartiers d'une commune
 *   GET /geo/locate?lat=&lng=&hints=a|b|c      lieu du référentiel d'une position GPS
 *
 * Le référentiel garde les noms en MAJUSCULES : on les affiche (et on les
 * enregistre) en casse normale — « KIPÉ » → « Kipé ».
 */
import * as Location from 'expo-location';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const coord = z.preprocess((v) => (v === null || v === undefined || v === '' ? null : Number(v)), z.number().finite().nullable().catch(null));

const itemSchema = z
  .object({ id: z.string(), nom: z.string(), code: z.string().nullable().optional(), latitude: coord.optional(), longitude: coord.optional() })
  .passthrough();
export type GeoRefItem = z.infer<typeof itemSchema>;

export const fetchPays = () => apiFetch('/geo/items', { auth: false, query: { niveau: 'pays' }, schema: z.array(itemSchema) });

export const fetchVillesOfPays = (paysId: string) =>
  apiFetch('/geo/villes', { auth: false, query: { paysId }, schema: z.array(itemSchema) });

export const fetchChildren = (niveau: 'commune' | 'quartier', parentId: string) =>
  apiFetch('/geo/items', { auth: false, query: { niveau, parentId }, schema: z.array(itemSchema) });

const refSchema = z.object({ id: z.string(), nom: z.string(), code: z.string().nullable().optional() }).nullable().catch(null);
const locateSchema = z.object({
  pays: refSchema,
  ville: refSchema,
  commune: refSchema,
  quartier: refSchema,
  precision: z.enum(['quartier', 'commune', 'ville']).nullable().catch(null),
  distanceM: z.number().nullable().catch(null),
  source: z.enum(['coords', 'nom']).nullable().catch(null),
});
export type GeoLocateResult = z.infer<typeof locateSchema>;

export const locateInReferential = (lat: number, lng: number, hints: string[]) =>
  apiFetch('/geo/locate', {
    auth: false,
    query: { lat: String(lat), lng: String(lng), hints: hints.length ? hints.join('|') : undefined },
    schema: locateSchema,
  });

/* ── Noms ──────────────────────────────────────────────────────────── */

/** Comparaison sans accents, casse ni ponctuation (« N'ZÉRÉKORÉ » = « nzerekore »). */
export const sameName = (a?: string | null, b?: string | null) => !!a && !!b && norm(a) === norm(b);
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'sur']);

/** « KIPÉ » → « Kipé », « N'ZÉRÉKORÉ » → « N'Zérékoré », « BAMBETO-CITÉ » → « Bambeto-Cité ». Laisse intacts les noms déjà en casse normale. */
export function prettyGeoName(raw?: string | null): string {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s || s !== s.toLocaleUpperCase('fr-FR')) return s;
  return s
    .toLocaleLowerCase('fr-FR')
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL.has(word)
        ? word
        : word.replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR')),
    )
    .join(' ');
}

/* ── Position du téléphone ─────────────────────────────────────────── */

export type GpsFix = { lat: number; lng: number; accuracyM: number | null; street: string | null; hints: string[] };

export class GpsError extends Error {
  constructor(
    readonly reason: 'permission' | 'disabled' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

const round6 = (n: number) => Number(n.toFixed(6));

/**
 * Position précise du téléphone + ce qu'Android sait du lieu (rue, quartier,
 * ville) pour aider le serveur quand le référentiel n'a pas encore de
 * coordonnées. Lève GpsError avec un message prêt à afficher.
 */
export async function readGpsFix(): Promise<GpsFix> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new GpsError('permission', 'Autorisez la localisation pour remplir l’adresse avec votre position.');
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
    throw new GpsError('disabled', 'Activez la localisation (GPS) du téléphone, puis réessayez.');
  }

  let pos: Location.LocationObject | null = null;
  try {
    pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15_000);
  } catch {
    /* intérieur, signal faible : la dernière position connue récente fait l'affaire */
    pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 }).catch(() => null);
  }
  if (!pos) throw new GpsError('unavailable', 'Position introuvable. Réessayez près d’une fenêtre ou à l’extérieur.');

  const lat = round6(pos.coords.latitude);
  const lng = round6(pos.coords.longitude);

  let street: string | null = null;
  const hints: string[] = [];
  try {
    const [g] = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }), 6_000);
    if (g) {
      for (const h of [g.district, g.subregion, g.city, g.region]) {
        const t = h?.trim();
        if (t && !hints.some((x) => sameName(x, t))) hints.push(t);
      }
      const parts = [g.streetNumber, g.street].filter(Boolean).join(' ').trim();
      street = parts || (g.name && !/^\d+$/.test(g.name) && !hints.some((x) => sameName(x, g.name)) ? g.name : null);
    }
  } catch {
    /* pas de géocodage (hors ligne, service Google absent) : les coordonnées suffisent */
  }

  return { lat, lng, accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null, street, hints };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
