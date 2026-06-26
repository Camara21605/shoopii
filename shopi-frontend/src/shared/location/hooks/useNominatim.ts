/* ============================================================
 * FICHIER : src/shared/location/hooks/useNominatim.ts
 * RÔLE    : Hook React pour le geocoding via Nominatim.
 *           Debounce automatique sur la recherche.
 * ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { reverseGeocode, searchAddress } from '../utils/nominatim';
import type { NominatimResult } from '../types/location.types';

/* ── Geocoding inverse ───────────────────────────────────────── */

export function useReverseGeocode(lat?: number, lng?: number) {
  const [result,  setResult]  = useState<NominatimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    reverseGeocode(lat, lng)
      .then(r => { if (!cancelled) { setResult(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Erreur geocoding'); setLoading(false); } });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return { result, loading, error };
}

/* ── Recherche d'adresse avec debounce ───────────────────────── */

export function useAddressSearch(debounceMs = 500) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchAddress(q);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { query, results, loading, search, clear };
}
