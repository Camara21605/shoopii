/* ============================================================
 * FICHIER : src/dashboards/correspondant/services/avis.api.ts
 *
 * Appels API pour la page "Évaluation" du dashboard correspondant —
 * miroir de dashboards/livreur/services/avis.api.ts pour l'acteur
 * CORRESPONDENT.
 * ============================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

export interface CorrespondantAvisApi {
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

export interface CorrespondantAvisStatsApi {
  moyenne:      number;
  total:        number;
  distribution: Record<string, number>; /* { '5': 72, '4': 18, ... } */
  tauxReponse?: number;
}

export interface CorrespondantAvisResponse {
  avis:  CorrespondantAvisApi[];
  stats: CorrespondantAvisStatsApi;
}

export function fetchCorrespondantAvis(): Promise<CorrespondantAvisResponse> {
  return apiFetch<CorrespondantAvisResponse>('/dashboard/correspondant/avis');
}

export function repondreCorrespondantAvis(avisId: string, reponse: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/dashboard/correspondant/avis/${avisId}/reponse`, {
    method: 'POST',
    body:   { reponse },
  });
}
