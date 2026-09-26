/* ============================================================
 * FICHIER : src/shared/messagerie/hooks/useMinuteTick.ts
 *
 * Re-rendu toutes les minutes — pour que « Vu il y a 5 min » avance tout seul
 * sans attendre un nouvel évènement. Un seul minuteur partagé par tous les
 * composants abonnés (liste des conversations, en-tête, panneau).
 * ============================================================ */

import { useSyncExternalStore } from 'react';

let minute = Math.floor(Date.now() / 60_000);
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      minute = Math.floor(Date.now() / 60_000);
      listeners.forEach(l => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
  };
}

/** Numéro de la minute courante (change une fois par minute). */
export function useMinuteTick(): number {
  return useSyncExternalStore(subscribe, () => minute, () => minute);
}
