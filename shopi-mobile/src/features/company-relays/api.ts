/**
 * Espace entreprise › Mes correspondants (points relais, entrepôts, export) —
 * mêmes adresses que la page du site (CorrespondantsPage.tsx, correspondants.api.ts) :
 *   GET   /correspondants/stats · /zones · /activite-recente · /correspondants?limit=100 · /:id   (deliveries.view)
 *   POST  /correspondants/inviter            code d'invitation par e-mail                   (deliveries.edit)
 *   PATCH /correspondants/:id/valider · /suspendre · /reactiver                              (deliveries.edit)
 *   POST  /correspondants/:id/contacter      e-mail au correspondant                         (deliveries.edit)
 * Réseau (Abonnements / Découvrir) : GET /suivis/correspondants, POST /suivis/correspondants/:id.
 * Carte : position du dépôt de chaque correspondant, lue par GET /location/map/search
 * (même source que la carte « Localisation » — le profil d'équipe n'a pas de coordonnées).
 */
import { z } from 'zod';

import { searchMapActors } from '@/features/location/api';
import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

export type RelayType = 'relais' | 'entrepot' | 'export' | 'principal';
export type RelayStatus = 'active' | 'pending' | 'suspended';

export const relaySchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Correspondant'),
    email: z.string().catch(''),
    phone: z.string().nullable().catch(null),
    ville: z.string().catch(''),
    quartier: z.string().catch(''),
    adresse: z.string().nullable().catch(null),
    type: z.enum(['relais', 'entrepot', 'export', 'principal']).catch('relais'),
    status: z.enum(['active', 'pending', 'suspended']).catch('active'),
    avatarEmoji: z.string().catch('📍'),
    photo: z.string().nullable().optional().catch(null),
    totalMissions: num,
    thisMonth: num,
    averageRating: num,
    zone: z.string().nullable().catch(null),
    joinedAt: z.string().catch(''),
    lastActivity: z.string().catch(''),
    lastActivityAt: z.string().catch(''),
    userId: z.string().catch(''),
    isSuivi: z.boolean().catch(false),
  })
  .passthrough();
export type Relay = z.infer<typeof relaySchema>;

export const statsSchema = z.object({ total: num, actifs: num, thisMonth: num, villes: num, enAttente: num }).passthrough();
export type RelayStats = z.infer<typeof statsSchema>;

const zoneSchema = z.object({ zone: z.string(), orders: num, pct: num }).passthrough();

export const fetchStats = () => apiFetch('/correspondants/stats', { schema: statsSchema });
export const fetchZones = () => apiFetch('/correspondants/zones', { schema: z.array(zoneSchema).catch([]) });
export const fetchRecent = () => apiFetch('/correspondants/activite-recente', { schema: z.array(relaySchema).catch([]) });
export const fetchTeam = () =>
  apiFetch('/correspondants', { query: { limit: 100 }, schema: z.object({ data: z.array(relaySchema).catch([]), total: num }).passthrough() });
export const fetchRelay = (id: string) => apiFetch(`/correspondants/${id}`, { schema: relaySchema });

export const inviteRelay = (email: string, message: string) =>
  apiFetch('/correspondants/inviter', {
    method: 'POST',
    body: { email, message },
    schema: z.object({ code: z.string(), email: z.string(), expiresAt: z.string() }).passthrough(),
  });
export const validateRelay = (id: string) => apiFetch(`/correspondants/${id}/valider`, { method: 'PATCH' });
export const suspendRelay = (id: string, raison?: string) => apiFetch(`/correspondants/${id}/suspendre`, { method: 'PATCH', body: { raison } });
export const reactivateRelay = (id: string) => apiFetch(`/correspondants/${id}/reactiver`, { method: 'PATCH' });
export const contactRelay = (id: string, sujet: string, message: string) =>
  apiFetch(`/correspondants/${id}/contacter`, { method: 'POST', body: { sujet, message } });

/* ── Carte : position des dépôts de l'équipe ──────────────────────── */

export type RelayPosition = { id: string; lat: number; lng: number; approx: boolean; precision: 'exact' | 'quartier' | 'commune' | 'ville' };

/**
 * Cherche chaque correspondant de l'équipe par son nom sur la carte et ne garde
 * que le résultat qui porte SON identifiant (homonymes écartés). Par lots de 5
 * pour rester sous la limite d'appels du serveur (60 par minute).
 */
export async function fetchTeamPositions(team: Pick<Relay, 'id' | 'fullName'>[], signal?: AbortSignal): Promise<RelayPosition[]> {
  const out: RelayPosition[] = [];
  const list = team.filter((r) => r.fullName.trim().length >= 2).slice(0, 40);
  for (let i = 0; i < list.length; i += 5) {
    const batch = await Promise.all(list.slice(i, i + 5).map((r) =>
      searchMapActors({ q: r.fullName.slice(0, 80), types: ['correspondent'], limit: 10 }, signal)
        .then((res) => res.results.find((a) => a.id === r.id))
        .catch(() => undefined)));
    for (const a of batch) if (a) out.push({ id: a.id, lat: a.lat, lng: a.lng, approx: a.approx, precision: a.precision });
  }
  return out;
}

/* ── Réseau (correspondants de toute la plateforme) ───────────────── */

const networkSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Correspondant'),
    profilePicture: z.string().nullable().optional(),
    localisation: z.string().nullable().optional(),
    ville: z.string().nullable().optional(),
    quartier: z.string().nullable().optional(),
    typeCorrespondant: z.string().nullable().optional(),
    totalMissions: num,
    averageRating: num,
    experience: z.string().nullable().optional(),
    online: z.boolean().catch(false),
    isSuivi: z.boolean().catch(false),
  })
  .passthrough();
export type NetworkRelay = z.infer<typeof networkSchema>;

export const fetchNetwork = (search: string, signal?: AbortSignal) =>
  apiFetch('/suivis/correspondants', { signal, query: { limit: 100, search: search.trim() || undefined }, schema: z.array(networkSchema).catch([]) });

export const toggleFollowRelay = (id: string) =>
  apiFetch(`/suivis/correspondants/${id}`, { method: 'POST', schema: z.object({ isSuivi: z.boolean() }).passthrough() });

/* ── Libellés ─────────────────────────────────────────────────────── */

export const TYPE: Record<RelayType, { label: string; icon: 'star' | 'storefront' | 'cube' | 'airplane' }> = {
  principal: { label: 'Principal', icon: 'star' },
  relais: { label: 'Point relais', icon: 'storefront' },
  entrepot: { label: 'Entrepôt', icon: 'cube' },
  export: { label: 'Export', icon: 'airplane' },
};
export const STATUS: Record<RelayStatus, string> = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu' };
export const NETWORK_TYPE: Record<string, string> = { regional: 'Régional', zonal: 'Zonal', national: 'National' };

export const place = (r: Pick<Relay, 'ville' | 'quartier'>) => [r.ville, r.quartier].filter(Boolean).join(' · ') || 'Lieu non défini';
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
