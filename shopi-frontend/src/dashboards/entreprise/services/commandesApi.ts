/* ================================================================
 * FICHIER : src/dashboards/entreprise/services/commandesApi.ts
 *
 * Appels API du dashboard entreprise pour les commandes.
 *   GET /entreprise/commandes → liste des commandes de la boutique
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';
import type { Order } from '../types';

export async function fetchEntrepriseCommandes(): Promise<Order[]> {
  return apiFetch<Order[]>('/entreprise/commandes');
}
