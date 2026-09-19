/* ================================================================
 * FICHIER : src/shared/location/hooks/useActorMapSearch.ts
 *
 * Recherche « à la frappe » de la carte : anti-rebond (le serveur n'est
 * interrogé qu'une fois la frappe posée) + annulation de la requête
 * précédente (AbortController) — une réponse lente et périmée ne peut
 * donc jamais écraser une réponse plus récente.
 *
 * Deux modes :
 *   - texte saisi (≥ 2 caractères)  → recherche par nom / quartier / ville ;
 *   - pas de texte + `nearbyOf`     → « autour de moi » dans un rayon.
 * ================================================================ */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  searchMapActors, EMPTY_META,
  type MapActor, type MapActorRole, type MapSearchMeta,
} from '../services/mapSearchApi';
import type { Coordinates } from '../types/location.types';

interface Options {
  query:     string;
  types:     MapActorRole[];
  /** Position du client : tri par distance et mode « autour de moi ». */
  origin:    Coordinates | null;
  /** Active le mode « autour de moi » quand `query` est vide. */
  nearby:    boolean;
  radiusKm:  number;
  debounceMs?: number;
}

interface State {
  results: MapActor[];
  meta:    MapSearchMeta;
  loading: boolean;
  error:   string | null;
  /** true dès qu'une recherche a abouti au moins une fois (distingue « rien tapé » de « aucun résultat ») */
  searched: boolean;
}

const INITIAL: State = { results: [], meta: EMPTY_META, loading: false, error: null, searched: false };

export function useActorMapSearch({ query, types, origin, nearby, radiusKm, debounceMs = 300 }: Options) {
  const [state, setState] = useState<State>(INITIAL);
  const [nonce, setNonce] = useState(0);            // « Réessayer »
  const q = query.trim();

  /* La position bouge en continu (watch GPS) : on ne relance la recherche que si elle a vraiment
   * changé (~110 m), sinon chaque battement GPS déclencherait une requête. */
  const originKey = origin ? `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}` : '';
  const originRef = useRef(origin);
  originRef.current = origin;

  const typesKey = types.join(',');

  useEffect(() => {
    const wantsSearch = q.length >= 2;
    const wantsNearby = !q && nearby && !!originRef.current;

    if (!wantsSearch && !wantsNearby) {
      setState(INITIAL);
      return;
    }

    const ctrl = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));

    const timer = setTimeout(() => {
      const o = originRef.current;
      searchMapActors({
        q:        wantsSearch ? q : undefined,
        types:    typesKey ? (typesKey.split(',') as MapActorRole[]) : undefined,
        lat:      o?.latitude,
        lng:      o?.longitude,
        radiusKm: wantsNearby ? radiusKm : undefined,
        limit:    40,
      }, ctrl.signal)
        .then(r => setState({ results: r.results, meta: r.meta, loading: false, error: null, searched: true }))
        .catch(err => {
          if (ctrl.signal.aborted) return;           // remplacée par une recherche plus récente
          setState(s => ({ ...s, loading: false, error: err?.message ?? 'Recherche impossible.' }));
        });
    }, wantsSearch ? debounceMs : 0);

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, typesKey, originKey, nearby, radiusKm, debounceMs, nonce]);

  const retry = useCallback(() => setNonce(n => n + 1), []);

  return { ...state, retry };
}
