/* ================================================================
 * FICHIER : src/dashboards/administrateur/services/company-settings.service.ts
 *
 * RÔLE : Client API pour le moteur de configuration des entreprises.
 *   - Commission, validation, documents, catégories, règles, stats, export
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types ──────────────────────────────────────────────────── */

export type CommissionType = 'percentage' | 'fixed' | 'progressive';
export type ValidationMode = 'auto' | 'manuel' | 'hybride';

export interface CommissionBracket {
  from: number;
  to:   number | null;
  rate: number;
}

export interface RequiredDocument {
  id:          string;
  label:       string;
  description: string;
  required:    boolean;
}

export interface CategoryRule {
  nom:        string;
  enabled:    boolean;
  commission: number | null;
}

export interface CompanySettings {
  commissionType:             CommissionType;
  commissionValue:            number;
  commissionMin:              number;
  commissionMax:              number;
  commissionBrackets:         CommissionBracket[];
  validationMode:             ValidationMode;
  validationDelayH:           number;
  requiredDocuments:          RequiredDocument[];
  categoryRules:              CategoryRule[];
  monthlyOrderLimit:          number;
  dailyOrderLimit:            number;
  maxProducts:                number;
  maxActivePromotions:        number;
  maxBranches:                number;
  allowPhysical:              boolean;
  allowDigital:               boolean;
  allowServices:              boolean;
  allowInternational:         boolean;
  autoSuspensionEnabled:      boolean;
  suspensionSignalThreshold:  number;
  suspensionLitigeThreshold:  number;
  inactivityDays:             number;
  notifEventsConfig:          Record<string, boolean>;
  updatedAt:                  string;
}

export interface CompanyStats {
  total:        number;
  active:       number;
  pending:      number;
  suspended:    number;
  newThisMonth: number;
  verified:     number;
  premium:      number;
  totalRevenue: number;
  totalOrders:  number;
}

export interface CategoryItem {
  id:      string;
  nom:     string;
  slug:    string;
  icone:   string | null;
  couleur: string | null;
  actif:   boolean;
}

/* ── Valeurs par défaut (affichage offline) ─────────────────── */

export const DEFAULT_BRACKETS: CommissionBracket[] = [
  { from: 0,         to: 1_000_000, rate: 8 },
  { from: 1_000_000, to: 5_000_000, rate: 6 },
  { from: 5_000_000, to: null,      rate: 4 },
];

export const DEFAULT_DOCUMENTS: RequiredDocument[] = [
  { id: 'rccm',    label: 'RCCM',                    description: 'Registre du Commerce et du Crédit Mobilier',   required: true  },
  { id: 'cni',     label: 'CNI / Passeport',          description: "Pièce d'identité du représentant légal",      required: true  },
  { id: 'contrat', label: 'Contrat Shopi',             description: 'Contrat signé avec Shopi Guinée',             required: true  },
  { id: 'nif',     label: 'NIF / Attestation fiscale', description: "Numéro d'Identification Fiscale",            required: false },
  { id: 'photo',   label: 'Photo du commerce',         description: 'Photo extérieure du point de vente',         required: false },
  { id: 'banque',  label: 'Coordonnées bancaires',     description: 'RIB ou compte Mobile Money de réception',    required: false },
];

export const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  newEnterprise:         true,
  enterpriseValidated:   true,
  enterpriseSuspended:   true,
  documentSubmitted:     true,
  documentExpired:       true,
  orderThresholdReached: false,
  inactivityWarning:     true,
  suspensionAutoTrigger: true,
};

export const DEFAULT_SETTINGS: Omit<CompanySettings, 'updatedAt'> = {
  commissionType:            'percentage',
  commissionValue:           6,
  commissionMin:             500,
  commissionMax:             500_000,
  commissionBrackets:        DEFAULT_BRACKETS,
  validationMode:            'manuel',
  validationDelayH:          48,
  requiredDocuments:         DEFAULT_DOCUMENTS,
  categoryRules:             [],
  monthlyOrderLimit:         500,
  dailyOrderLimit:           50,
  maxProducts:               1000,
  maxActivePromotions:       10,
  maxBranches:               5,
  allowPhysical:             true,
  allowDigital:              false,
  allowServices:             true,
  allowInternational:        false,
  autoSuspensionEnabled:     true,
  suspensionSignalThreshold: 3,
  suspensionLitigeThreshold: 5,
  inactivityDays:            90,
  notifEventsConfig:         DEFAULT_NOTIF_EVENTS,
};

/* ================================================================
 * APPELS API
 * ================================================================ */

export async function getSettings(): Promise<CompanySettings> {
  return apiFetch<CompanySettings>('/company-settings');
}

export async function updateSettings(
  data: Partial<Omit<CompanySettings, 'updatedAt'>>,
): Promise<CompanySettings> {
  return apiFetch<CompanySettings>('/company-settings', {
    method: 'PUT',
    body:   data,
  });
}

export async function getStats(): Promise<CompanyStats> {
  return apiFetch<CompanyStats>('/company-settings/stats');
}

export async function getCategoriesList(): Promise<CategoryItem[]> {
  return apiFetch<CategoryItem[]>('/company-settings/categories-list');
}

/* ── Export local ───────────────────────────────────────────── */

export function exportConfigAsJson(settings: CompanySettings): void {
  const { updatedAt, ...rest } = settings;
  const json = JSON.stringify({
    exportedAt: new Date().toISOString(),
    source:     'Shopi Admin — Configuration Entreprises',
    config:     rest,
  }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `shopi-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportStatsAsCsv(stats: CompanyStats): void {
  const rows: (string | number)[][] = [
    ['Métrique', 'Valeur'],
    ['Total entreprises',  stats.total],
    ['Actives',            stats.active],
    ['En attente',         stats.pending],
    ['Suspendues',         stats.suspended],
    ['Nouvelles ce mois',  stats.newThisMonth],
    ['Vérifiées',          stats.verified],
    ['Premium',            stats.premium],
    ['CA total (GNF)',     stats.totalRevenue],
    ['Commandes totales',  stats.totalOrders],
  ];
  const csv  = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `shopi-stats-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
