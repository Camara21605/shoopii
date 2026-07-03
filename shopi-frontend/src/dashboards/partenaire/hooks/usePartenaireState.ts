/* ================================================================
 * FICHIER : src/dashboards/partenaire/hooks/usePartenaireState.ts
 *
 * État global du dashboard partenaire (pattern activePage).
 * - activePage : page affichée par le PageRenderer
 * - modales : génération de code, signalement
 * - génération d'un code de création (mock local, prêt API)
 * - envoi d'un signalement (mock local, prêt API)
 * ================================================================ */

import { useState, useCallback } from 'react';
import type {
  PartenairePage, ActeurType, MotifSignalement, Gravite,
} from '../data/types';

const TYPE_PREFIX: Record<ActeurType, string> = {
  ent: 'ENT', lvr: 'LVR', cor: 'COR', cli: 'CLI',
};

/* Génère un suffixe alphanumérique lisible (sans 0/O/1/I) */
function randCode(len = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function usePartenaireState() {
  const [activePage, setActivePage] = useState<PartenairePage>('overview');

  /* Modale de génération de code */
  const [genOpen, setGenOpen]       = useState(false);
  const [lastCode, setLastCode]     = useState<string>('');

  /* Modale de signalement (peut être pré-remplie avec un acteur) */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<string>('');

  /* Navigation entre pages */
  const navigate = useCallback((page: PartenairePage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* Génération d'un code de création.
     En prod : POST /partenaire/codes { type, destinataire } → { code } */
  const genererCode = useCallback((type: ActeurType): string => {
    const code = `SHOPI-${TYPE_PREFIX[type]}-${randCode()}`;
    setLastCode(code);
    return code;
  }, []);

  /* Ouvre la modale de signalement (optionnellement pré-remplie) */
  const ouvrirSignalement = useCallback((cible = '') => {
    setReportTarget(cible);
    setReportOpen(true);
  }, []);

  /* Envoi d'un signalement.
     En prod : POST /partenaire/signalements { cible, motif, gravite, description } */
  const envoyerSignalement = useCallback(
    (_cible: string, _motif: MotifSignalement, _gravite: Gravite, _desc: string): string => {
      const ref = 'RPT-' + String(Math.floor(Math.random() * 900) + 413);
      return ref;
    }, []);

  return {
    activePage, navigate,
    genOpen, setGenOpen, lastCode, genererCode,
    reportOpen, setReportOpen, reportTarget, ouvrirSignalement, envoyerSignalement,
  };
}
