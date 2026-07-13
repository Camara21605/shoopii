/* ================================================================
 * FICHIER : pages/parametres/types.ts
 * Types partagés par toutes les sections de Paramètres Admin.
 * ================================================================ */

/** 16 sections du centre de configuration */
export type ParamSection =
  | 'profil'
  | 'zone'
  | 'validations'
  | 'notifications'
  | 'securite'
  | 'entreprises'
  | 'livreurs'
  | 'partenaires'
  | 'finances'
  | 'communication'
  | 'journal'
  | 'apparence'
  | 'sauvegarde'
  | 'confidentialite'
  | 'avance'
  | 'sante';

/** Prop commune à toutes les sections */
export interface SectionProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

/** Statut d'un service de santé */
export type HealthStatus = 'ok' | 'warn' | 'err';

export interface ServiceHealth {
  id:      string;
  nom:     string;
  icon:    string;
  pct:     number;
  statut:  HealthStatus;
  check:   string;
}

/** Entrée du journal d'activité */
export type JournalKind = 'ok' | 'code' | 'warn' | 'ban';
export interface JournalEntry {
  id:      string;
  kind:    JournalKind;
  texte:   string;
  auteur:  string;
  ip:      string;
  device:  string;
  quand:   string;
}

/** Session active */
export interface Session {
  id:       string;
  device:   string;
  icon:     string;
  browser:  string;
  ip:       string;
  lieu:     string;
  quand:    string;
  current:  boolean;
}

/** Sauvegarde */
export interface Backup {
  id:    string;
  nom:   string;
  taille: string;
  quand: string;
  auto:  boolean;
}
