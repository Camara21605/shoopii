/* ================================================================
 * FICHIER : src/modules/home/components/profil-correspondant/data/types.ts
 *
 * Types du profil correspondant (route /correspondants/:id).
 * ================================================================ */

export type CorrType = 'regional' | 'zonal' | 'national';
export type ProfilTab = 'info' | 'services' | 'zones' | 'tarifs' | 'avis' | 'galerie';

/* ── Identité + KPI ── */
export interface CorrProfil {
  id:           string;
  nom:          string;
  initiales:    string;
  type:         CorrType;
  typeLabel:    string;            // "Correspondant Régional"
  localisation: string;
  enLigne:      boolean;
  membreDepuis: string;
  abonnes:      number;
  badges:       { label: string; type: 'verif' | 'assur' | 'top' | 'premium' }[];
  bio:          string[];          // paragraphes "À propos"
  /* KPI */
  missions:     number;
  missionsMois: number;
  note:         number;
  nbAvis:       number;
  fiabilite:    number;
  experience:   string;
  zonesCount:   number;
  delaiMoyen:   string;
}

/* ── Onglet Infos ── */
export interface InfoPratique { icone: string; label: string; valeur: string; sub: string; }
export interface ScheduleRow  { jour: string; heures: string; statut: 'open' | 'partial' | 'closed'; statutLabel: string; aujourdhui?: boolean; }

/* ── Onglet Services ── */
export interface Service { emoji: string; nom: string; desc: string; prix: string; }

/* ── Onglet Zones ── */
export interface ZoneCard { nom: string; detail: string; badge: string; badgeType: 'main' | 'sec' | 'partner'; }
export interface PaysPartenaire { flag: string; nom: string; villes: string; }

/* ── Onglet Tarifs ── */
export interface TarifRow { service: string; sub: string; prix: string; note: string; }

/* ── Onglet Avis ── */
export interface AvisScore { moyenne: number; total: number; repartition: { etoiles: number; count: number; pct: number }[]; keywords: { mot: string; count: number }[]; }
export interface AvisItem {
  id: string; initiales: string; nom: string; note: number; date: string; verifie: boolean;
  texte: string; utile: number;
  reponse?: { auteur: string; texte: string };
}

/* ── Galerie ── */
export interface GalerieItem { emoji: string; label?: string; principale?: boolean; }

/* ── Sidebar ── */
export interface ContactRow { icone: string; label: string; valeur: string; }
export interface VerifRow    { label: string; sub: string; }
export interface SimilaireItem { id: string; initiales: string; nom: string; meta: string; note: number; suivi: boolean; }