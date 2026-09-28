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
 * ================================================================ */

import { useCallback, useRef } from 'react';

export function useSerialQueue() {
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const seqRef   = useRef(0);

  return useCallback(<T,>(run: () => Promise<T>): { promise: Promise<T>; isLatest: () => boolean } => {
    const seq = ++seqRef.current;
    const promise = chainRef.current.catch(() => undefined).then(run);
    chainRef.current = promise;
    return { promise, isLatest: () => seq === seqRef.current };
  }, []);
}
