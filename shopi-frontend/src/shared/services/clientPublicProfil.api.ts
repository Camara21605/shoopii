/* ================================================================
 * FICHIER : src/shared/services/clientPublicProfil.api.ts
 *
 * RÔLE : Consultation du profil public d'UN client par un autre
 *        visiteur (GET /client/profils/:id).
 *
 * Respecte les réglages "Confidentialité du profil" du client visité
 * (visibilite/historique/wishlist) — voir client-public-profil.service.ts
 * côté backend. `commandesCount`/`wishlist` sont absents de la réponse
 * quand le client visité les a masqués.
 * ================================================================ */

import { apiFetch } from './apiFetch';
import type { WishlistItemApi } from './wishlist.api';

export interface ClientPublicProfilApi {
  id: string;
  nom: string;
  initiales: string;
  avatar: string | null;
  bio: string | null;
  membreDepuis: string;
  commandesCount?: number;
  wishlist?: WishlistItemApi[];
}

export function fetchClientPublicProfil(id: string): Promise<ClientPublicProfilApi> {
  return apiFetch<ClientPublicProfilApi>(`/client/profils/${id}`);
}
