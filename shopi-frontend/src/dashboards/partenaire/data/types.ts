/* ================================================================
 * FICHIER : src/dashboards/partenaire/data/types.ts
 *
 * Types du dashboard partenaire.
 * Le partenaire recrute des acteurs (entreprise, livreur,
 * correspondant, client) via des codes de création de compte,
 * pilote son réseau, suit ses commissions et signale les
 * utilisateurs malveillants.
 * ================================================================ */

/* Page active du dashboard (pattern activePage + PageRenderer) */
export type PartenairePage =
  | 'overview'
  | 'codes'
  | 'acteurs'
  | 'invitations'
  | 'commissions'
  | 'paiements'
  | 'stats'
  | 'signalements'
  | 'parametres';

/* Type d'acteur recrutable */
export type ActeurType = 'ent' | 'lvr' | 'cor' | 'cli';

/* Statut d'un code de création */
export type CodeStatut = 'used' | 'sent' | 'expired';

/* Statut d'un acteur recruté */
export type ActeurStatut = 'act' | 'pend';

/* Un code de création de compte */
export interface CreationCode {
  id:           string;
  code:         string;          // ex. "SHOPI-ENT-7K2M9"
  type:         ActeurType;
  destinataire: string | null;
  statut:       CodeStatut;
  creeLe:       string;
}

/* Un acteur recruté par le partenaire */
export interface ActeurRecrute {
  id:      string;
  type:    ActeurType;
  nom:     string;
  meta:    string;               // "Entreprise · Kaloum"
  avatar:  string;               // initiales
  statut:  ActeurStatut;
  stat1:   { valeur: string; label: string };
  stat2:   { valeur: string; label: string };
  commission: string;            // "285K GNF/mois" ou "En attente"
}

/* Gravité d'un signalement */
export type Gravite = 'low' | 'med' | 'high';

/* Statut de traitement d'un signalement */
export type SignalementStatut = 'review' | 'invest' | 'resolved' | 'rejected';

/* Motif de signalement */
export type MotifSignalement = 'fraude' | 'faux' | 'contrefacon' | 'abus' | 'autre';

/* Un signalement émis par le partenaire */
export interface Signalement {
  id:       string;              // "RPT-00412"
  cible:    string;              // utilisateur signalé
  type:     ActeurType;
  motif:    MotifSignalement;
  motifLabel: string;
  gravite:  Gravite;
  raison:   string;
  statut:   SignalementStatut;
  date:     string;
}

/* Une commission perçue */
export interface CommissionLigne {
  source:  string;
  type:    ActeurType;
  detail:  string;
  date:    string;
  montant: number;
}

/* KPI d'en-tête */
export interface Kpi {
  cle:    string;
  valeur: string;
  unite?: string;
  label:  string;
  delta?: string;
  trend?: 'up' | 'down';
}
