/* ============================================================
 * FICHIER : src/dashboards/partenaire/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" + identité réelle de la sidebar partenaire
 * — jusqu'ici des valeurs STATIQUES codées en dur dans Sidebar.tsx
 * ('3', '18', '2'), et un nom/palier ('Mohamed Soumah' / 'Partenaire Or
 * · Conakry') jamais remplacés par les vraies données du partenaire
 * connecté (PartenaireApp.tsx ne passait aucune prop partnerName/
 * partnerTier à <Sidebar>, les valeurs par défaut du composant
 * s'affichaient donc pour TOUT LE MONDE).
 *
 * SOURCE DE DONNÉES : comme pour le dashboard correspondant, ces
 * chiffres sont déjà calculés côté serveur pour la page Overview
 * (voir PartenaireDashboardService.getOverview) — pas de système de
 * notification à réinventer.
 *
 *   - "codes"        → kpis.codesActifs (codes générés, pas encore utilisés)
 *   - "acteurs"       → kpis.totalActeurs (entreprises + livreurs +
 *                        correspondants réellement recrutés — total réel,
 *                        pas une alerte "à traiter")
 *   - "signalements"  → GET /dashboard/partenaire/signalements,
 *                        stats.enCours (signalements pas encore résolus)
 *
 * "Aucun palier" (tier Or/Argent/Bronze) n'existe côté backend — pas de
 * système de classement partenaire aujourd'hui — le sous-titre de la
 * carte partenaire montre donc la zone réelle plutôt qu'un palier inventé.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/shared/services/apiFetch';

interface OverviewApi {
  partenaire: { name: string; zone: string | null; status: string };
  kpis: { totalActeurs: number; codesActifs: number };
}

interface SignalementsApi {
  stats: { total: number; enCours: number; traites: number; rejetes: number };
}

export interface PartenaireBadges {
  codes?:        number;
  acteurs?:      number;
  signalements?: number;
}

export function useSidebarBadges() {
  const [badges, setBadges]         = useState<PartenaireBadges>({});
  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  const [partnerZone, setPartnerZone] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      apiFetch<OverviewApi>('/dashboard/partenaire/overview').catch(() => null),
      apiFetch<SignalementsApi>('/dashboard/partenaire/signalements').catch(() => null),
    ]).then(([overview, signalements]) => {
      const next: PartenaireBadges = {};
      if (overview) {
        if (overview.kpis.codesActifs > 0)  next.codes   = overview.kpis.codesActifs;
        if (overview.kpis.totalActeurs > 0) next.acteurs = overview.kpis.totalActeurs;
        setPartnerName(overview.partenaire.name || undefined);
        setPartnerZone(overview.partenaire.zone || undefined);
      }
      if (signalements && signalements.stats.enCours > 0) {
        next.signalements = signalements.stats.enCours;
      }
      setBadges(next);
    }).catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { badges, partnerName, partnerZone, reload: load };
}
