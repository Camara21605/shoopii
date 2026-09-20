/* ================================================================
 * FICHIER : src/dashboards/entreprise/hooks/boutiqueIdentity.ts
 *
 * Identité de la boutique affichée en permanence dans le shell entreprise
 * (nom, logo, statut, e-mail, ville, modèle économique) — UNE seule source,
 * partagée par la barre latérale, la barre du haut et le menu mobile.
 *
 * PROBLÈME RÉSOLU — à chaque rechargement de page, le shell partait de « rien »
 * puis affichait des valeurs de remplacement (« Ma boutique », initiales « TC »,
 * statut « Vendeur Pro ») pendant l'appel API, avant de basculer sur le vrai
 * nom : un nom qui n'est pas celui de la boutique clignotait à chaque F5.
 *
 * SOLUTION — « stale-while-revalidate » :
 *   1. l'identité est mémorisée dans le navigateur, PAR UTILISATEUR (clé
 *      contenant l'id du compte : jamais celle d'un autre compte connecté
 *      auparavant sur le même navigateur) ;
 *   2. au rechargement, elle est lue de façon synchrone AVANT le premier rendu :
 *      le bon nom est là dès la première image ;
 *   3. sans mémoire (toute première visite), le shell affiche un squelette
 *      neutre, jamais un faux nom ;
 *   4. l'API rafraîchit ensuite en arrière-plan ; toute modification faite dans
 *      Paramètres (nom, logo…) est publiée via `publishIdentity` et se voit
 *      aussitôt partout, sans recharger.
 * ================================================================ */

import { tokenStorage } from '../../../shared/services/apiFetch';
import { isTokenValid } from '../../../shared/services/authUtils';

export interface BoutiqueIdentity {
  id:            string;
  companyName:   string;
  logo:          string | null;
  status:        string | null;
  businessEmail: string | null;
  ville:         string | null;
  pays:          string | null;
  /** Modèle économique du compte — filtre le catalogue entre produits et services. */
  businessModel: 'products' | 'services';
}

export const IDENTITY_EVENT = 'boutique-identity-changed';
const PREFIX = 'shoneya.boutique.identity.v1:';

/** Id du compte connecté (claim `sub` du jeton), ou null. */
export function currentUserId(): string | null {
  const token = tokenStorage.get();
  if (!isTokenValid(token)) return null;
  try { return (JSON.parse(atob(token!.split('.')[1])).sub as string) ?? null; }
  catch { return null; }
}

/** Identité mémorisée pour le compte connecté — lecture SYNCHRONE (utilisable dans un initialiseur d'état). */
export function readIdentity(): BoutiqueIdentity | null {
  const uid = currentUserId();
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(PREFIX + uid);
    const v = raw ? JSON.parse(raw) as BoutiqueIdentity : null;
    return v && typeof v.companyName === 'string' && v.companyName ? v : null;
  } catch { return null; }
}

export function writeIdentity(identity: BoutiqueIdentity): void {
  const uid = currentUserId();
  if (!uid) return;
  try { localStorage.setItem(PREFIX + uid, JSON.stringify(identity)); } catch { /* stockage indisponible : sans conséquence */ }
}

/** Retient le sous-ensemble d'identité d'une réponse plus large (paramètres de la boutique). */
export function pickIdentity(d: Partial<BoutiqueIdentity> & { id: string; companyName: string }): BoutiqueIdentity {
  return {
    id: d.id, companyName: d.companyName, logo: d.logo ?? null, status: d.status ?? null,
    businessEmail: d.businessEmail ?? null, ville: d.ville ?? null, pays: d.pays ?? null,
    businessModel: d.businessModel === 'services' ? 'services' : 'products',
  };
}

/** Enregistre ET diffuse l'identité : le shell se met à jour immédiatement (nom/logo modifiés dans Paramètres…). */
export function publishIdentity(identity: BoutiqueIdentity): void {
  writeIdentity(identity);
  window.dispatchEvent(new CustomEvent<BoutiqueIdentity>(IDENTITY_EVENT, { detail: identity }));
}
