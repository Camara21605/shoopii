/**
 * Réseau du livreur (Correspondants, Livreurs) — mêmes routes que le site
 * (ReseauCorrespondantsPage / ReseauLivreursPage + profils publics) :
 *
 *   GET   /suivis/correspondants?search&online&type   liste + isSuivi
 *   GET   /suivis/livreurs?search&vehicule&disponibleOnly&sortBy&page&limit
 *                                                     { data, total } + isSuivi
 *   GET   /client/correspondants/:id                  profil complet (onglets, contacts)
 *   GET   /client/livreurs/:id                        profil complet (tarifs, horaires…)
 *   POST  /suivis/{livreurs|correspondants}/:id       suivre / ne plus suivre (bascule)
 *   PATCH /suivis/{livreurs|correspondants}/:id/masquer { hidden }
 *   POST  /location/map/distances                     distance depuis ma position
 *
 * Le serveur reconnaît le livreur comme abonné (followerType « delivery ») et
 * refuse qu'il se suive lui-même : sa propre carte affiche « Vous ».
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const str = z.string().nullable().optional().catch(null);
const num = z.coerce.number().catch(0);
const numOrNull = z.coerce.number().nullable().optional().catch(null);

export type NetworkKind = 'livreurs' | 'correspondants';

/* ── Listes ────────────────────────────────────────────────────────── */

const relayRowSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch(''),
    profilePicture: str,
    region: str,
    typeCorrespondant: str,
    totalMissions: num,
    averageRating: num,
    online: z.boolean().catch(false),
    isSuivi: z.boolean().catch(false),
    ville: str,
    commune: str,
    quartier: str,
    localisation: str,
  })
  .passthrough();
export type RelayRow = z.infer<typeof relayRowSchema>;

export type RelayFilter = 'all' | 'online' | 'followed';
export const fetchRelays = (search: string, filter: RelayFilter) =>
  apiFetch('/suivis/correspondants', {
    query: { search: search.trim() || undefined, online: filter === 'online' ? true : undefined },
    schema: z.array(relayRowSchema).catch([]),
  });

const driverRowSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch(''),
    profilePicture: str,
    zone: str,
    localisation: str,
    vehicule: str,
    vehiculeType: str,
    /* null = masqué par le livreur (Confidentialité) */
    totalLivraisons: numOrNull,
    averageRating: numOrNull,
    reviewsCount: numOrNull,
    disponible: z.boolean().catch(false),
    isSuivi: z.boolean().catch(false),
  })
  .passthrough();
export type DriverRow = z.infer<typeof driverRowSchema>;

export type DriverFilter = 'all' | 'available' | 'followed' | 'moto' | 'voiture';
export type DriverSort = 'note' | 'livraisons' | 'disponible';
export const DRIVER_PAGE = 12;
export async function fetchDrivers(search: string, filter: DriverFilter, sortBy: DriverSort, page: number) {
  const res = await apiFetch('/suivis/livreurs', {
    query: {
      search: search.trim() || undefined,
      vehicule: filter === 'moto' || filter === 'voiture' ? filter : undefined,
      disponibleOnly: filter === 'available' ? true : undefined,
      sortBy,
      page,
      limit: DRIVER_PAGE,
    },
    schema: z.object({ data: z.array(driverRowSchema).catch([]), total: num }).passthrough(),
  });
  return { data: res.data, total: res.total };
}

/* ── Suivi ─────────────────────────────────────────────────────────── */

export const toggleFollow = (kind: NetworkKind, id: string) => apiFetch(`/suivis/${kind}/${id}`, { method: 'POST', schema: z.object({ isSuivi: z.boolean() }).passthrough() });
export const setHidden = (kind: NetworkKind, id: string, hidden: boolean) =>
  apiFetch(`/suivis/${kind}/${id}/masquer`, { method: 'PATCH', body: { hidden }, schema: z.object({ hidden: z.boolean() }).passthrough() });

/* ── Profil d'un livreur ───────────────────────────────────────────── */

const driverProfileSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch(''),
    profilePicture: str,
    zone: z.string().catch(''),
    ville: str,
    commune: str,
    quartier: str,
    localisation: str,
    vehicule: z.string().catch(''),
    vehiculeType: z.string().catch('moto'),
    totalLivraisons: numOrNull,
    averageRating: numOrNull,
    reviewsCount: numOrNull,
    ponctualite: num,
    experience: z.string().catch('—'),
    disponible: z.boolean().catch(false),
    isSuivi: z.boolean().catch(false),
    bio: str,
    telephone: str,
    whatsapp: str,
    zones: z.array(z.string()).catch([]),
    tarifs: z.object({ base: num, parKm: num, supplementLourd: num, majorationNocturne: num }).catch({ base: 0, parKm: 0, supplementLourd: 0, majorationNocturne: 0 }),
    langues: z.array(z.string()).catch([]),
    horaires: z.record(z.string(), z.string()).catch({}),
    immatriculation: str,
    assurance: z.boolean().catch(false),
    permis: z.boolean().catch(false),
    createdAt: str,
    abonnesCount: num,
  })
  .passthrough();
