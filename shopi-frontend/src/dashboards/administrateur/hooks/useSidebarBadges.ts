/* ============================================================
 * FICHIER : src/dashboards/administrateur/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" de la sidebar administrateur — jusqu'ici
 * cette sidebar n'affichait AUCUN badge (contrairement aux autres
 * dashboards, elle n'avait même pas de valeur codée en dur à corriger,
 * juste rien du tout).
 *
 * SOURCE DE DONNÉES : AdministrateurDashboardService.getOverview() (déjà
 * appelé pour la page "Vue d'ensemble") renvoie déjà un tableau `queue`
 * prêt à l'emploi — { v: count, label, nav: <id de section> } — pour
 * "Comptes à valider" (validations), "Signalements à traiter"
 * (signalements), "Codes en attente" (codes) et "Commandes en cours"
 * (commandes). Rien à réinventer, juste à lire (voir GET
 * /dashboard/admin/overview).
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

interface OverviewApi {
  queue: { v: number; label: string; nav: string; kind: 'warn' | 'alert' | 'info' | 'ok' }[];
}

export interface AdminBadge { v: number; kind: 'warn' | 'alert' | 'info' | 'ok' }
export type AdminBadges = Partial<Record<string, AdminBadge>>;

export function useSidebarBadges() {
  const [badges, setBadges] = useState<AdminBadges>({});

  const load = useCallback(() => {
    apiFetch<OverviewApi>('/dashboard/admin/overview')
      .then(data => {
        const next: AdminBadges = {};
        for (const item of data.queue ?? []) {
          if (item.v > 0) next[item.nav] = { v: item.v, kind: item.kind };
        }
        setBadges(next);
      })
      .catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { badges, reload: load };
}
