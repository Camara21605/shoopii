/* ================================================================
 * FICHIER : profil-correspondant/services/correspondantProfil.api.ts
 *
 * RÔLE : Appels API du profil correspondant.
 *        ✅ Branché sur le vrai endpoint : GET /client/correspondants/:id
 *           (enregistré dans ClientModule côté backend).
 *
 *   Réponse = profil complet réel : identité, KPI, badges, bio,
 *   infos pratiques, horaires, contacts, statut suivi.
 *   Les détails non encore en base (services, zones, tarifs, avis,
 *   galerie) restent fournis par le mock dans le hook.
 * ================================================================ */

import { apiFetch } from '../../../services/apiFetch';
import type { CorrType } from '../data/types';

/* ── Forme renvoyée par GET /client/correspondants/:id ── */
export interface CorrespondantProfilApi {
  id:           string;
  nom:          string;
  initiales:    string;
  type:         CorrType;
  typeLabel:    string;
  localisation: string;
  enLigne:      boolean;
  membreDepuis: string;
  abonnes:      number;
  badges:       { label: string; type: 'verif' | 'assur' | 'top' | 'premium' }[];
  bio:          string[];
  /* KPI */
  missions:     number;
  missionsMois: number;
  note:         number;
  nbAvis:       number;
  fiabilite:    number;
  experience:   string;
  zonesCount:   number;
  delaiMoyen:   string;
  /* Onglet Infos */
  aboutTags:      string[];
  infosPratiques: { icone: string; label: string; valeur: string; sub: string }[];
  horaires:       { jour: string; heures: string; statut: 'open' | 'partial' | 'closed'; statutLabel: string; aujourdhui: boolean }[];
  /* Sidebar */
  contacts:     { icone: string; label: string; valeur: string }[];
  suivi:        boolean;
}

/* ── GET /client/correspondants/:id ── */
export async function fetchCorrespondantProfil(id: string): Promise<CorrespondantProfilApi> {
  return apiFetch<CorrespondantProfilApi>(`/client/correspondants/${id}`);
}

/* ── POST /suivis/correspondants/:id → toggle suivre/désabonner ── */
export async function toggleSuiviCorrespondant(id: string): Promise<{ isSuivi: boolean }> {
  return apiFetch<{ isSuivi: boolean }>(`/suivis/correspondants/${id}`, { method: 'POST' });
}