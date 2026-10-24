/* ============================================================
 * FICHIER : src/modules/geo/conakry-communes.ts
 *
 * Les 13 communes de Conakry (redécoupage territorial — communales du
 * 31 mai 2026) : les 5 historiques + Sonfonia, Lambanyi, Gbessia, Tombolia,
 * Kassa, Manéah, Kagbélen, Sanoyah. Ajoutées au référentiel au démarrage du
 * serveur si elles y manquent (GeoService.ensureConakryCommunes) — jamais
 * de doublon, jamais de modification de ce que l'administrateur a saisi.
 * Coordonnées : centre approximatif de la commune (OpenStreetMap).
 * ============================================================ */

export interface BuiltinCommune { nom: string; code: string; lat: number; lng: number }

export const CONAKRY_COMMUNES: BuiltinCommune[] = [
  { nom: 'Kaloum',   code: 'GN-CKY-KALOUM',   lat: 9.51496, lng: -13.70844 },
  { nom: 'Dixinn',   code: 'GN-CKY-DIXINN',   lat: 9.54688, lng: -13.67331 },
  { nom: 'Matam',    code: 'GN-CKY-MATAM',    lat: 9.55206, lng: -13.64958 },
  { nom: 'Ratoma',   code: 'GN-CKY-RATOMA',   lat: 9.58917, lng: -13.65571 },
  { nom: 'Matoto',   code: 'GN-CKY-MATOTO',   lat: 9.60908, lng: -13.59375 },
  { nom: 'Sonfonia', code: 'GN-CKY-SONFONIA', lat: 9.66957, lng: -13.55861 },
  { nom: 'Lambanyi', code: 'GN-CKY-LAMBANYI', lat: 9.64455, lng: -13.61361 },
  { nom: 'Gbessia',  code: 'GN-CKY-GBESSIA',  lat: 9.56928, lng: -13.63397 },
  { nom: 'Tombolia', code: 'GN-CKY-TOMBOLIA', lat: 9.63500, lng: -13.57000 },
  { nom: 'Kassa',    code: 'GN-CKY-KASSA',    lat: 9.47681, lng: -13.74898 },
  { nom: 'Manéah',   code: 'GN-CKY-MANEAH',   lat: 9.74000, lng: -13.42000 },
  { nom: 'Kagbélen', code: 'GN-CKY-KAGBELEN', lat: 9.78000, lng: -13.53000 },
  { nom: 'Sanoyah',  code: 'GN-CKY-SANOYAH',  lat: 9.72280, lng: -13.48280 },
];

/** Comparaison de noms sans accents, casse ni espaces superflus (« Manéah » = « MANEAH »). */
export const foldGeo = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
