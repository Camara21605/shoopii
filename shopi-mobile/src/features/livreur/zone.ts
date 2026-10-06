/**
 * « Ma zone de livraison » — données de la page (ZonePage.tsx du site) :
 *   · zones actives + type de livraison (fiche livreur, même cache que les Paramètres) ;
 *   · zones « disponibles » : PATCH /dashboard/livreur/parametres/zones-dispo
 *     { zonesDisponibles } — null = jamais choisi → toutes disponibles ;
 *   · coordonnées des zones : dictionnaire du site (GUINEA_ZONE_COORDS),
 *     complété par celles saisies en base (GET /geo/items?niveau=…) ;
 *   · mission à afficher sur la carte (bouton « Voir sur la carte ») : boutique
 *     (position réelle) et client (adresse GPS par défaut, sinon centre
 *     approximatif de sa commune).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export const setZonesDisponibles = (zonesDisponibles: string[]) => apiFetch('/dashboard/livreur/parametres/zones-dispo', { method: 'PATCH', body: { zonesDisponibles } });

const geoCoordsSchema = z
  .array(z.object({ nom: z.string().catch(''), latitude: z.coerce.number().nullable().catch(null), longitude: z.coerce.number().nullable().catch(null) }).passthrough())
  .catch([]);
export const fetchGeoCoords = (niveau: string) => apiFetch('/geo/items', { query: { niveau }, schema: geoCoordsSchema });

/** Coordonnées des zones guinéennes — copie de GUINEA_ZONE_COORDS (parametresData.ts du site). */
export const GUINEA_ZONE_COORDS: Record<string, [number, number]> = {
  Kaloum: [9.537, -13.6773],
  Dixinn: [9.5504, -13.6274],
  Matam: [9.5726, -13.6547],
  Ratoma: [9.613, -13.631],
  Matoto: [9.5939, -13.5896],
  Conakry: [9.537, -13.6773],
  Coyah: [9.7124, -13.3715],
  Dubreka: [9.7905, -13.5215],
  Forécariah: [9.432, -13.0935],
  Kindia: [10.0549, -12.8663],
  Télimélé: [10.9038, -13.0332],
  Mamou: [10.3764, -12.0972],
  Dalaba: [10.6918, -12.2487],
  Pita: [11.0667, -12.3924],
  Labé: [11.32, -12.29],
  Lélouma: [11.35, -12.55],
  Tougué: [11.45, -11.67],
  Mali: [12.08, -12.29],
  Kankan: [10.38, -9.303],
  Kouroussa: [10.65, -9.883],
  Mandiana: [10.617, -8.7],
  Siguiri: [11.417, -9.167],
  Kissidougou: [9.1864, -10.1094],
  Guékédou: [8.5667, -10.1333],
  Faranah: [10.0374, -10.7474],
  Dabola: [10.75, -11.1167],
  Dinguiraye: [11.3, -10.7167],
  Nzérékoré: [7.749, -8.819],
  Lola: [7.8, -8.5333],
  Macenta: [8.543, -9.4681],
  Yomou: [7.5666, -9.2569],
  Beyla: [8.6896, -8.6451],
  Boké: [10.9358, -14.296],
  Fria: [10.37, -13.57],
  Gaoual: [11.75, -13.2],
  Koundara: [12.4835, -13.3028],
  Boffa: [10.182, -14.0384],
  'Boké (Région)': [10.9358, -14.296],
  'Kindia (Région)': [10.0549, -12.8663],
  'Mamou (Région)': [10.3764, -12.0972],
  'Labé (Région)': [11.32, -12.29],
  'Kankan (Région)': [10.38, -9.303],
  'Faranah (Région)': [10.0374, -10.7474],
  'Nzérékoré (Région)': [7.749, -8.819],
  'Conakry (Région)': [9.537, -13.6773],
};

/** Commune de livraison → coordonnées approximatives (même règle que resolveClientCoords du site). */
export function approxCoords(commune: string | null | undefined): [number, number] | null {
  if (!commune) return null;
  if (GUINEA_ZONE_COORDS[commune]) return GUINEA_ZONE_COORDS[commune];
  const key = Object.keys(GUINEA_ZONE_COORDS).find((k) => commune.toLowerCase().startsWith(k.toLowerCase()));
  return key ? GUINEA_ZONE_COORDS[key] : null;
}

/** La zone correspond-elle au lieu de livraison d'une mission ? (nom sans accents, inclus dans la commune / ville) */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export function missionInZone(zone: string, m: { clientCommune?: string | null; clientVille?: string | null; to?: string | null }) {
  const z = fold(zone);
  if (!z) return false;
  return [m.clientCommune, m.clientVille, m.to].some((v) => !!v && (fold(v) === z || fold(v).startsWith(`${z} `) || fold(v).includes(z)));
}
