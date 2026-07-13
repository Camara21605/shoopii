/* ============================================================
 * FICHIER : src/dashboards/administrateur/services/delivery-settings.service.ts
 * ============================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Interfaces ──────────────────────────────────────────────── */

export interface BonusRule {
  id: string;
  label: string;
  type: 'daily' | 'weekly' | 'monthly';
  deliveriesRequired: number;
  bonusAmount: number;
  enabled: boolean;
}

export interface PenaltyRule {
  id: string;
  trigger: string;
  threshold: number;
  action: 'warning' | 'score_reduction' | 'suspend_temp' | 'suspend_perm';
  value: number;
  enabled: boolean;
}

export interface VehicleRule {
  type: string;
  icon: string;
  label: string;
  maxWeightKg: number;
  maxDistanceKm: number;
  enabled: boolean;
}

export interface DeliverySettings {
  id: number;
  /* Assignation */
  assignmentStrategy: string;
  autoAssignEnabled: boolean;
  acceptDeadlineMin: number;
  maxSimultaneousOrders: number;
  reassignTimeoutMin: number;
  /* Zones */
  maxRadiusKm: number;
  maxDeliveryDistanceKm: number;
  /* Score */
  minScore: number;
  suspensionScoreThreshold: number;
  reactivationScoreThreshold: number;
  scoreWeights: Record<string, number>;
  /* Bonus */
  bonusProgramEnabled: boolean;
  bonusRules: BonusRule[];
  /* Pénalités */
  autoPenaltyEnabled: boolean;
  penaltyRules: PenaltyRule[];
  /* Véhicules */
  vehicleRules: VehicleRule[];
  /* Paiement */
  paymentFrequency: string;
  platformCommissionRate: number;
  /* Notifications */
  notifEventsConfig: Record<string, boolean>;
  updatedAt: string;
}

export interface DeliveryStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  banned: number;
  available: number;
  onDelivery: number;
  offline: number;
  newThisMonth: number;
  totalDeliveries: number;
  avgRating: number;
  avgPonctualite: number;
  totalEarnings: number;
  verified: number;
}

/* ── Valeurs par défaut (miroir backend) ────────────────────── */

export const DEFAULT_SCORE_WEIGHTS: Record<string, number> = {
  ponctualite:      30,
  noteClients:      25,
  tauxReussite:     20,
  volumeLivraisons: 15,
  absenceIncidents: 10,
};

export const DEFAULT_BONUS_RULES: BonusRule[] = [
  { id: 'daily_20',    label: 'Bonus journalier',   type: 'daily',   deliveriesRequired: 20,  bonusAmount: 5_000,   enabled: true },
  { id: 'weekly_100',  label: 'Bonus hebdomadaire',  type: 'weekly',  deliveriesRequired: 100, bonusAmount: 30_000,  enabled: true },
  { id: 'monthly_400', label: 'Bonus mensuel',        type: 'monthly', deliveriesRequired: 400, bonusAmount: 150_000, enabled: true },
];

export const DEFAULT_PENALTY_RULES: PenaltyRule[] = [
  { id: 'refus_3',   trigger: 'Refus répétés',      threshold: 3, action: 'warning',        value: 0,  enabled: true },
  { id: 'retard_5',  trigger: 'Retards répétés',     threshold: 5, action: 'score_reduction', value: 10, enabled: true },
  { id: 'abandon_2', trigger: 'Abandon de commande', threshold: 2, action: 'suspend_temp',    value: 7,  enabled: true },
  { id: 'fraude_1',  trigger: 'Fraude / Faux GPS',   threshold: 1, action: 'suspend_perm',    value: 0,  enabled: true },
  { id: 'plainte_5', trigger: 'Plaintes clients',     threshold: 5, action: 'score_reduction', value: 15, enabled: true },
];

