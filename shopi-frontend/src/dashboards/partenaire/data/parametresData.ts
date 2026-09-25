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

/** Même liste que SectionId, lisible à l'exécution — valide un paramètre reçu de l'URL
 *  (voir ParametresPage : ?section=xyz porté par l'historique du navigateur en mode téléphone). */
export const SECTION_IDS: SectionId[] = [
  'profil', 'paiement', 'parrainage', 'documents', 'zone',
  'notifications', 'securite', 'confidentialite', 'preferences', 'danger',
];
export function isSectionId(v: string | null): v is SectionId {
  return !!v && (SECTION_IDS as string[]).includes(v);
}

// ── Calcul dynamique des indicateurs de navigation ──────────
// Déplacé depuis components/ParamNav.tsx : un fichier qui exporte un
// composant React doit, pour Fast Refresh (Vite), n'exporter QUE des
// composants (react-refresh/only-export-components). Réutilisée par
// ParamNav.tsx (desktop/tablette) ET ParamMobileMenu.tsx (mode
// téléphone) — une seule source de vérité pour les mêmes indicateurs
// réels (% de complétion, points d'alerte).
export interface NavIndicator {
  pct?:      string;
  dotColor?: 'r' | 'a';
}

/** Calcule les indicateurs (pct / dotColor) pour chaque section depuis les
 *  données réelles de l'API — reflète la progression réelle du compte
 *  partenaire. `data` provient de usePartenaireParametres() (import type
 *  only, pour éviter tout cycle de dépendance runtime avec le hook). */
export function computeNavState(
  data: import('../hooks/usePartenaireParametres').PartenaireData | null,
): Record<SectionId, NavIndicator> {
  if (!data) {
    const empty: NavIndicator = {};
    return Object.fromEntries(NAV_ITEMS.map(i => [i.id, empty])) as Record<SectionId, NavIndicator>;
  }

  const f = (v: unknown): boolean =>
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

  const pct = (checks: boolean[], total?: number): string =>
    Math.round((checks.filter(Boolean).length / (total ?? checks.length)) * 100) + '%';

  /* Profil : photo + identité + bio + zone */
  const profilPct = pct([f(data.profilePicture), f(data.firstName), f(data.lastName), f(data.bio), f(data.phone)]);

  /* Documents : indicateur amber par défaut (section en attente de backend)
     Le statut de vérification sera disponible quand les champs seront ajoutés
     à l'entité Partner. */
  const docDot: 'a' | undefined = 'a';

  /* Zone d'activité — champs réels sur l'entité Partner */
  const zonePct = pct([f(data.zone), f(data.commune), f(data.ville)]);

  /* Paiement : section locale (pas encore dans l'entité Partner) */
  const paiePct = '50%';

  /* Sécurité : toujours un mot de passe (OK) + 2FA (bonus) */
  const secuPct = pct([true, data.twoFaEnabled]);

  /* Notifications : paramètres personnalisés */
  const notifPct = f(data.notifActeurActive) ? '100%' : '50%';

  /* Confidentialité */
  const confidPct = '100%'; // personnalisé = toujours OK

  /* Danger : point rouge si compte non actif */
  const dangerDot: 'r' | undefined = data.status !== 'active' ? 'r' : undefined;

  return {
    profil:          { pct: profilPct },
    documents:       { dotColor: docDot },
    zone:            { pct: zonePct },
    parrainage:      {}, // statique
    paiement:        { pct: paiePct },
    notifications:   { pct: notifPct },
    securite:        { pct: secuPct },
    confidentialite: { pct: confidPct },
    preferences:     {},
    danger:          { dotColor: dangerDot },
  };
}
