/* ================================================================
 * FICHIER : src/shared/services/follow.ts
 *
 * RÔLE : Centralise LE seul appel réseau du toggle abonnement
 *        (et du masquage) pour les 3 types d'acteurs suivables
 *        (boutique/entreprise, livreur, correspondant).
 *        Avant, cet appel était dupliqué dans CardLivreur,
 *        LivreursBloc et useLivreurs → source de doubles POST.
 *
 * RÈGLE D'OR : un seul endroit dans toute l'app fait ce POST/PATCH.
 * Utilisé par le composant partagé <FollowButton /> — ne plus
 * appeler apiFetch directement pour du suivi ailleurs dans l'app.
 * ================================================================ */

import { apiFetch } from './apiFetch';

export type FollowActorType = 'entreprise' | 'livreur' | 'correspondant';

/** Segment de route par type d'acteur — ex. /suivis/livreurs/:id */
function routeSegment(actorType: FollowActorType): string {
  if (actorType === 'entreprise')   return 'entreprises';
  if (actorType === 'livreur')      return 'livreurs';
  return 'correspondants';
}

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

/**
 * Bascule l'abonnement à un correspondant.
 * (Comblait un trou : jusqu'ici chaque appelant faisait son propre
 * apiFetch direct vers /suivis/correspondants/:id.)
 *
 * @param id id du PROFIL correspondant (Correspondent.id)
 * @returns true si désormais suivi, false sinon
 */
export async function toggleFollowCorrespondant(id: string): Promise<boolean> {
  const res = await apiFetch<{ isSuivi: boolean }>(
    `/suivis/correspondants/${id}`,
    { method: 'POST' },
  );
  return res?.isSuivi ?? false;
}

/** Bascule le suivi d'un acteur générique — utilisé par FollowButton. */
export async function toggleFollow(actorType: FollowActorType, id: string): Promise<boolean> {
  if (actorType === 'entreprise')   return toggleFollowEntreprise(id);
  if (actorType === 'livreur')      return toggleFollowLivreur(id);
  return toggleFollowCorrespondant(id);
}

/**
 * Masque ou réaffiche un acteur déjà suivi des listes de découverte,
 * sans se désabonner (nécessite un abonnement actif existant).
 *
 * @param actorType type de l'acteur ciblé
 * @param id        id du profil de l'acteur
 * @param hidden    true = masquer, false = réafficher
 */
export async function setFollowHidden(
  actorType: FollowActorType, id: string, hidden: boolean,
): Promise<boolean> {
  const res = await apiFetch<{ hidden: boolean }>(
    `/suivis/${routeSegment(actorType)}/${id}/masquer`,
    { method: 'PATCH', body: { hidden } },
  );
  return res?.hidden ?? hidden;
}
