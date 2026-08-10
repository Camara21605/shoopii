/* ============================================================
 * FICHIER : src/shared/hooks/useAccountSwitch.ts
 *
 * RÔLE : Logique partagée du switch "Mon espace" (pro↔client) — utilisée
 *        à la fois par le sélecteur de contexte permanent (AccountSwitcher)
 *        et par MonEspaceClientModal (bouton "Basculer" une fois lié).
 *        Centralise : step-up 2FA, avertissement si action sensible en
 *        cours, déconnexion explicite des sockets, redirection finale.
 *
 * Pourquoi un rechargement complet de page (window.location.href) et pas
 * navigate() SPA : le handshake Socket.IO fixe socket.data.userId côté
 * serveur au moment de la connexion — un socket déjà connecté ne se
 * ré-authentifie pas tout seul si le token change (voir getSocket() dans
 * useSocket.ts/useNotificationSocket.ts). On déconnecte donc explicitement
 * les deux sockets AVANT de naviguer, pour que le serveur voie l'ancienne
 * identité se déconnecter proprement (frame de déconnexion immédiate,
 * plutôt que d'attendre le ping-timeout au démontage de la page) ; le
 * rechargement complet qui suit garantit ensuite une reconnexion saine
 * sous la nouvelle identité, sans dépendre d'un état React résiduel.
 * ================================================================ */

import { useState } from 'react';
import { switchAccount, verifySwitchTwoFa } from '../services/accountLink';
import { getDashboardPath } from '../services/authUtils';
import { disconnectGlobalSocket } from '../messagerie/hooks/useSocket';
import { disconnectNotificationSocket } from '../notifications/useNotificationSocket';
import { useGlobalCall } from '../context/GlobalCallContext';
import type { AuthResponse } from '../../modules/auth/types';

export function useAccountSwitch() {
  const { callStatus } = useGlobalCall();
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState('');
  const [twoFaChallengeToken, setTwoFaChallengeToken] = useState<string | null>(null);

  function finishSwitch(result: AuthResponse) {
    disconnectGlobalSocket();
    disconnectNotificationSocket();
    window.location.href = getDashboardPath(result.user.role);
  }

  /** true si l'utilisateur confirme (ou s'il n'y a rien à confirmer). */
  function confirmIfSensitiveActionInProgress(): boolean {
    if (callStatus !== 'idle') {
      return window.confirm(
        'Un appel est en cours. Basculer de compte va le terminer. Continuer ?',
      );
    }
    return true;
  }

  async function performSwitch() {
    if (!confirmIfSensitiveActionInProgress()) return;
    setPending(true);
    setError('');
    try {
      const result = await switchAccount();
      if ('requiresTwoFa' in result) {
        setTwoFaChallengeToken(result.challengeToken);
        setPending(false);
        return;
      }
      finishSwitch(result);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de basculer vers ce compte.');
      setPending(false);
    }
  }

  async function verifyTwoFa(code: string) {
    if (!twoFaChallengeToken) return;
    setPending(true);
    setError('');
    try {
      const result = await verifySwitchTwoFa(twoFaChallengeToken, code);
      setTwoFaChallengeToken(null);
      finishSwitch(result);
    } catch (e: any) {
      setError(e?.message ?? 'Code incorrect.');
      setPending(false);
    }
  }

  function cancelTwoFa() {
    setTwoFaChallengeToken(null);
    setError('');
  }

  return {
    performSwitch,
    pending,
    error,
    /** Non-null pendant l'étape de step-up 2FA — afficher <TwoFaChallenge>. */
    twoFaChallengeToken,
    verifyTwoFa,
    cancelTwoFa,
  };
}
