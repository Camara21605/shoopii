/**
 * Bascule vers le compte lié — même déroulé que useAccountSwitch du site :
 *   1. POST /auth/switch-account (ou création / liaison du compte client) ;
 *   2. si le compte cible a la double authentification : code à 6 chiffres ;
 *   3. nouvelle session : jetons enregistrés, caches vidés (les données de
 *      l'autre compte ne doivent jamais s'afficher), temps réel reconnecté
 *      avec le nouveau jeton, puis retour à l'accueil de l'espace du compte
 *      (app/(app)/(tabs)/_layout.tsx redirige entreprise → /entreprise,
 *      livreur → /livreur, client → accueil).
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/features/auth/session-store';
import { queryClient } from '@/lib/query-client';
import { getSocket } from '@/lib/realtime/socket';

import { verifySwitchCode, type SwitchOutcome } from './api';

async function enterSession(o: Extract<SwitchOutcome, { kind: 'session' }>) {
  await useSession.getState().signIn({ accessToken: o.accessToken, refreshToken: o.refreshToken }, o.user);
  queryClient.clear();
  /* Même connexion (les écouteurs restent branchés), nouveau jeton à la reconnexion. */
  const s = getSocket();
  if (s) {
    s.disconnect();
    s.connect();
  }
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

/**
 * `run(action)` exécute une requête qui ouvre une session sur le compte lié.
 * `challenge` non nul = code 2FA attendu → `submitCode(code)`.
 */
export function useAccountSwitch(onBeforeEnter?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const handle = async (o: SwitchOutcome) => {
    if (o.kind === 'twoFa') return setChallenge(o.challengeToken);
    setChallenge(null);
    onBeforeEnter?.();
    await enterSession(o);
  };

  const run = async (action: () => Promise<SwitchOutcome>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await handle(await action());
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitCode = (code: string) => (challenge ? run(() => verifySwitchCode(challenge, code)) : Promise.resolve(false));
  const cancelCode = () => {
    setChallenge(null);
    setError(null);
  };

  return { busy, error, challenge, run, submitCode, cancelCode, clearError: () => setError(null) };
}
