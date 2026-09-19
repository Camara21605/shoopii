/* ================================================================
 * FICHIER : src/shared/location/hooks/usePlaceSuggestions.ts
 * Suggestions de LIEUX (quartiers, communes, villes) à la frappe :
 * anti-rebond court + annulation de la requête précédente.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { suggestPlaces, type MapPlace } from '../services/mapSearchApi';

export function usePlaceSuggestions(query: string, debounceMs = 220): MapPlace[] {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) { setPlaces([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      suggestPlaces(q, ctrl.signal)
        .then(setPlaces)
        .catch(() => { if (!ctrl.signal.aborted) setPlaces([]); });
    }, debounceMs);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, debounceMs]);

  return places;
}
