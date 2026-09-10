/* ================================================================
 * FICHIER : src/dashboards/partenaire/data/parametresData.ts
 *
 * Données statiques des paramètres du dashboard partenaire.
 * Définit les sections et leurs métadonnées pour ParamNav.
 * ================================================================ */

/* ── Section active (identifiant de la section) ── */
export type SectionId =
  | 'profil'
  | 'paiement'
  | 'parrainage'
  | 'documents'
  | 'zone'
  | 'notifications'
  | 'securite'
  | 'confidentialite'
  | 'preferences'
  | 'danger';

/* ── Groupe d'appartenance dans la nav — id stable, le libellé affiché
 * vient de t('partenaireParametres.nav.groups.<id>') (voir ParamNav.tsx). */
export type NavGroupId = 'identite' | 'activite' | 'finances' | 'compte';

/* ── Définition d'un item de navigation ── */
export interface NavItem {
  id:        SectionId;
  icon:      string;      // classe Font Awesome sans "fas "
  /** Clé i18n sous partenaireParametres.nav.items — voir ParamNav.tsx */
  labelKey:  SectionId;
  group:     NavGroupId;  // groupe d'appartenance dans la nav
  isDanger?: boolean;     // si true → couleur rouge
}

/* Ordre et configuration de la navigation */
export const NAV_ITEMS: NavItem[] = [
  /* Identité */
  { id: 'profil',          icon: 'fa-user',            labelKey: 'profil',          group: 'identite' },
  { id: 'documents',       icon: 'fa-id-card',          labelKey: 'documents',       group: 'identite' },

  /* Activité */
  { id: 'zone',            icon: 'fa-location-dot',     labelKey: 'zone',            group: 'activite' },
  { id: 'parrainage',      icon: 'fa-share-nodes',      labelKey: 'parrainage',      group: 'activite' },

  /* Finances */
  { id: 'paiement',        icon: 'fa-wallet',           labelKey: 'paiement',        group: 'finances' },

  /* Compte */
  { id: 'notifications',   icon: 'fa-bell',             labelKey: 'notifications',   group: 'compte' },
  { id: 'securite',        icon: 'fa-lock',             labelKey: 'securite',        group: 'compte' },
  { id: 'confidentialite', icon: 'fa-user-shield',      labelKey: 'confidentialite', group: 'compte' },
  { id: 'preferences',     icon: 'fa-sliders',          labelKey: 'preferences',     group: 'compte' },
  { id: 'danger',          icon: 'fa-triangle-exclamation', labelKey: 'danger',      group: 'compte', isDanger: true },
];
