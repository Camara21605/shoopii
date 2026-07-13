/* ============================================================
 * FICHIER : src/dashboards/administrateur/services/partner-settings.service.ts
 * ============================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Interfaces ──────────────────────────────────────────────── */

export interface PartnerTier {
  id:          string;
  label:       string;
  color:       string;
  icon:        string;
  badge:       string;
  description: string;
  commission:  number;
  objectif:    number;
  bonus:       number;
  minCompanies:number;
  enabled:     boolean;
  order:       number;
}

export interface PartnerBonusRule {
  id:          string;
  label:       string;
  tierId:      string;
  type:        'monthly' | 'quarterly' | 'annual' | 'performance';
  threshold:   number;
  bonusAmount: number;
  enabled:     boolean;
}

export interface PartnerObjective {
  id:      string;
  label:   string;
  metric:  'companies' | 'orders' | 'revenue' | 'deliveries' | 'clients';
  period:  'monthly' | 'quarterly' | 'annual';
  target:  number;
  enabled: boolean;
}

export interface PartnerRewardRule {
  id:        string;
  label:     string;
  type:      'badge' | 'credit' | 'coupon' | 'gift' | 'vip';
  condition: string;
  value:     number;
  enabled:   boolean;
}

export interface PartnerDocument {
  id:          string;
  label:       string;
  description: string;
  required:    boolean;
}

export interface PartnerSettings {
  id:                    number;
  tiers:                 PartnerTier[];
  commissionMode:        string;
  defaultCommissionRate: number;
  validationMode:        string;
  validationDelayH:      number;
  autoRejectExpired:     boolean;
  requiredDocuments:     PartnerDocument[];
  bonusProgramEnabled:   boolean;
  bonusRules:            PartnerBonusRule[];
  objectives:            PartnerObjective[];
  rewardProgramEnabled:  boolean;
  rewardRules:           PartnerRewardRule[];
  paymentFrequency:      string;
  autoTierUpgrade:       boolean;
  autoTierDowngrade:     boolean;
  notifEventsConfig:     Record<string, boolean>;
  updatedAt:             string;
}

export interface PartnerStats {
  total:                   number;
  active:                  number;
  pending:                 number;
  suspended:               number;
  newThisMonth:            number;
  totalCompaniesRecruited: number;
  totalDeliveries:         number;
  totalCorrespondants:     number;
}

/* ── Valeurs par défaut ──────────────────────────────────────── */

export const DEFAULT_TIERS: PartnerTier[] = [
  { id: 'bronze', label: 'Bronze', color: '#cd7f32', icon: 'fa-medal',  badge: '🥉', description: 'Partenaire débutant — 1 à 49 entreprises recrutées.', commission: 5, objectif: 50,  bonus: 10_000, minCompanies: 0,   enabled: true, order: 1 },
  { id: 'silver', label: 'Argent', color: '#9aa0a6', icon: 'fa-medal',  badge: '🥈', description: 'Partenaire confirmé — 50 à 149 entreprises recrutées.', commission: 4, objectif: 150, bonus: 25_000, minCompanies: 50,  enabled: true, order: 2 },
  { id: 'gold',   label: 'Or',     color: '#f7b731', icon: 'fa-crown',  badge: '🥇', description: 'Partenaire élite — 150 entreprises recrutées ou plus.',  commission: 3, objectif: 300, bonus: 50_000, minCompanies: 150, enabled: true, order: 3 },
];

export const DEFAULT_BONUS_RULES: PartnerBonusRule[] = [
  { id: 'monthly_obj',  label: 'Objectif mensuel',  tierId: '*', type: 'monthly',     threshold: 1,   bonusAmount: 0,       enabled: true },
  { id: 'quarter_100', label: 'Cap trimestriel',    tierId: '*', type: 'quarterly',   threshold: 100, bonusAmount: 30_000,  enabled: true },
  { id: 'annual_perf', label: 'Prime annuelle',     tierId: '*', type: 'annual',      threshold: 1,   bonusAmount: 100_000, enabled: true },
];

