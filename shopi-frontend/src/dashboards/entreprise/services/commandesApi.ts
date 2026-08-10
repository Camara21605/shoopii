/* ================================================================
 * FICHIER : src/dashboards/entreprise/services/commandesApi.ts
 *
 * Appels API du dashboard entreprise pour les commandes.
 *   GET   /entreprise/commandes          → liste des commandes de la boutique
 *   PATCH /entreprise/commandes/:id/livreur → assigner/changer le livreur
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';
import type { LivreurPickerItem } from '../../../shared/components/ChoisirLivreurModal';
import type { Order } from '../types';

export async function fetchEntrepriseCommandes(): Promise<Order[]> {
  return apiFetch<Order[]>('/entreprise/commandes');
}

export async function assignerLivreurCommande(commandeId: string, livreurId: string) {
  return apiFetch<{ ok: boolean; livreurId: string; livreurAssignmentStatus: string }>(
    `/entreprise/commandes/${commandeId}/livreur`,
    { method: 'PATCH', body: { livreurId } },
  );
}

/* ── GET /livreurs — livreurs de l'entreprise, pour le picker d'assignation ── */
interface LivreurListResponse {
  data: {
    id: string; fullName: string; zone: string;
    avatarEmoji: string; averageRating: number; availability: string;
  }[];
}
export async function fetchAssignableLivreurs(): Promise<LivreurPickerItem[]> {
  const res = await apiFetch<LivreurListResponse>('/livreurs', { params: { limit: 50 } });
  return (res.data ?? []).map(d => ({
    id:    d.id,
    nom:   d.fullName,
    sous:  d.zone || '—',
    emoji: d.avatarEmoji || '🛵',
    note:  d.averageRating > 0 ? d.averageRating.toFixed(1) : undefined,
  }));
}
