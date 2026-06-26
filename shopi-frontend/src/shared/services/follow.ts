/* ================================================================
 * FICHIER : src/shared/services/follow.ts
 *
 * RÔLE : Centralise LE seul appel réseau du toggle abonnement.
 *        Avant, cet appel était dupliqué dans CardLivreur,
 *        LivreursBloc et useLivreurs → source de doubles POST.
 *
 * RÈGLE D'OR : un seul endroit dans toute l'app fait ce POST.
 * ================================================================ */

import { apiFetch } from './apiFetch';

/**
 * Bascule l'abonnement à un livreur (suivre / ne plus suivre).
 * L'endpoint est un toggle : il renvoie l'état confirmé par le serveur.
 *
 * @param id  id du PROFIL livreur (Delivery.id)
 * @returns   true si désormais suivi, false sinon
 */
export async function toggleFollowLivreur(id: string): Promise<boolean> {
  const res = await apiFetch<{ isSuivi: boolean }>(
    `/suivis/livreurs/${id}`,
    { method: 'POST' },
  );
  return res?.isSuivi ?? false;
}

/**
 * Bascule l'abonnement à une boutique / entreprise.
 *
 * @param id id de l'entreprise
 * @returns true si désormais suivie, false sinon
 */
export async function toggleFollowEntreprise(id: string): Promise<boolean> {
  const res = await apiFetch<{ isSuivi: boolean }>(
    `/suivis/entreprises/${id}`,
    { method: 'POST' },
  );
  return res?.isSuivi ?? false;
}