export const DEFAULT_OBJECTIVES: PartnerObjective[] = [
  { id: 'companies_monthly', label: 'Entreprises recrutées / mois', metric: 'companies', period: 'monthly',   target: 10,        enabled: true  },
  { id: 'orders_monthly',    label: 'Commandes générées / mois',    metric: 'orders',    period: 'monthly',   target: 200,       enabled: true  },
  { id: 'revenue_quarterly', label: 'CA trimestriel (GNF)',         metric: 'revenue',   period: 'quarterly', target: 5_000_000, enabled: false },
];

export const DEFAULT_DOCUMENTS: PartnerDocument[] = [
  { id: 'id_card',    label: 'Pièce d\'identité',          description: 'CNI ou passeport en cours de validité.',  required: true  },
  { id: 'proof_addr', label: 'Justificatif de domicile',   description: 'Facture ou attestation récente.',          required: true  },
  { id: 'contract',   label: 'Contrat de partenariat',     description: 'Document signé des deux parties.',         required: true  },
  { id: 'rib',        label: 'RIB / Coordonnées bancaires',description: 'Pour virement des commissions.',           required: false },
];

export const DEFAULT_REWARD_RULES: PartnerRewardRule[] = [
  { id: 'first_10',  label: '10 premières entreprises', type: 'badge',  condition: 'totalCompanies >= 10',  value: 0,      enabled: true },
  { id: 'credit_50', label: 'Crédit à 50 entreprises',  type: 'credit', condition: 'totalCompanies >= 50',  value: 20_000, enabled: true },
  { id: 'vip_150',   label: 'Statut VIP à 150',          type: 'vip',    condition: 'totalCompanies >= 150', value: 0,      enabled: true },
];

export const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  partnerRegistered: true,
  partnerValidated:  true,
  partnerSuspended:  true,
  tierUpgrade:       true,
  tierDowngrade:     false,
  bonusEarned:       true,
  objectiveReached:  true,
  rewardUnlocked:    true,
  paymentSent:       true,
  documentExpired:   true,
};

export const DEFAULT_SETTINGS: PartnerSettings = {
  id: 1,
  tiers:                 DEFAULT_TIERS,
  commissionMode:        'tier',
  defaultCommissionRate: 5,
  validationMode:        'manuel',
  validationDelayH:      24,
  autoRejectExpired:     false,
  requiredDocuments:     DEFAULT_DOCUMENTS,
  bonusProgramEnabled:   true,
  bonusRules:            DEFAULT_BONUS_RULES,
  objectives:            DEFAULT_OBJECTIVES,
  rewardProgramEnabled:  true,
  rewardRules:           DEFAULT_REWARD_RULES,
  paymentFrequency:      'monthly',
  autoTierUpgrade:       true,
  autoTierDowngrade:     false,
  notifEventsConfig:     DEFAULT_NOTIF_EVENTS,
  updatedAt:             new Date().toISOString(),
};

/* ── API calls ───────────────────────────────────────────────── */

export async function getPartnerSettings(): Promise<PartnerSettings> {
  return apiFetch<PartnerSettings>('/partner-settings');
}

export async function updatePartnerSettings(
  payload: Partial<Omit<PartnerSettings, 'id' | 'updatedAt'>>,
): Promise<PartnerSettings> {
  return apiFetch<PartnerSettings>('/partner-settings', { method: 'PUT', body: payload });
}

export async function getPartnerStats(): Promise<PartnerStats> {
  return apiFetch<PartnerStats>('/partner-settings/stats');
}

/* ── Export helpers ──────────────────────────────────────────── */

export function exportPartnerConfigAsJson(settings: PartnerSettings): void {
  const { updatedAt, ...rest } = settings;
  const json = JSON.stringify(
    { exportedAt: new Date().toISOString(), source: 'Shopi Admin — Configuration Partenaires', config: rest },
    null,
    2,
  );
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `shopi-partenaires-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPartnerStatsAsCsv(stats: PartnerStats): void {
  const rows: (string | number)[][] = [
    ['Indicateur', 'Valeur'],
    ['Total partenaires',           stats.total],
    ['Actifs',                      stats.active],
    ['En attente',                  stats.pending],
    ['Suspendus',                   stats.suspended],
    ['Nouveaux ce mois',            stats.newThisMonth],
    ['Entreprises recrutées (total)',stats.totalCompaniesRecruited],
    ['Livreurs recrutés (total)',   stats.totalDeliveries],
    ['Correspondants (total)',      stats.totalCorrespondants],
  ];
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `shopi-partenaires-stats-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
