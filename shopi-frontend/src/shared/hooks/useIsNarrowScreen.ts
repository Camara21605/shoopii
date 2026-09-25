/* ================================================================
 * src/shared/hooks/useIsNarrowScreen.ts
 *
 * true sous `maxWidthPx` ("mode téléphone") — utilisé par les pages
 * paramètres (client, entreprise…) pour remplacer leur navigation par
 * onglets/sidebar par une liste groupée façon réglages natifs sous ce
 * seuil, avec une vue "détail" par section et un vrai bouton retour.
 * ================================================================ */

import { useEffect, useState } from 'react';

export function useIsNarrowScreen(maxWidthPx: number): boolean {
  const query = `(max-width: ${maxWidthPx}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return narrow;
}
