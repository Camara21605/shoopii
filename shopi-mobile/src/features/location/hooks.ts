/**
 * Hooks de la carte « Localisation » — même comportement que le site
 * (useActorMapSearch.ts, usePlaceSuggestions.ts, useGeolocation.ts) :
 *   - recherche à la frappe : anti-rebond + annulation de la requête
 *     précédente (une réponse lente et périmée n'écrase jamais une plus récente) ;
 *   - mode « autour de » une position (client ou lieu choisi) quand rien n'est tapé ;
 *   - position du téléphone suivie en continu, mais une nouvelle recherche
 *     n'est relancée que si elle a vraiment bougé (~110 m).
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, NetworkError } from '@/lib/api/errors';

import {
  EMPTY_META, searchMapActors, suggestPlaces,
  type MapActor, type MapActorRole, type MapPlace, type MapSearchMeta,
} from './api';

export interface Coords { latitude: number; longitude: number }

interface SearchState {
  results: MapActor[];
  meta: MapSearchMeta;
  loading: boolean;
  error: string | null;
  /** true dès qu'une recherche a abouti (distingue « rien tapé » de « aucun résultat ») */
  searched: boolean;
}
const INITIAL: SearchState = { results: [], meta: EMPTY_META, loading: false, error: null, searched: false };

export function useActorMapSearch(opts: {
  query: string; types: MapActorRole[]; origin: Coords | null; nearby: boolean; radiusKm: number;
}) {
  const { query, types, origin, nearby, radiusKm } = opts;
  const [nonce, setNonce] = useState(0);
  const q = query.trim();
  const originKey = origin ? `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}` : '';
  const typesKey = types.join(',');
  const wantsSearch = q.length >= 2;
  const wantsNearby = !q && nearby && !!originKey;
  /* Signature de la requête voulue — '' = aucune recherche à faire. L'état
   * affiché en est DÉRIVÉ (chargement = la dernière réponse ne correspond pas
   * encore à la signature courante) : aucune remise à zéro dans un effet. */
  const reqKey = wantsSearch || wantsNearby ? `${q}|${typesKey}|${originKey}|${wantsNearby ? radiusKm : ''}|${nonce}` : '';
  const [state, setState] = useState<SearchState & { key: string }>({ ...INITIAL, key: '' });

  useEffect(() => {
    if (!reqKey) return;
    const [lat, lng] = originKey ? originKey.split(',').map(Number) : [undefined, undefined];
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchMapActors({
        q: wantsSearch ? q : undefined,
        types: typesKey ? (typesKey.split(',') as MapActorRole[]) : undefined,
        lat, lng,
        radiusKm: wantsNearby ? radiusKm : undefined,
        limit: 40,
      }, ctrl.signal)
        .then(r => setState({ key: reqKey, results: r.results, meta: r.meta, loading: false, error: null, searched: true }))
        .catch(err => {
          if (ctrl.signal.aborted) return;
          const message = err instanceof ApiError || err instanceof NetworkError ? err.message : 'Recherche impossible.';
          setState(s => ({ ...s, key: reqKey, loading: false, error: message }));
        });
    }, wantsSearch ? 300 : 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  const retry = useCallback(() => setNonce(n => n + 1), []);

  if (!reqKey) return { ...INITIAL, retry };
  const current = state.key === reqKey;
  return {
    /* Pendant le chargement, les résultats précédents restent affichés (pas de clignotement) */
    results: state.results,
    meta: state.meta,
    loading: !current,
    error: current ? state.error : null,
    searched: state.searched,
    retry,
  };
}

export function usePlaceSuggestions(query: string): MapPlace[] {
  const q = query.trim();
  const [state, setState] = useState<{ q: string; places: MapPlace[] }>({ q: '', places: [] });
  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      suggestPlaces(q, ctrl.signal)
        .then(places => setState({ q, places }))
        .catch(() => { if (!ctrl.signal.aborted) setState({ q, places: [] }); });
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return q.length < 2 ? [] : state.places;
}

export type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable';

/**
 * Position du téléphone. Ne demande JAMAIS l'autorisation d'elle-même à
 * l'ouverture de l'écran (pas de fenêtre système surprise) : seulement si elle
 * est déjà accordée, ou quand l'utilisateur touche « Autour de moi » / « Ma position »
 * (request()).
 */
export function useMyPosition() {
  const [position, setPosition] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async () => {
    if (subRef.current) return true;
    try {
      setStatus('locating');
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
        p => {
          setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
          setAccuracy(p.coords.accuracy ?? null);
          setStatus('ok');
        },
      );
      return true;
    } catch {
      setStatus('unavailable');
      return false;
    }
  }, []);

  /** Demande l'autorisation si nécessaire, puis démarre le suivi. false = refusé / indisponible. */
  const request = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { setStatus('denied'); return false; }
    return start();
  }, [start]);

  useEffect(() => {
    let alive = true;
    void Location.getForegroundPermissionsAsync().then(perm => {
      if (alive && perm.granted) void start();
    });
    return () => {
      alive = false;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [start]);

  return { position, accuracy, status, request };
}
