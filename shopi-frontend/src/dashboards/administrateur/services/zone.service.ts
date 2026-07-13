/* ================================================================
 * FICHIER : src/dashboards/administrateur/services/zone.service.ts
 *
 * RÔLE : Client API pour le centre de contrôle territorial.
 *   - Récupère l'identité de la zone, les statistiques, la couverture
 *   - Gère les préférences d'alertes (lecture + sauvegarde)
 *   - Typage fort — aucune donnée codée en dur
 * ================================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types réponse ──────────────────────────────────────────── */

export interface ZoneCommune {
  id:   string;
  nom:  string;
  code: string;
}

export interface ZoneInfo {
  zoneId:         string | null;
  nom:            string;
  code:           string;
  statut:         'actif' | 'inactif';
  couvertureType: string;
  rayonKm:        number;
  adminNom:       string;
  adminId:        string;
  synchroAt:      string;
  communeCount:   number;
  communes:       ZoneCommune[];
  latitude:       number | null;
  longitude:      number | null;
}

export interface ZoneStatistiques {
  partenaires:         number;
  entreprises:         number;
  livreurs:            number;
  correspondants:      number;
  clients:             number;
  commandes:           number;
  commandesJour:       number;
  commandesTerminees:  number;
  commandesAnnulees:   number;
  livraisonsEnCours:   number;
  litigesOuverts:      number;
  signalementsActifs:  number;
  acteurTotal:         number;
  sante:               number;
}

export interface CommuneCouverture {
  id:          string;
  nom:         string;
  code:        string;
  pct:         number;
  acteurs:     number;
  livreurs:    number;
  entreprises: number;
  clients:     number;
  commandes:   number;
  croissance:  number;
  sante:       'good' | 'medium' | 'low';
  latitude:    number | null;
  longitude:   number | null;
}

export interface ZoneActeurs {
  partenaires:        number;
  entreprises:        number;
  livreurs:           number;
  correspondants:     number;
  clients:            number;
  commandes:          number;
  litigesOuverts:     number;
  signalementsActifs: number;
}

export type AlertPreferences = Record<string, boolean>;

/* ── Préférences par défaut (utilisées si le backend ne répond pas) */
export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  grave:               true,
  validation:          true,
  litige:              false,
  nouvelleEntreprise:  false,
  nouveauPartenaire:   false,
  nouveauLivreur:      false,
  commandeImportante:  false,
  hausseInhabituelle:  false,
  baisseVentes:        false,
  signalementCritique: true,
  paiementEchoue:      false,
  livreurInactif:      false,
  tentativeFraude:     true,
};

/* ================================================================
 * APPELS API
 * ================================================================ */

export async function getMyZone(): Promise<ZoneInfo> {
  return apiFetch<ZoneInfo>('/zones/me');
}

export async function getStatistiques(): Promise<ZoneStatistiques> {
  return apiFetch<ZoneStatistiques>('/zones/statistiques');
}

export async function getActeurs(): Promise<ZoneActeurs> {
  return apiFetch<ZoneActeurs>('/zones/acteurs');
}

export async function getCouverture(): Promise<CommuneCouverture[]> {
  return apiFetch<CommuneCouverture[]>('/zones/couverture');
}

export async function getPreferences(): Promise<AlertPreferences> {
  return apiFetch<AlertPreferences>('/zones/preferences');
}

export async function updatePreferences(
  prefs: Partial<AlertPreferences>,
): Promise<AlertPreferences> {
  return apiFetch<AlertPreferences>('/zones/preferences', {
    method: 'PATCH',
    body:   prefs,
  });
}

/** Charge toutes les données de la zone en parallèle */
export async function refreshZone(): Promise<{
  info:         ZoneInfo;
  stats:        ZoneStatistiques;
  couverture:   CommuneCouverture[];
  alertPrefs:   AlertPreferences;
}> {
  const [info, stats, couverture, alertPrefs] = await Promise.all([
    getMyZone(),
    getStatistiques(),
    getCouverture(),
    getPreferences(),
  ]);
  return { info, stats, couverture, alertPrefs };
}
