/* ================================================================
 * FICHIER : src/dashboards/livreur/services/overview.api.ts
 *
 * Appels API pour la Vue d'ensemble du dashboard livreur.
 *   GET /dashboard/livreur/stats          → KPI (lifetime + ce mois-ci)
 *   GET /dashboard/livreur/revenus        → revenus réels (distributions)
 *   GET /dashboard/livreur/revenus/chart  → revenus réels groupés par jour
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

export interface StatsApi {
  totalDeliveries:     number;
  totalEarnings:        number;
  averageRating:        number;
  status:                string;
  verificationStatus:    string;
  /** Livraisons terminées depuis le 1er du mois en cours */
  deliveriesThisMonth:   number;
  /** Nombre de boutiques que ce livreur suit */
  boutiquesAbonnees:     number;
}

export interface RevenusTransaction {
  id:      string;
  source:  string;
  montant: number;
  date:    string;
  statut:  string;
}

export interface RevenusApi {
  tauxCommission:   number;
  totalRevenus:     number;
  revenusThisMonth: number;
  transactions:     RevenusTransaction[];
}

export interface RevenusChartPoint {
  j:     string;
  v:     number;
  today?: boolean;
}

/* ── GET /dashboard/livreur/stats ── */
export async function fetchStats(): Promise<StatsApi> {
  return apiFetch<StatsApi>('/dashboard/livreur/stats');
}

/* ── GET /dashboard/livreur/revenus ── */
export async function fetchRevenus(): Promise<RevenusApi> {
  return apiFetch<RevenusApi>('/dashboard/livreur/revenus');
}

/* ── GET /dashboard/livreur/revenus/chart?period=semaine|mois ── */
export async function fetchRevenusChart(period: 'semaine' | 'mois'): Promise<RevenusChartPoint[]> {
  return apiFetch<RevenusChartPoint[]>('/dashboard/livreur/revenus/chart', { params: { period } });
}
