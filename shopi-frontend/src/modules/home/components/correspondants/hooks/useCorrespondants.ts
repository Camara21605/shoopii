/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/hooks/useCorrespondants.ts
 *
 * RÔLE : Charge la liste des correspondants + synchronise le suivi.
 *        Le filtrage rapide / recherche / tri se fait côté client
 *        (la liste complète est chargée une fois).
 *
 * L'appel réseau de suivi/masquage est fait par FollowButton lui-même
 * (voir shared/components/FollowButton.tsx) — ce hook n'a plus qu'à
 * répercuter le résultat confirmé sur sa propre liste via onChange.
 *
 * EXPOSE : { correspondants, loading, error, reload, onChange }
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { fetchCorrespondants } from '../services/correspondants.api';
import type { Correspondant } from '../data/types';

export function useCorrespondants() {
  const [correspondants, setCorrespondants] = useState<Correspondant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCorrespondants()
      .then(data => setCorrespondants(data))
      .catch(e => {
        setError(e?.message ?? 'Impossible de charger les correspondants');
        setCorrespondants([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChange = useCallback((id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => {
    if (next.removed) {
      setCorrespondants(prev => prev.filter(c => c.id !== id));
      return;
    }
    setCorrespondants(prev => prev.map(c => c.id === id ? { ...c, suivi: next.isSuivi } : c));
  }, []);

  return { correspondants, loading, error, reload: load, onChange };
}