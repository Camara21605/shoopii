/* ================================================================
 * FICHIER : src/modules/home/components/compare/hooks/useComparables.ts
 *
 * RÔLE : Charge les produits proposables pour compléter une comparaison
 *        (même catégorie, même sous-catégorie par défaut) via
 *        GET /public/produits/comparables. Recherche « débouncée ».
 *        Les résultats précédents restent affichés pendant le chargement
 *        suivant (pas de clignotement quand on tape).
 * ================================================================ */
import { useEffect, useState } from 'react';
import { produitApi, type ComparablesApi } from '../../produit/api/produit.api';

interface Options {
  scope:    'sub' | 'cat';
  search?:  string;
  limit?:   number;
  enabled?: boolean;
}

interface State { key: string; res: ComparablesApi | null; error: boolean }

export function useComparables(ids: string[], { scope, search = '', limit = 12, enabled = true }: Options) {
  const [state, setState] = useState<State>({ key: '', res: null, error: false });

  const idsKey = ids.join(',');
  const reqKey = `${idsKey}|${scope}|${search.trim()}|${limit}`;
  const active = enabled && ids.length > 0;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    /* La recherche attend que l'utilisateur ait fini de taper. */
    const timer = setTimeout(() => {
      produitApi.getComparables(idsKey.split(','), { scope, search, limit })
        .then(res => { if (!cancelled) setState({ key: reqKey, res, error: false }); })
        .catch(() => { if (!cancelled) setState({ key: reqKey, res: null, error: true }); });
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reqKey, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    res:     active ? state.res : null,
    loading: active && state.key !== reqKey,
    error:   active && state.key === reqKey && state.error,
  };
}
