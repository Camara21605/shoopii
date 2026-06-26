/* ================================================================
 * FICHIER : src/modules/home/components/correspondants/services/correspondants.api.ts
 *
 * RÔLE : Appels API de la page correspondants.
 *        Réutilise les endpoints suivis existants :
 *          GET  /suivis/correspondants        → liste + isSuivi (+ filtres)
 *          POST /suivis/correspondants/:id     → toggle suivre/désabonner
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { Correspondant, CorrType } from '../data/types';

/* ── Forme brute renvoyée par le backend (getCorrespondantsWithSuiviStatus) ── */
interface CorrespondantApi {
  id:                string;
  fullName:          string;
  profilePicture:    string | null;
  region:            string;
  typeCorrespondant: CorrType;
  bio:               string | null;
  totalMissions:     number;
  averageRating:     number;
  online:            boolean;
  isSuivi:           boolean;
  /* Champs enrichis (optionnels selon version backend) */
  nbAvis?:           number;
  fiabilite?:        number;
  experience?:       string;
  commune?:          string;
}

/* ── Filtres acceptés par l'API ── */
export interface CorrFilters {
  commune?: string;
  ville?:   string;
  type?:    CorrType;
  online?:  boolean;
}

/* Calcule les initiales depuis un nom complet */
function initiales(nom: string): string {
  const parts = nom.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'CO';
}

/* Adapte la réponse API → type d'affichage Correspondant */
function adapt(c: CorrespondantApi): Correspondant {
  return {
    id:         c.id,
    nom:        c.fullName || 'Correspondant',
    initiales:  initiales(c.fullName || 'CO'),
    zone:       c.region || 'Conakry',
    commune:    (c.commune ?? c.region ?? '').toLowerCase(),
    bio:        c.bio ?? 'Correspondant Shopi vérifié.',
    type:       c.typeCorrespondant ?? 'regional',
    note:       Number(c.averageRating ?? 0),
    nbAvis:     c.nbAvis ?? 0,
    missions:   c.totalMissions ?? 0,
    fiabilite:  c.fiabilite ?? 0,
    experience: c.experience ?? '—',
    enLigne:    !!c.online,
    suivi:      !!c.isSuivi,
  };
}

/* ── GET /suivis/correspondants ── */
export async function fetchCorrespondants(filters?: CorrFilters): Promise<Correspondant[]> {
  const data = await apiFetch<CorrespondantApi[]>('/suivis/correspondants', {
    params: {
      commune: filters?.commune,
      ville:   filters?.ville,
      type:    filters?.type,
      online:  filters?.online,
    },
  });
  return (data ?? []).map(adapt);
}

/* ── POST /suivis/correspondants/:id → toggle ── */
export async function toggleSuiviCorrespondant(id: string): Promise<{ isSuivi: boolean }> {
  return apiFetch<{ isSuivi: boolean }>(`/suivis/correspondants/${id}`, { method: 'POST' });
}