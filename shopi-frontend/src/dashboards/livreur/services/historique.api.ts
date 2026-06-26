/* ================================================================
 * FICHIER : src/dashboards/livreur/services/historique.api.ts
 *
 * Appels API de l'historique des livraisons du livreur.
 *   GET /livreur/historique → commandes terminées (livrées,
 *   en litige, annulées) assignées au livreur connecté
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';
import type { HistItem } from '../data/livreurData';

export interface HistApi extends HistItem {
  /* UUID de la commande — utilisé pour ouvrir /commande/:uuid/suivi */
  uuid: string;
}

/* ── GET /livreur/historique ── */
export async function fetchHistorique(): Promise<HistApi[]> {
  return apiFetch<HistApi[]>('/livreur/historique');
}
