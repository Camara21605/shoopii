/* ============================================================
 * FICHIER : src/dashboards/livreur/services/avis.api.ts
 *
 * Appels API pour la page "Évaluation" du dashboard livreur — miroir
 * de dashboards/entreprise/services/avisApi.ts pour l'acteur DELIVERY.
 * ============================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

export interface LivreurAvisApi {
  id:               string;
  clientNom:        string;
  clientInitiales?: string;
  commandeRef:      string;
  note:             number;
  commentaire:      string;
  date:             string;
  reponse?:         string | null;
  commandeId?:      string;
}

export interface LivreurAvisStatsApi {
  moyenne:      number;
  total:        number;
  distribution: Record<string, number>; /* { '5': 72, '4': 18, ... } */
  tauxReponse?: number;
}

export interface LivreurAvisResponse {
  avis:  LivreurAvisApi[];
  stats: LivreurAvisStatsApi;
}

export function fetchLivreurAvis(): Promise<LivreurAvisResponse> {
  return apiFetch<LivreurAvisResponse>('/dashboard/livreur/avis');
}

export function repondreLivreurAvis(avisId: string, reponse: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/dashboard/livreur/avis/${avisId}/reponse`, {
    method: 'POST',
    body:   { reponse },
  });
}
