/* ================================================================
 * FICHIER : src/dashboards/partenaire/hooks/usePartenaireState.ts
 * État global du dashboard partenaire (pattern activePage).
 * - genererCode  → POST /dashboard/partenaire/codes (async)
 * - envoyerSignalement → POST /dashboard/partenaire/signalements (async)
 * ================================================================ */

import { useState, useCallback } from 'react';
import { apiFetch } from '@/shared/services/apiFetch';
import type { PartenairePage, ActeurType, MotifSignalement, Gravite } from '../data/types';

export function usePartenaireState() {
  const [activePage, setActivePage] = useState<PartenairePage>('overview');

  const [genOpen, setGenOpen]   = useState(false);
  const [lastCode, setLastCode] = useState<string>('');

  const [reportOpen, setReportOpen]     = useState(false);
  const [reportTarget, setReportTarget] = useState<string>('');

  const navigate = useCallback((page: PartenairePage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* Génération d'un code via l'API backend */
  const genererCode = useCallback(async (type: ActeurType, targetEmail?: string): Promise<string> => {
    const res = await apiFetch<{ code: string }>('/dashboard/partenaire/codes', {
      method: 'POST',
      body:   { type, targetEmail: targetEmail ?? undefined },
    });
    setLastCode(res.code);
    return res.code;
  }, []);

  const ouvrirSignalement = useCallback((cible = '') => {
    setReportTarget(cible);
    setReportOpen(true);
  }, []);

  /* Envoi d'un signalement via l'API backend */
  const envoyerSignalement = useCallback(async (
    cible:      string,
    motif:      MotifSignalement,
    gravite:    Gravite,
    raison:     string,
    motifLabel: string,
    type:       string,
  ): Promise<string> => {
    const res = await apiFetch<{ ref: string }>('/dashboard/partenaire/signalements', {
      method: 'POST',
      body:   { cible, motif, motifLabel, gravite, raison, type },
    });
    return res.ref;
  }, []);

  return {
    activePage, navigate,
    genOpen, setGenOpen, lastCode, genererCode,
    reportOpen, setReportOpen, reportTarget, ouvrirSignalement, envoyerSignalement,
  };
}
