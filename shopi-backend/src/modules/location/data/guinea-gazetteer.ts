/* ============================================================
 * FICHIER : src/modules/location/data/guinea-gazetteer.ts
 *
 * RÔLE : centres des principales villes / préfectures de Guinée.
 * Sert de REPLI instantané pour situer sur la carte un acteur qui n'a
 * jamais partagé de position GPS mais dont la ville est connue (voir
 * GeocodingService). Généré à partir du référentiel du frontend
 * (shared/location/data/geo-guinee.ts) — coordonnées approximatives du
 * centre-ville, pas d'une adresse.
 * ============================================================ */

export interface GazetteerCity { nom: string; lat: number; lng: number; region: string }

export const GUINEA_CITIES: GazetteerCity[] = [
  { nom: 'Conakry', lat: 9.537, lng: -13.6773, region: 'Conakry' },
  { nom: 'Kindia', lat: 10.0544, lng: -12.8559, region: 'Kindia' },
  { nom: 'Labé', lat: 11.3167, lng: -12.2833, region: 'Labé' },
  { nom: 'Mamou', lat: 10.3833, lng: -12.0833, region: 'Mamou' },
  { nom: 'Boké', lat: 10.9333, lng: -14.2833, region: 'Boké' },
  { nom: 'Kankan', lat: 10.3878, lng: -9.2953, region: 'Kankan' },
  { nom: 'Faranah', lat: 10.0353, lng: -10.7422, region: 'Faranah' },
  { nom: "N'Zérékoré", lat: 7.7558, lng: -8.8179, region: "N'Zérékoré" },
  { nom: 'Kissidougou', lat: 9.1886, lng: -10.1013, region: 'Faranah' },
  { nom: 'Guéckédou', lat: 8.5586, lng: -10.1328, region: "N'Zérékoré" },
  { nom: 'Macenta', lat: 8.4667, lng: -9.4833, region: "N'Zérékoré" },
  { nom: 'Siguiri', lat: 11.4133, lng: -9.1667, region: 'Kankan' },
  { nom: 'Télimélé', lat: 10.9, lng: -13.0333, region: 'Kindia' },
  { nom: 'Pita', lat: 11.0667, lng: -12.3833, region: 'Labé' },
  { nom: 'Dalaba', lat: 10.6874, lng: -12.2498, region: 'Mamou' },
  { nom: 'Coyah', lat: 9.7003, lng: -13.3842, region: 'Kindia' },
  { nom: 'Fria', lat: 10.3698, lng: -13.5527, region: 'Boké' },
];

/** Cadre approximatif de la Guinée — écarte tout résultat de géocodage hors du pays. */
export const GUINEA_BBOX = { latMin: 7.1, latMax: 12.8, lngMin: -15.2, lngMax: -7.5 };
