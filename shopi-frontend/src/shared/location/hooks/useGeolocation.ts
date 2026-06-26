/* ============================================================
 * FICHIER : src/shared/location/hooks/useGeolocation.ts
 * RÔLE    : Hook React pour accéder au GPS du navigateur.
 *           Gère les états loading, error, position.
 *           Prend en charge le mode watch (suivi continu).
 * ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Coordinates } from '../types/location.types';

export interface GeolocationState {
  position:  Coordinates | null;
  accuracy:  number | null;
  heading:   number | null;
  speed:     number | null;         // m/s → km/h: speed * 3.6
  loading:   boolean;
  error:     string | null;
  supported: boolean;
}

export interface UseGeolocationOptions {
  /** Active le suivi GPS continu (watchPosition) */
  watch?:            boolean;
  /** Haute précision GPS (plus lent, plus précis) */
  enableHighAccuracy?: boolean;
  /** Timeout requête GPS (ms, défaut : 10s) */
  timeout?:          number;
  /** Cache max (ms, défaut : 0 = toujours frais) */
  maximumAge?:       number;
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout:            10_000,
  maximumAge:         0,
};

export function useGeolocation(options: UseGeolocationOptions = {}): GeolocationState & {
  refresh: () => void;
} {
  const [state, setState] = useState<GeolocationState>({
    position:  null,
    accuracy:  null,
    heading:   null,
    speed:     null,
    loading:   false,
    error:     null,
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  });

  const watchIdRef = useRef<number | null>(null);

  const posOptions: PositionOptions = {
    enableHighAccuracy: options.enableHighAccuracy ?? DEFAULT_OPTIONS.enableHighAccuracy,
    timeout:            options.timeout            ?? DEFAULT_OPTIONS.timeout,
    maximumAge:         options.maximumAge         ?? DEFAULT_OPTIONS.maximumAge,
  };

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setState(prev => ({
      ...prev,
      position:  { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
      accuracy:  pos.coords.accuracy,
      heading:   pos.coords.heading,
      speed:     pos.coords.speed != null ? pos.coords.speed * 3.6 : null, // m/s → km/h
      loading:   false,
      error:     null,
    }));
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Permission refusée. Autorisez la géolocalisation dans votre navigateur.',
      2: 'Position indisponible. Vérifiez votre connexion GPS.',
      3: 'Délai expiré. Réessayez.',
    };
    setState(prev => ({
      ...prev,
      loading: false,
      error:   messages[err.code] ?? 'Erreur GPS inconnue.',
    }));
  }, []);

  const refresh = useCallback(() => {
    if (!state.supported) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, posOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSuccess, onError, state.supported]);

  useEffect(() => {
    if (!state.supported) return;

    setState(prev => ({ ...prev, loading: true }));

    if (options.watch) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onSuccess, onError, posOptions,
      );
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, posOptions);
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.watch]);

  return { ...state, refresh };
}
