/* ================================================================
 * FICHIER : src/dashboards/partenaire/hooks/usePartenaireState.ts
 * État global du dashboard partenaire (pattern activePage).
 * - genererCode  → POST /dashboard/partenaire/codes (async)
 * - envoyerSignalement → POST /reports (async — endpoint public de
 *   création de signalement, voir reports.controller.ts ; lu ensuite
 *   par le dashboard admin dans "Signalements")
 * ================================================================ */

import { useState, useCallback } from 'react';
import { apiFetch } from '@/shared/services/apiFetch';
import type { PartenairePage, ActeurType, MotifSignalement, Gravite } from '../data/types';

/* CreateReportDto (POST /reports) n'a que title/description/severity/
 * targetUserId — pas de champ motif/type dédié — le motif et le type de
 * compte visé sont donc repliés dans `description` pour ne perdre aucune
 * information saisie par le partenaire. */
const GRAVITE_TO_SEVERITY: Record<Gravite, string> = { low: 'info', med: 'warning', high: 'critical' };
const TYPE_LABEL: Record<string, string> = { ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant', par: 'Partenaire' };

export function usePartenaireState() {
  const [activePage, setActivePage] = useState<PartenairePage>('overview');

  const [genOpen, setGenOpen]   = useState(false);
  const [lastCode, setLastCode] = useState<string>('');

  const [reportOpen, setReportOpen]     = useState(false);
  const [reportTarget, setReportTarget] = useState<string>('');
  /* BUG CORRIGÉ — id réel du compte visé, résolu au moment du clic sur
   * "Signaler cet acteur" (ActeursPage). Conservé séparément du champ
   * texte libre `cible` (modifiable par l'utilisateur dans ReportModal)
   * pour que targetUserId reste fiable même si le texte est ensuite édité.
   * undefined quand ouvert depuis le bouton générique (aucun acteur précis
   * visé) — targetUserId reste alors absent, comportement inchangé. */
  const [reportTargetUserId, setReportTargetUserId] = useState<string | undefined>(undefined);

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

  const ouvrirSignalement = useCallback((cible = '', targetUserId?: string) => {
    setReportTarget(cible);
    setReportTargetUserId(targetUserId);
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
    targetUserId?: string,
  ): Promise<string> => {
    const res = await apiFetch<{ id: string }>('/reports', {
      method: 'POST',
      body: {
        title:       cible,
        description: `[${motifLabel} · ${TYPE_LABEL[type] ?? type}] ${raison}`,
        severity:    GRAVITE_TO_SEVERITY[gravite] ?? 'warning',
        ...(targetUserId ? { targetUserId } : {}),
      },
    });
    return res.id.slice(0, 8).toUpperCase();
  }, []);

  return {
    activePage, navigate,
    genOpen, setGenOpen, lastCode, genererCode,
    reportOpen, setReportOpen, reportTarget, reportTargetUserId, ouvrirSignalement, envoyerSignalement,
  };
}
