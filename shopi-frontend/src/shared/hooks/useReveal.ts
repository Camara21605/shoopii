/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/hooks/useReveal.ts
 * ORDRE   : 5 — Hook partagé, utilisé dans les sections
 *           de HomePage.tsx
 * RÔLE    : Observe les éléments .rv et leur ajoute la
 *           classe .in quand ils entrent dans le viewport,
 *           produisant l'animation de reveal (fadeUp).
 *           Utilise IntersectionObserver.
 * ════════════════════════════════════════════════════════
 */

import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.07, rootMargin: '0px 0px -28px 0px' }
    );

    /* Observer tous les éléments .rv présents dans le DOM */
    const run = () => {
      document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    };

    // Premier passage + rAF pour les éléments rendus après mount
    run();
    const raf = requestAnimationFrame(run);

    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
}