/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/hooks/useCorrespondants.ts
 *
 * RÔLE : Charge la liste des correspondants + gère le suivi (optimistic).
 *        Le filtrage rapide / recherche / tri se fait côté client
 *        (la liste complète est chargée une fois).
 *
 * EXPOSE : { correspondants, loading, error, reload, toggleSuivi }
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { fetchCorrespondants, toggleSuiviCorrespondant } from '../services/correspondants.api';
import { CORRESPONDANTS_MOCK } from '../data/correspondantsMock';
import type { Correspondant } from '../data/types';

export function useCorrespondants() {
  const [correspondants, setCorrespondants] = useState<Correspondant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCorrespondants()
      .then(data => {
        /* Si l'API renvoie une liste vide, on garde le mock pour le dev */
        setCorrespondants(data.length > 0 ? data : CORRESPONDANTS_MOCK);
      })
      .catch(e => {
        setError(e?.message ?? 'Impossible de charger les correspondants');
        setCorrespondants(CORRESPONDANTS_MOCK);   /* fallback */
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Toggle suivi avec mise à jour optimiste */
  const toggleSuivi = useCallback(async (id: string) => {
    /* 1. MAJ optimiste immédiate */
    setCorrespondants(prev =>
      prev.map(c => c.id === id ? { ...c, suivi: !c.suivi } : c),
    );
    try {
      /* 2. Appel réel ; on resynchronise avec la réponse serveur */
      const { isSuivi } = await toggleSuiviCorrespondant(id);
      setCorrespondants(prev =>
        prev.map(c => c.id === id ? { ...c, suivi: isSuivi } : c),
      );
    } catch {
      /* 3. Rollback en cas d'échec */
      setCorrespondants(prev =>
        prev.map(c => c.id === id ? { ...c, suivi: !c.suivi } : c),
      );
    }
  }, []);

  return { correspondants, loading, error, reload: load, toggleSuivi };
}