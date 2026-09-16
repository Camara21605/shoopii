/* ================================================================
 * FICHIER : src/dashboards/livreur/services/missions-disponibles.api.ts
 *
 * Missions DIFFUSÉES par l'entreprise (voir "Diffuser une mission"
 * dans LivreursPage.tsx côté entreprise) — pas encore acceptées par
 * un livreur. Distinct de missions.api.ts (GET /livreur/missions,
 * commandes déjà assignées à CE livreur) : ici, les missions sont
 * encore "à prendre", premier arrivé premier servi.
 *
 *   GET   /dashboard/livreur/missions/disponibles
 *   PATCH /dashboard/livreur/missions/:id/accepter
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

export interface MissionDisponible {
  id:          string;
  title:       string;
  description: string | null;
  zone:        string | null;
  reward:      number | null;
  urgent:      boolean;
  createdAt:   string;
}

export async function fetchMissionsDisponibles(): Promise<MissionDisponible[]> {
  return apiFetch<MissionDisponible[]>('/dashboard/livreur/missions/disponibles');
}

export async function accepterMissionDisponible(id: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(`/dashboard/livreur/missions/${id}/accepter`, { method: 'PATCH' });
}
