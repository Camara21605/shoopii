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

/* ── Définition d'un item de navigation ── */
export interface NavItem {
  id:        SectionId;
  icon:      string;      // classe Font Awesome sans "fas "
  label:     string;
  group:     string;      // groupe d'appartenance dans la nav
  isDanger?: boolean;     // si true → couleur rouge
}

/* Ordre et configuration de la navigation */
export const NAV_ITEMS: NavItem[] = [
  /* Identité */
  { id: 'profil',          icon: 'fa-user',            label: 'Profil',              group: 'Identité'      },
  { id: 'documents',       icon: 'fa-id-card',          label: 'Vérification',        group: 'Identité'      },

  /* Activité */
  { id: 'zone',            icon: 'fa-location-dot',     label: "Zone d'activité",     group: 'Activité'      },
  { id: 'parrainage',      icon: 'fa-share-nodes',      label: 'Parrainage',          group: 'Activité'      },

  /* Finances */
  { id: 'paiement',        icon: 'fa-wallet',           label: 'Paiement',            group: 'Finances'      },

  /* Compte */
  { id: 'notifications',   icon: 'fa-bell',             label: 'Notifications',       group: 'Compte'        },
  { id: 'securite',        icon: 'fa-lock',             label: 'Sécurité',            group: 'Compte'        },
  { id: 'confidentialite', icon: 'fa-user-shield',      label: 'Confidentialité',     group: 'Compte'        },
  { id: 'preferences',     icon: 'fa-sliders',          label: 'Préférences',         group: 'Compte'        },
  { id: 'danger',          icon: 'fa-triangle-exclamation', label: 'Zone danger',     group: 'Compte', isDanger: true },
];
