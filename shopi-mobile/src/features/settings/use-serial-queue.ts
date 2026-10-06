/**
 * Enregistrements « un par un » pour les écrans qui sauvegardent à CHAQUE
 * interrupteur (même principe que shared/hooks/useSerialQueue.ts du site).
 *
 * Pourquoi : sur un réseau lent, des touches rapprochées lançaient plusieurs
 * requêtes en parallèle ; leurs réponses (qui contiennent tout l'état)
 * revenaient dans le désordre et l'écran se réalignait sur une réponse
 * ANCIENNE — l'interrupteur « revenait en arrière ». Ici : une requête à la
 * fois, dans l'ordre des touches, et `isLatest()` indique si la réponse est
 * celle de la DERNIÈRE touche (la seule à appliquer à l'écran).
 */
import { useCallback, useRef } from 'react';

export function useSerialQueue() {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);

  return useCallback(<T,>(run: () => Promise<T>): { promise: Promise<T>; isLatest: () => boolean } => {
    const mine = ++seq.current;
    const promise = chain.current.catch(() => undefined).then(run);
    chain.current = promise;
    return { promise, isLatest: () => mine === seq.current };
  }, []);
}
