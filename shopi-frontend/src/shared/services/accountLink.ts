/* ============================================================
 * FICHIER : src/shared/services/accountLink.ts
 *
 * RÔLE : Client API pour "Mon espace" — compte client lié à un compte
 *        pro (entreprise/livreur/correspondant/admin/partenaire), même
 *        email/téléphone, bascule sans réauthentification.
 *        Voir shoneya-backend/src/modules/auth/account-link.service.ts
 *        pour la logique métier correspondante.
 * ============================================================ */

import { apiFetch, tokenStorage } from './apiFetch';
import type { AuthResponse, UserRole, TwoFaChallengeResponse } from '../../modules/auth/types';

export interface ClientAccountStatus {
  linked: boolean;
  otherUserId?: string;
  otherRole?:   UserRole;
  /** Rempli seulement si linked=false : un compte client non lié existe
   *  déjà avec le même email/téléphone — proposer la liaison plutôt que
   *  la création rapide. */
  existingClientFound?: boolean;
  /** Quel champ a permis de le retrouver — affiché pour expliquer pourquoi
   *  ce compte est proposé. */
  matchedBy?: 'email' | 'phone';
}

export function getClientAccountStatus(): Promise<ClientAccountStatus> {
  return apiFetch<ClientAccountStatus>('/auth/client-account/status');
}

/** Crée le compte client lié (infos reprises du compte pro côté serveur —
 *  seul le mot de passe est fourni ici) et connecte immédiatement dessus. */
export async function createLinkedClient(password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/create-linked-client', {
    method: 'POST',
    body:   { password },
  });
  tokenStorage.set(data.accessToken);
  return data;
}

/** Lie un compte client PRÉEXISTANT — exactement une des deux preuves,
 *  jamais automatique sur simple correspondance d'email/téléphone. */
export async function linkExistingClient(
  proof: { password: string } | { resetToken: string },
): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/link-existing-client', {
    method: 'POST',
    body:   proof,
  });
  tokenStorage.set(data.accessToken);
  return data;
}

/** Bascule vers le compte lié (pro→client ou client→pro selon le compte
 *  courant) — aucune réauthentification, le lien fait déjà foi. Si le
 *  compte cible a la 2FA active (et pas de grâce récente), renvoie
 *  requiresTwoFa plutôt que les tokens — compléter via verifySwitchTwoFa(). */
export async function switchAccount(): Promise<AuthResponse | TwoFaChallengeResponse> {
  const data = await apiFetch<AuthResponse | TwoFaChallengeResponse>('/auth/switch-account', { method: 'POST' });
  if ('requiresTwoFa' in data) return data;
  tokenStorage.set(data.accessToken);
  return data;
}

/** Complète un switch qui exigeait un step-up 2FA — réutilise l'endpoint
 *  générique /auth/2fa/verify-login (même format de challenge que le login). */
export async function verifySwitchTwoFa(challengeToken: string, code: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/2fa/verify-login', {
    method: 'POST',
    body:   { challengeToken, code },
  });
  tokenStorage.set(data.accessToken);
  return data;
}
