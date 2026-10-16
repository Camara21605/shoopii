/* ============================================================
 * FICHIER : src/modules/geo/geo-locate.util.ts
 *
 * Retrouver, dans le référentiel du super admin, le pays / la ville /
 * la commune / le quartier d'une position GPS. Logique pure, testée seule.
 *
 *   1. Coordonnées : le quartier le plus proche (≤ 2,5 km), sinon la
 *      commune (≤ 8 km), sinon la ville (≤ 40 km) — les niveaux au-dessus
 *      se déduisent par les liens parent.
 *   2. À défaut (lieux encore sans coordonnées), par le NOM : les indices
 *      donnés par le téléphone (quartier, commune, ville lus par Android)
 *      comparés sans accents ni majuscules.
 *   3. Une ville trouvée sans quartier : on tente encore le quartier par
 *      son nom, parmi les quartiers de CETTE commune / ville seulement.
 * ============================================================ */

export type GeoLevel = 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier';

export interface GeoNode {
  id: string;
  nom: string;
  code: string;
  parentId: string | null;
  latitude: number | null;
  longitude: number | null;
  level: GeoLevel;
}

export interface GeoLocateResult {
  pays:      Pick<GeoNode, 'id' | 'nom' | 'code'> | null;
  ville:     Pick<GeoNode, 'id' | 'nom' | 'code'> | null;
  commune:   Pick<GeoNode, 'id' | 'nom' | 'code'> | null;
  quartier:  Pick<GeoNode, 'id' | 'nom' | 'code'> | null;
  /** Niveau le plus fin trouvé. */
  precision: 'quartier' | 'commune' | 'ville' | null;
  /** Distance au centre du lieu trouvé (null si trouvé par le nom). */
  distanceM: number | null;
  source:    'coords' | 'nom' | null;
}

export const RADIUS_M = { quartier: 2_500, commune: 8_000, prefecture: 40_000 } as const;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** « Kaloum », « KALOUM », « Kâloum » → « kaloum » ; tirets/apostrophes → espaces. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(commune|quartier|prefecture|ville) (de |du |d )?/, '');
}

function nearest(nodes: GeoNode[], lat: number, lng: number, maxM: number): { node: GeoNode; dist: number } | null {
  let best: { node: GeoNode; dist: number } | null = null;
  for (const n of nodes) {
    if (n.latitude == null || n.longitude == null) continue;
    const dist = haversineM(lat, lng, n.latitude, n.longitude);
    if (dist <= maxM && (!best || dist < best.dist)) best = { node: n, dist };
  }
  return best;
}

function byName(nodes: GeoNode[], hints: string[]): GeoNode | null {
  const wanted = new Set(hints.map(normalizeName).filter(h => h.length >= 2));
  if (!wanted.size) return null;
  return nodes.find(n => wanted.has(normalizeName(n.nom))) ?? null;
}

const pick = (n: GeoNode | null | undefined) => (n ? { id: n.id, nom: n.nom, code: n.code } : null);

export function locateInReferential(
  all: GeoNode[],
  lat: number | null,
  lng: number | null,
  hints: string[] = [],
): GeoLocateResult {
  const byId = new Map(all.map(n => [n.id, n]));
  const of = (level: GeoLevel) => all.filter(n => n.level === level);
  const quartiers = of('quartier');
  const communes = of('commune');
  const prefectures = of('prefecture');

  let quartier: GeoNode | null = null;
  let commune: GeoNode | null = null;
  let ville: GeoNode | null = null;
  let distanceM: number | null = null;
  let source: GeoLocateResult['source'] = null;

  if (lat != null && lng != null) {
    const q = nearest(quartiers, lat, lng, RADIUS_M.quartier);
    const c = q ? null : nearest(communes, lat, lng, RADIUS_M.commune);
    const p = q || c ? null : nearest(prefectures, lat, lng, RADIUS_M.prefecture);
    const hit = q ?? c ?? p;
    if (hit) {
      source = 'coords';
      distanceM = Math.round(hit.dist);
      if (q) quartier = q.node;
      if (c) commune = c.node;
      if (p) ville = p.node;
    }
  }

  if (!source && hints.length) {
    quartier = byName(quartiers, hints);
    commune = quartier ? null : byName(communes, hints);
    ville = quartier || commune ? null : byName(prefectures, hints);
    if (quartier || commune || ville) source = 'nom';
  }

  /* Niveaux au-dessus par les liens parent. */
  if (quartier && !commune) commune = (quartier.parentId && byId.get(quartier.parentId)) || null;
  if (commune && !ville) ville = (commune.parentId && byId.get(commune.parentId)) || null;

  /* Quartier par le nom, mais seulement DANS la commune / ville trouvée (jamais un homonyme ailleurs). */
  if (!quartier && hints.length && (commune || ville)) {
    const communeIds = commune
      ? new Set([commune.id])
      : new Set(communes.filter(c => c.parentId === ville!.id).map(c => c.id));
    const q = byName(quartiers.filter(x => x.parentId && communeIds.has(x.parentId)), hints);
    if (q) { quartier = q; commune = commune ?? byId.get(q.parentId!) ?? null; }
  }

  let region = ville?.parentId ? byId.get(ville.parentId) : undefined;
  let pays = region?.parentId ? byId.get(region.parentId) : undefined;
  /* Référentiel sans niveau région : la ville pointe directement sur le pays. */
  if (region?.level === 'pays') { pays = region; region = undefined; }

  return {
    pays: pick(pays),
    ville: pick(ville),
    commune: pick(commune),
    quartier: pick(quartier),
    precision: quartier ? 'quartier' : commune ? 'commune' : ville ? 'ville' : null,
    distanceM,
    source,
  };
}