export const DEFAULT_VEHICLE_RULES: VehicleRule[] = [
  { type: 'moto',     icon: '🛵', label: 'Moto',     maxWeightKg: 30,   maxDistanceKm: 50,  enabled: true  },
  { type: 'voiture',  icon: '🚗', label: 'Voiture',  maxWeightKg: 100,  maxDistanceKm: 100, enabled: true  },
  { type: 'velo',     icon: '🚲', label: 'Vélo',     maxWeightKg: 15,   maxDistanceKm: 15,  enabled: true  },
  { type: 'tricycle', icon: '🛺', label: 'Tricycle', maxWeightKg: 200,  maxDistanceKm: 30,  enabled: true  },
  { type: 'camion',   icon: '🚚', label: 'Camion',   maxWeightKg: 2000, maxDistanceKm: 200, enabled: false },
  { type: 'pieton',   icon: '🚶', label: 'À pied',   maxWeightKg: 10,   maxDistanceKm: 5,   enabled: false },
];

export const DEFAULT_NOTIF_EVENTS: Record<string, boolean> = {
  deliveryAssigned:  true,
  deliveryCompleted: true,
  deliverySuspended: true,
  bonusEarned:       true,
  penaltyApplied:    true,
  scoreChanged:      false,
  paymentSent:       true,
  newZone:           true,
};

export const DEFAULT_SETTINGS: DeliverySettings = {
  id: 1,
  assignmentStrategy: 'nearest',
  autoAssignEnabled: true,
  acceptDeadlineMin: 3,
  maxSimultaneousOrders: 5,
  reassignTimeoutMin: 10,
  maxRadiusKm: 15,
  maxDeliveryDistanceKm: 30,
  minScore: 60,
  suspensionScoreThreshold: 40,
  reactivationScoreThreshold: 55,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  bonusProgramEnabled: true,
  bonusRules: DEFAULT_BONUS_RULES,
  autoPenaltyEnabled: true,
  penaltyRules: DEFAULT_PENALTY_RULES,
  vehicleRules: DEFAULT_VEHICLE_RULES,
  paymentFrequency: 'weekly',
  platformCommissionRate: 15,
  notifEventsConfig: DEFAULT_NOTIF_EVENTS,
  updatedAt: new Date().toISOString(),
};

/* ── API calls ───────────────────────────────────────────────── */

export async function getDeliverySettings(): Promise<DeliverySettings> {
  return apiFetch<DeliverySettings>('/delivery-settings');
}

export async function updateDeliverySettings(
  payload: Partial<Omit<DeliverySettings, 'id' | 'updatedAt'>>,
): Promise<DeliverySettings> {
  return apiFetch<DeliverySettings>('/delivery-settings', { method: 'PUT', body: payload });
}

export async function getDeliveryStats(): Promise<DeliveryStats> {
  return apiFetch<DeliveryStats>('/delivery-settings/stats');
}

/* ── Export helpers ──────────────────────────────────────────── */

export function exportDeliveryConfigAsJson(settings: DeliverySettings): void {
  const { updatedAt, ...rest } = settings;
  const json = JSON.stringify(
    { exportedAt: new Date().toISOString(), source: 'Shopi Admin — Configuration Livreurs', config: rest },
    null,
    2,
  );
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shopi-livreurs-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDeliveryStatsAsCsv(stats: DeliveryStats): void {
  const rows = [
    ['Indicateur', 'Valeur'],
    ['Total livreurs',         stats.total],
    ['Actifs',                 stats.active],
    ['En attente',             stats.pending],
    ['Suspendus',              stats.suspended],
    ['Bannis',                 stats.banned],
    ['Disponibles',            stats.available],
    ['En livraison',           stats.onDelivery],
    ['Hors ligne',             stats.offline],
    ['Nouveaux ce mois',       stats.newThisMonth],
    ['Total livraisons',       stats.totalDeliveries],
    ['Note moyenne',           stats.avgRating.toFixed(1)],
    ['Ponctualité moyenne (%)',stats.avgPonctualite.toFixed(1)],
    ['Gains totaux (GNF)',     stats.totalEarnings],
    ['Vérifiés',               stats.verified],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shopi-livreurs-stats-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
