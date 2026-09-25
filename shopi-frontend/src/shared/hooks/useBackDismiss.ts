/* ============================================================
 * FICHIER : src/shared/hooks/useBackDismiss.ts
 *
 * RÔLE : Faire fermer une vue « interne » (panneau, fenêtre, conversation ouverte
 * sur mobile…) par le bouton RETOUR du téléphone, au lieu de quitter toute la page.
 *
 * POURQUOI : ces vues sont de simples états React — elles n'ajoutent rien à
 * l'historique du navigateur. Retour quittait donc directement la section (voire
 * l'application installée) au lieu de simplement refermer la vue ouverte.
 *
 * FONCTIONNEMENT : à l'ouverture on ajoute UNE entrée d'historique (même URL).
 * Retour la consomme → on ferme la vue. Si la vue est fermée autrement (bouton ✕),
 * on retire l'entrée devenue inutile. Plusieurs vues ouvertes en même temps sont
 * empilées : chaque Retour ferme la plus récente.
 * ============================================================ */

import { useEffect, useRef } from 'react';

interface Entry { id: number; dismiss: () => void }

const stack: Entry[] = [];
let nextId = 1;
/** Nombre de popstate à ignorer : ceux que NOUS provoquons en retirant une entrée. */
let ignorePops = 0;
let listening = false;

function onPopState() {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  const top = stack.pop();
  top?.dismiss();
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', onPopState);
  listening = true;
}

/**
 * @param active   la vue est ouverte
 * @param dismiss  ferme la vue (ex. () => setOpen(false))
 */
export function useBackDismiss(active: boolean, dismiss: () => void): void {
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });

  useEffect(() => {
    if (!active) return;
    ensureListener();

    const entry: Entry = { id: nextId++, dismiss: () => dismissRef.current() };
    stack.push(entry);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), __backDismiss: entry.id }, '');
    } catch { stack.pop(); return; }

    return () => {
      const i = stack.indexOf(entry);
      if (i === -1) return;                 // déjà consommée par le bouton Retour
      const isTop = i === stack.length - 1;
      stack.splice(i, 1);
      /* Fermée autrement (✕, choix d'une conversation…) : on retire l'entrée d'historique devenue
       * inutile, sinon le prochain Retour ne semblerait « rien faire ». */
      if (isTop && (window.history.state as { __backDismiss?: number } | null)?.__backDismiss === entry.id) {
        ignorePops += 1;
        window.history.back();
      }
    };
  }, [active]);
}
