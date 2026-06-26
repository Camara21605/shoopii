/* ================================================================
 * FICHIER : src/modules/dashboard/client/dto/correspondant-profil.response.ts
 *
 * RÔLE : Contrat de réponse de GET /correspondants/:id
 *        Forme exacte attendue par le frontend (profil-correspondant).
 *
 * On expose UNIQUEMENT des données publiques (jamais : password,
 * twoFaSecret, documents privés, paramètres internes).
 * ================================================================ */

/* Portée géographique */
export type CorrTypeDto = 'regional' | 'zonal' | 'national';

/* Badge d'identité affiché sous le nom */
export interface BadgeDto {
  label: string;
  type:  'verif' | 'assur' | 'top' | 'premium';
}

/* Une ligne d'horaire */
export interface HoraireDto {
  jour:        string;   // "Lundi", "Mardi"...
  heures:      string;   // "08h00 – 20h00" ou "Sur rendez-vous"
  statut:      'open' | 'partial' | 'closed';
  statutLabel: string;   // "Ouvert", "Partiel", "RDV seul."
  aujourdhui:  boolean;
}

/* Info pratique (grille de l'onglet Infos) */
export interface InfoPratiqueDto {
  icone:  string;        // classe FontAwesome sans le préfixe (ex: "fa-phone")
  label:  string;
  valeur: string;
  sub:    string;
}

/* Réponse complète */
export class CorrespondantProfilResponse {
  /* ── Identité ── */
  id:           string;
  nom:          string;
  initiales:    string;
  type:         CorrTypeDto;
  typeLabel:    string;          // "Correspondant Régional"
  localisation: string;
  enLigne:      boolean;
  membreDepuis: string;          // "Partenaire depuis jan. 2021"
  abonnes:      number;
  badges:       BadgeDto[];
  bio:          string[];        // paragraphes

  /* ── KPI ── */
  missions:     number;
  missionsMois: number;
  note:         number;
  nbAvis:       number;
  fiabilite:    number;
  experience:   string;          // "4 ans"
  zonesCount:   number;
  delaiMoyen:   string;          // "< 2h"

  /* ── Onglet Infos ── */
  aboutTags:      string[];
  infosPratiques: InfoPratiqueDto[];
  horaires:       HoraireDto[];

  /* ── Contacts (sidebar) ── */
  contacts: { icone: string; label: string; valeur: string }[];

  /* ── Statut de suivi par l'utilisateur courant ── */
  suivi: boolean;
}