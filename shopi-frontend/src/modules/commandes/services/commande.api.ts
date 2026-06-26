/* ================================================================
 * FICHIER : src/modules/commande/services/commande.api.ts
 *
 * Appels API de la commande / chaîne de validation.
 * Endpoints supposés (à créer côté backend) :
 *   GET  /commandes/:id                  → détail commande
 *   POST /commandes/:id/valider          → valider une étape avec un code
 *   POST /commandes/:id/notes            → envoyer les notations
 *   POST /commandes/:id/litige           → signaler un problème
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';
import type { Commande, ActeurRole, Notation, TypeProbleme } from '../data/types';

/* ── GET /commandes/:uuid ── */
export async function fetchCommande(id: string): Promise<Commande> {
  return apiFetch<Commande>(`/commandes/${id}`);
}

/* ── POST /commandes/:id/valider ──
 * Le backend vérifie que le code correspond au rôle ET que c'est
 * bien le tour de cet acteur. Retourne l'état mis à jour. */
export async function validerEtape(
  id: string, role: ActeurRole, code: string,
): Promise<{ ok: boolean; valideA: string }> {
  return apiFetch<{ ok: boolean; valideA: string }>(`/commandes/${id}/valider`, {
    method: 'POST',
    body: { role, code },
  });
}

/* ── POST /commandes/:id/notes ── */
export async function envoyerNotations(
  id: string, notes: Notation[], pourboire?: number,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/commandes/${id}/notes`, {
    method: 'POST',
    body: { notes, pourboire },
  });
}

/* ── POST /commandes/:id/litige ── */
export async function signalerProbleme(
  id: string, type: TypeProbleme, description: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/commandes/${id}/litige`, {
    method: 'POST',
    body: { type, description },
  });
}