/* ================================================================
 * FICHIER : src/dashboards/livreur/services/missions.api.ts
 *
 * Appels API des missions du livreur.
 *   GET   /livreur/missions            → commandes assignées au livreur connecté
 *   PATCH /livreur/missions/:id/accepter → accepter une mission en attente
 *   PATCH /livreur/missions/:id/refuser  → refuser une mission (motif obligatoire)
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';
import type { Mission } from '../data/livreurData';

export interface MissionApi extends Mission {
  /* UUID de la commande — utilisé pour ouvrir /commande/:uuid/suivi */
  uuid: string;
}

/* ── GET /livreur/missions ── */
export async function fetchMissions(): Promise<MissionApi[]> {
  return apiFetch<MissionApi[]>('/livreur/missions');
}

/* ── PATCH /livreur/missions/:uuid/accepter ── */
export async function accepterMission(uuid: string) {
  return apiFetch<{ ok: boolean }>(`/livreur/missions/${uuid}/accepter`, { method: 'PATCH' });
}

/* ── PATCH /livreur/missions/:uuid/refuser ── */
export async function refuserMission(uuid: string, reason: string) {
  return apiFetch<{ ok: boolean }>(`/livreur/missions/${uuid}/refuser`, { method: 'PATCH', body: { reason } });
}
