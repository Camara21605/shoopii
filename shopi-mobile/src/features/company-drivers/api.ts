/**
 * Espace entreprise › Mes livreurs — mêmes adresses que la page du site
 * (LivreursPage.tsx, shared/services/api/livreurs.api.ts) :
 *   GET   /livreurs/stats · /livreurs/zones · /livreurs/activite-recente     (deliveries.view)
 *   GET   /livreurs?limit=100 · /livreurs/:id                                 (deliveries.view)
 *   POST  /livreurs/inviter                       code d'invitation par e-mail (deliveries.assign)
 *   PATCH /livreurs/:id/valider                   livreur en attente → actif   (deliveries.assign)
 *   PATCH /livreurs/:id/suspendre · /reactiver                                 (deliveries.edit)
 *   POST  /livreurs/:id/contacter                 e-mail au livreur            (deliveries.edit)
 *   GET/POST /livreurs/missions · PATCH /livreurs/missions/:id/annuler         (view / assign)
 * Réseau (onglets Abonnements / Découvrir) : GET /suivis/livreurs, POST /suivis/livreurs/:id.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

export type Availability = 'available' | 'on_delivery' | 'offline';
export type DriverStatus = 'active' | 'pending' | 'suspended' | 'banned';

export const driverSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Livreur'),
    email: z.string().catch(''),
    phone: z.string().nullable().catch(null),
    zone: z.string().nullable().catch(null),
    vehicleType: z.string().catch('moto'),
    vehiclePlate: z.string().nullable().catch(null),
    vehicleEmoji: z.string().catch('🛵'),
    status: z.enum(['active', 'pending', 'suspended', 'banned']).catch('active'),
    availability: z.enum(['available', 'on_delivery', 'offline']).catch('offline'),
    avatarEmoji: z.string().catch('🛵'),
    averageRating: num,
    totalDeliveries: num,
    successfulDeliveries: num,
    todayDeliveries: num,
    totalEarnings: num,
    joinedAt: z.string().catch(''),
    lastActivity: z.string().catch(''),
    lastActivityAt: z.string().catch(''),
    userId: z.string().catch(''),
    isSuivi: z.boolean().catch(false),
    lastLatitude: z.coerce.number().nullable().catch(null),
    lastLongitude: z.coerce.number().nullable().catch(null),
  })
  .passthrough();
export type Driver = z.infer<typeof driverSchema>;

export const statsSchema = z.object({
  total: num, actifs: num, disponibles: num, enCourse: num, horsLigne: num, enAttente: num, livrAuj: num,
}).passthrough();
export type DriverStats = z.infer<typeof statsSchema>;

const zoneSchema = z.object({ zone: z.string(), orders: num, pct: num }).passthrough();
export type ZoneStat = z.infer<typeof zoneSchema>;

export const fetchStats = () => apiFetch('/livreurs/stats', { schema: statsSchema });
export const fetchZones = () => apiFetch('/livreurs/zones', { schema: z.array(zoneSchema).catch([]) });
export const fetchRecent = () => apiFetch('/livreurs/activite-recente', { schema: z.array(driverSchema).catch([]) });
export const fetchTeam = () =>
  apiFetch('/livreurs', { query: { limit: 100 }, schema: z.object({ data: z.array(driverSchema).catch([]), total: num }).passthrough() });
export const fetchDriver = (id: string) => apiFetch(`/livreurs/${id}`, { schema: driverSchema });

export const inviteDriver = (email: string, message: string) =>
  apiFetch('/livreurs/inviter', {
    method: 'POST',
    body: { email, message },
    schema: z.object({ code: z.string(), email: z.string(), expiresAt: z.string() }).passthrough(),
  });
export const validateDriver = (id: string) => apiFetch(`/livreurs/${id}/valider`, { method: 'PATCH' });
export const suspendDriver = (id: string, raison?: string) => apiFetch(`/livreurs/${id}/suspendre`, { method: 'PATCH', body: { raison } });
export const reactivateDriver = (id: string) => apiFetch(`/livreurs/${id}/reactiver`, { method: 'PATCH' });
export const contactDriver = (id: string, sujet: string, message: string) =>
  apiFetch(`/livreurs/${id}/contacter`, { method: 'POST', body: { sujet, message } });

/* ── Missions ─────────────────────────────────────────────────────── */

export type MissionStatus = 'open' | 'accepted' | 'completed' | 'cancelled';
const missionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().catch(null),
    zone: z.string().nullable().catch(null),
    reward: z.coerce.number().nullable().catch(null),
    urgent: z.boolean().catch(false),
    status: z.enum(['open', 'accepted', 'completed', 'cancelled']).catch('open'),
    assignedDeliveryName: z.string().nullable().optional(),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type Mission = z.infer<typeof missionSchema>;

export const fetchMissions = () => apiFetch('/livreurs/missions', { schema: z.array(missionSchema).catch([]) });
export const createMission = (dto: { title: string; description?: string; zone?: string; reward?: number; urgent: boolean }) =>
  apiFetch('/livreurs/missions', { method: 'POST', body: dto, schema: missionSchema });
export const cancelMission = (id: string) => apiFetch(`/livreurs/missions/${id}/annuler`, { method: 'PATCH' });

/* ── Réseau (livreurs de toute la plateforme) ─────────────────────── */

const networkSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Livreur'),
    profilePicture: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    vehicule: z.string().nullable().optional(),
    /** null = masqué par le livreur (confidentialité) : on n'affiche rien plutôt que « 0 ». */
    averageRating: z.coerce.number().nullable().catch(null),
    totalLivraisons: z.coerce.number().nullable().catch(null),
    disponible: z.boolean().catch(false),
    isSuivi: z.boolean().catch(false),
  })
  .passthrough();
export type NetworkDriver = z.infer<typeof networkSchema>;

export const NETWORK_PAGE = 20;
export const fetchNetwork = (page: number, search: string, signal?: AbortSignal) =>
  apiFetch('/suivis/livreurs', {
    signal,
    query: { page, limit: NETWORK_PAGE, search: search.trim() || undefined },
    schema: z.object({ data: z.array(networkSchema).catch([]), total: num }).passthrough(),
  });

export const toggleFollowDriver = (id: string) =>
  apiFetch(`/suivis/livreurs/${id}`, { method: 'POST', schema: z.object({ isSuivi: z.boolean() }).passthrough() });

/* ── Libellés ─────────────────────────────────────────────────────── */

export const AVAIL: Record<Availability, { label: string; color: string }> = {
  available: { label: 'Disponible', color: '#0F9D58' },
  on_delivery: { label: 'En course', color: '#1F1F1F' },
  offline: { label: 'Hors ligne', color: '#A3A3A3' },
};
export const STATUS: Record<DriverStatus, string> = {
  active: 'Actif', pending: 'En attente', suspended: 'Suspendu', banned: 'Banni',
};
export const VEHICLE: Record<string, string> = {
  moto: 'Moto', voiture: 'Voiture', velo: 'Vélo', tricycle: 'Tricycle', camion: 'Camion', pieton: 'À pied',
};

export const successRate = (d: Pick<Driver, 'totalDeliveries' | 'successfulDeliveries'>) =>
  d.totalDeliveries === 0 ? 0 : Math.round((d.successfulDeliveries / d.totalDeliveries) * 100);

/** « 1,5 M » / « 250 K » / « 900 » — comme le site. */
export function shortGnf(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} K`;
  return n.toLocaleString('fr-FR');
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Numéro pour WhatsApp / appel : chiffres seulement, indicatif Guinée ajouté si absent. */
export function phoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!d) return null;
  return d.length === 9 ? `224${d}` : d;
}
