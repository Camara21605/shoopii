/* ================================================================
 * FICHIER : src/dashboards/livreur/services/missions.api.ts
 *
 * Appels API des missions du livreur.
 *   GET /livreur/missions → commandes assignées au livreur connecté
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
