/* ================================================================
 * FICHIER : src/dashboards/livreur/services/encours.api.ts
 *
 * Appels API de la mission en cours du livreur.
 *   GET /livreur/encours → commande activement en livraison
 *   (null si aucune mission en cours)
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

export interface EnCoursStep {
  role: 'entreprise' | 'livreur' | 'correspondant' | 'client';
  label: string;
  sub: string;
  status: 'done' | 'active' | 'next';
  time: string | null;
}

export interface EnCoursApi {
  id: string;
  uuid: string;
  em: string;
  nm: string;
  shop: string;
  fee: number;
  speed: 'eco' | 'std' | 'exp' | 'ult';
  client: {
    nom: string;
    telephone: string | null;
    adresse: string;
    instructions: string | null;
  };
  steps: EnCoursStep[];
  etaAt: string | null;
}

/* ── GET /livreur/encours ── */
export async function fetchEnCours(): Promise<EnCoursApi | null> {
  return apiFetch<EnCoursApi | null>('/livreur/encours');
}
