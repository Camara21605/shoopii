/* ================================================================
 * src/shared/hooks/useSerialQueue.ts
 *
 * File d'attente d'enregistrements « un par un » pour les écrans qui
 * enregistrent à CHAQUE clic (alertes de sécurité, moyens de paiement…).
 *
 * Pourquoi : quand le serveur répond lentement, plusieurs clics rapprochés
 * lançaient plusieurs requêtes EN PARALLÈLE ; leurs réponses (qui contiennent
 * TOUT l'état) arrivaient en retard et dans le désordre, et l'écran se
 * réalignait sur une réponse ANCIENNE : la case cochée se décochait.
 * Ici : une requête à la fois, dans l'ordre des clics, et `isLatest()` dit si
 * la réponse reçue est celle du DERNIER clic (seule à appliquer à l'écran).
 *
 * Tant que la file n'est pas vide, fermer ou recharger l'onglet demande
 * confirmation : sans ça, les derniers clics (encore en attente d'envoi)
 * étaient perdus en silence alors que l'écran les affichait déjà.
 * ================================================================ */

import { useCallback, useEffect, useRef } from 'react';

export function useSerialQueue() {
  const chainRef   = useRef<Promise<unknown>>(Promise.resolve());
  const seqRef     = useRef(0);
  const pendingRef = useRef(0);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (pendingRef.current > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  return useCallback(<T,>(run: () => Promise<T>): { promise: Promise<T>; isLatest: () => boolean } => {
    const seq = ++seqRef.current;
    pendingRef.current++;
    const promise = chainRef.current.catch(() => undefined).then(run);
    promise.catch(() => undefined).finally(() => { pendingRef.current--; });
    chainRef.current = promise;
    return { promise, isLatest: () => seq === seqRef.current };
  }, []);
}
