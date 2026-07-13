/* ================================================================
 * FICHIER : src/dashboards/administrateur/services/validation-config.service.ts
 *
 * RÔLE : Client API pour le moteur de validation.
 *   - Lire et mettre à jour la configuration globale
 *   - Récupérer les statistiques de validation par acteur
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types ──────────────────────────────────────────────────── */

export type ValidationMode = 'auto' | 'manuel' | 'hybride' | 'score';

export interface ActorRule {
  auto:     boolean;
  delaiH:   number;
  scoreMin: number;
  docs:     string[];
  actif:    boolean;
}

export interface ValidationConfig {
  modeGlobal:        ValidationMode;
  delaiExpirationH:  number;
  scoreMinAuto:      number;
  notifEmailEnabled: boolean;
  notifSmsEnabled:   boolean;
  notifPushEnabled:  boolean;
  notifAdminEnabled: boolean;
  reglesActeurs:     Record<string, ActorRule>;
  updatedAt:         string;
}

export interface ValidationStatRow {
  role:     string;
  label:    string;
  actif:    number;
  pending:  number;
  suspendu: number;
  total:    number;
}

export interface ValidationStats {
  byRole: ValidationStatRow[];
  totaux: {
    actif:    number;
    pending:  number;
    suspendu: number;
    total:    number;
  };
}

/* ── Valeurs par défaut (affichage offline / avant premier load) */

export const DEFAULT_ACTOR_RULES: Record<string, ActorRule> = {
  company:       { auto: false, delaiH: 48, scoreMin: 80, actif: true, docs: ['RCCM', 'CNI', 'Contrat Shopi'] },
  partner:       { auto: false, delaiH: 24, scoreMin: 75, actif: true, docs: ['CNI', 'Justificatif local'] },
  delivery:      { auto: true,  delaiH: 12, scoreMin: 70, actif: true, docs: ['CNI', 'Permis de conduire'] },
  correspondent: { auto: true,  delaiH: 6,  scoreMin: 65, actif: true, docs: ['CNI'] },
};

export const ACTOR_META: Record<string, { label: string; icon: string; color: string }> = {
  company:       { label: 'Entreprises',    icon: 'fa-store',      color: 'var(--blue)' },
  partner:       { label: 'Partenaires',    icon: 'fa-handshake',  color: 'var(--violet)' },
  delivery:      { label: 'Livreurs',       icon: 'fa-motorcycle', color: 'var(--teal)' },
  correspondent: { label: 'Correspondants', icon: 'fa-person',     color: 'var(--emerald)' },
};

/** Les 4 types d'acteurs liés à un admin (les clients s'inscrivent librement) */
export const ACTOR_ORDER = ['company', 'partner', 'delivery', 'correspondent'];

export const DEFAULT_CONFIG: Omit<ValidationConfig, 'updatedAt'> = {
  modeGlobal:        'manuel',
  delaiExpirationH:  48,
  scoreMinAuto:      75,
  notifEmailEnabled: true,
  notifSmsEnabled:   false,
  notifPushEnabled:  true,
  notifAdminEnabled: true,
  reglesActeurs:     DEFAULT_ACTOR_RULES,   // clients exclus : pas liés à un admin
};

/* ================================================================
 * APPELS API
 * ================================================================ */

export async function getConfig(): Promise<ValidationConfig> {
  return apiFetch<ValidationConfig>('/validation-config');
}

export async function updateConfig(
  data: Partial<Omit<ValidationConfig, 'updatedAt'>>,
): Promise<ValidationConfig> {
  return apiFetch<ValidationConfig>('/validation-config', {
    method: 'PUT',
    body:   data,
  });
}

export async function getStats(): Promise<ValidationStats> {
  return apiFetch<ValidationStats>('/validation-config/stats');
}