export type DriverProfile = z.infer<typeof driverProfileSchema>;
export const fetchDriverProfile = (id: string) => apiFetch(`/client/livreurs/${id}`, { schema: driverProfileSchema });

/* ── Profil d'un correspondant ─────────────────────────────────────── */

const relayProfileSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch('Correspondant'),
    initiales: z.string().catch('CO'),
    type: z.string().catch('regional'),
    typeLabel: z.string().catch('Correspondant'),
    localisation: z.string().catch(''),
    enLigne: z.boolean().catch(false),
    membreDepuis: z.string().catch(''),
    abonnes: num,
    badges: z.array(z.object({ label: z.string(), type: z.string().catch('verif') })).catch([]),
    bio: z.array(z.string()).catch([]),
    /** true = le correspondant a masqué ses statistiques (Paramètres › Confidentialité) → « — », jamais un faux 0 */
    statsMasquees: z.boolean().catch(false),
    missions: num,
    missionsMois: num,
    note: num,
    nbAvis: num,
    fiabilite: num,
    experience: z.string().catch('—'),
    zonesCount: num,
    delaiMoyen: z.string().catch('—'),
    aboutTags: z.array(z.string()).catch([]),
    infosPratiques: z.array(z.object({ icone: z.string().catch(''), label: z.string().catch(''), valeur: z.string().catch(''), sub: z.string().catch('') })).catch([]),
    horaires: z
      .array(z.object({ jour: z.string().catch(''), heures: z.string().catch(''), statut: z.string().catch('closed'), statutLabel: z.string().catch(''), aujourdhui: z.boolean().catch(false) }))
      .catch([]),
    contacts: z.array(z.object({ icone: z.string().catch(''), label: z.string().catch(''), valeur: z.string().catch('') })).catch([]),
    suivi: z.boolean().catch(false),
  })
  .passthrough();
export type RelayProfile = z.infer<typeof relayProfileSchema>;
export const fetchRelayProfile = (id: string) => apiFetch(`/client/correspondants/${id}`, { schema: relayProfileSchema });

/* ── Distance depuis ma position ───────────────────────────────────── */

export type ActorRole = 'delivery' | 'correspondent';
const distanceSchema = z.object({
  distances: z.record(z.string(), z.object({ km: num, approx: z.boolean().catch(false) }).nullable()).catch({}),
});
export const fetchDistances = (from: { lat: number; lng: number }, actors: { role: ActorRole; id: string }[]) =>
  apiFetch('/location/map/distances', { method: 'POST', body: { lat: from.lat, lng: from.lng, actors }, schema: distanceSchema }).then((r) => r.distances);

/* ── Affichage ─────────────────────────────────────────────────────── */

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** « Quartier, Ville » réel — même règle que locationLabel du site (plus de ville inventée). */
export function placeOf(x: { quartier?: string | null; commune?: string | null; ville?: string | null; localisation?: string | null; zone?: string | null; region?: string | null }) {
  const q = (x.quartier || x.commune || '').trim();
  const v = (x.ville || '').trim();
  return [q, v].filter(Boolean).join(', ') || x.localisation || x.zone || x.region || '';
}

export const RELAY_TYPE: Record<string, string> = { regional: 'Régional', zonal: 'Zonal', national: 'National' };
export const VEHICLE_ICON: Record<string, string> = { moto: '🛵', voiture: '🚗', velo: '🚲', tricycle: '🛺', camion: '🚚', pieton: '🚶', pickup: '🛻' };
/** Le serveur formate déjà le véhicule avec son icône (« 🚗 Corolla ») : on ne l'ajoute que s'il manque. */
export const vehicleLabel = (vehicule: string | null | undefined, type: string | null | undefined) => {
  const v = (vehicule ?? '').trim();
  if (v && /^\p{Extended_Pictographic}/u.test(v)) return v;
  return `${VEHICLE_ICON[type ?? ''] ?? '🛵'} ${v || type || 'Véhicule'}`;
};
/** « -1 mois » renvoyé pour un compte tout neuf (calcul du serveur) → « Nouveau ». */
export const experienceLabel = (e: string | null | undefined) => (!e || e.trim().startsWith('-') ? 'Nouveau' : e);
export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
export const gnf = (n: number) => `${String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
export const fr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
