/* ================================================================
 * FICHIER : src/dashboards/administrateur/data/types.ts
 *
 * Types du dashboard administrateur de zone.
 * L'admin contrôle SA ZONE : codes de création (y compris
 * partenaires), validations de comptes, modération des
 * signalements, commandes, finances et journal d'audit.
 * ================================================================ */

/* Page active (pattern activePage + PageRenderer) */
export type AdminPage =
  | 'overview'
  | 'codes'
  | 'partenaires'
  | 'acteurs'
  | 'validations'
  | 'signalements'
  | 'commandes'
  | 'finances'
  | 'audit'
  | 'geo'
  | 'parametres';

/* Types d'acteurs que l'admin peut créer (partenaire inclus) */
export type ActeurType = 'par' | 'ent' | 'lvr' | 'cor';

/* Statut d'un code de création */
export type CodeStatut = 'used' | 'sent' | 'expired';

/* Statut d'un acteur de la zone */
export type ActeurStatut = 'act' | 'pend' | 'susp';

/* Un code de création émis par l'admin */
export interface CreationCode {
  id:           string;
  code:         string;          // ex. "SHOPI-PAR-8Q4W2"
  type:         ActeurType;
  destinataire: string | null;
  statut:       CodeStatut;
  creeLe:       string;
}

/* Un acteur rattaché à la zone */
export interface ZoneActeur {
  id:        string;
  type:      ActeurType;
  nom:       string;
  telephone: string;
  commune:   string;
  recrutePar: string;            // partenaire ou "Admin (vous)"
  activite:  string;             // "2,4M GNF/mois", "1 240 courses"…
  statut:    ActeurStatut;
  avatar:    string;
}

/* Palier d'un partenaire */
export type PartenaireTier = 'or' | 'arg' | 'brz';

/* Un partenaire de la zone */
export interface PartenaireZone {
  id:         string;
  nom:        string;
  avatar:     string;
  commune:    string;
  depuis:     string;
  tier:       PartenaireTier;
  recrues:    number;
  conversion: number;            // en %
  confiance:  number;            // /100
  statut:     'act' | 'pend';
}

/* Un compte en attente de validation */
export interface ValidationItem {
  id:         string;
  nom:        string;
  avatar:     string;
  type:       ActeurType;
  description: string;
  commune:    string;
  quand:      string;
  recrutePar: string;
}

/* Signalement reçu (à traiter par l'admin) */
export type Gravite = 'low' | 'med' | 'high';
export type SignalementStatut = 'review' | 'invest' | 'resolved' | 'rejected';

export interface SignalementRecu {
  id:         string;            // "RPT-00412"
  cible:      string;
  avatar:     string;
  type:       ActeurType;
  gravite:    Gravite;
  motifLabel: string;
  raison:     string;
  signalePar: string;
  statut:     SignalementStatut;
  quand:      string;
}

/* Commande de la zone */
export type CommandeStatut = 'paid' | 'prep' | 'ship' | 'relay' | 'done' | 'dispute';

export interface Commande {
  id:         string;            // "#CMD-88412"
  quand:      string;
  client:     string;
  entreprise: string;
  montant:    number;            // en GNF
  progression: 0 | 1 | 2 | 3 | 4; // étapes validées de la chaîne
  statut:     CommandeStatut;
}

/* Flux financier de la zone */
export interface FluxFinancier {
  id:      string;
  sens:    'in' | 'out' | 'refund';
  libelle: string;
  quand:   string;
  montant: number;               // signé, en GNF
}

/* Entrée du journal d'audit */
export type AuditKind = 'code' | 'ok' | 'warn' | 'ban';

export interface AuditEntry {
  id:     string;                // "AUD-10248"
  kind:   AuditKind;
  texte:  string;                // peut contenir du <b> (données internes)
  auteur: string;
  quand:  string;
}

/* KPI générique */
export interface Kpi {
  cle:    string;
  valeur: string;
  unite?: string;
  label:  string;
  delta?: string;
  trend?: 'up' | 'down';
}
