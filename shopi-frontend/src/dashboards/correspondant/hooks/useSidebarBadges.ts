/* ============================================================
 * FICHIER : src/dashboards/correspondant/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" de la sidebar correspondant — jusqu'ici
 * des valeurs STATIQUES codées en dur dans Sidebar.tsx ('14', '3', '2',
 * '4', '7', '★ 4.9'), identiques pour tout le monde et ne représentant
 * aucune donnée réelle.
 *
 * SOURCE DE DONNÉES : contrairement aux dashboards entreprise/livreur
 * (badges = notifications non vues), les onglets ici correspondent à
 * des DÉCOMPTES réels déjà calculés côté serveur pour la page Overview
 * (voir OverviewAggregateService.getOverview — colisCounts/relayFlow)
 * — pas de système de notification à réinventer, ces chiffres existent
 * déjà, ils n'étaient simplement jamais lus par la sidebar.
 *
 *   - "colis"      → colisCounts.att   (colis arrivés, en attente de scan
 *                     par le correspondant — l'action qu'il doit encore faire)
 *   - "transferts" → colisCounts.dep   (colis dispatchés vers un livreur,
 *                     transfert en cours)
 *   - "retours"    → colisCounts.ret   (retours/litiges à traiter)
 *   - "boutiques"  → relayFlow.sources      (nombre réel de boutiques partenaires)
 *   - "livreurs"   → relayFlow.destinations (nombre réel de livreurs locaux)
 *   - "evaluation" → note moyenne réelle (Correspondent.averageRating),
 *                     masquée tant qu'aucune mission n'a encore été notée
 *                     (totalMissions === 0) pour ne pas afficher "★ 0.0"
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

interface OverviewApi {
  colisCounts: { att: number; stock: number; dep: number; ret: number };
  relayFlow:   { sources: number; destinations: number };
}

interface EvaluationApi {
  averageRating: number;
  totalMissions: number;
}

export interface CorrespondantBadges {
  colis?:      number;
  transferts?: number;
  retours?:    number;
  boutiques?:  number;
  livreurs?:   number;
  evaluation?: string;
}

export function useSidebarBadges() {
  const [badges, setBadges] = useState<CorrespondantBadges>({});

  const load = useCallback(() => {
    Promise.all([
      apiFetch<OverviewApi>('/dashboard/correspondant/overview').catch(() => null),
      apiFetch<EvaluationApi>('/dashboard/correspondant/evaluation').catch(() => null),
    ]).then(([overview, evaluation]) => {
      const next: CorrespondantBadges = {};
      if (overview) {
        if (overview.colisCounts.att > 0)   next.colis      = overview.colisCounts.att;
        if (overview.colisCounts.dep > 0)   next.transferts = overview.colisCounts.dep;
        if (overview.colisCounts.ret > 0)   next.retours    = overview.colisCounts.ret;
        if (overview.relayFlow.sources > 0)      next.boutiques = overview.relayFlow.sources;
        if (overview.relayFlow.destinations > 0) next.livreurs  = overview.relayFlow.destinations;
      }
      if (evaluation && evaluation.totalMissions > 0) {
        next.evaluation = `★ ${evaluation.averageRating.toFixed(1)}`;
      }
      setBadges(next);
    }).catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { badges, reload: load };
}
