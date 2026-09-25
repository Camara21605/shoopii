/* ================================================================
 * FICHIER : pages/parametres/navData.ts
 * Configuration de la navigation des Paramètres Admin (groupes,
 * libellés, icônes, métadonnées par section) — réutilisée par la
 * sidebar desktop (ParametresPage.tsx) ET le menu groupé mode
 * téléphone (ParametresMobileMenu.tsx), une seule source de vérité.
 * ================================================================ */

import type { ParamSection } from './types';

export interface NavItem {
  id:    ParamSection;
  label: string;
  icon:  string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Compte',
    items: [
      { id: 'profil',          label: 'Profil',               icon: 'fa-user-circle' },
      { id: 'securite',        label: 'Sécurité',             icon: 'fa-shield-halved' },
    ],
  },
  {
    label: 'Ma zone',
    items: [
      { id: 'zone',            label: 'Zone & Couverture',    icon: 'fa-map-location-dot' },
      { id: 'validations',     label: 'Validations',          icon: 'fa-user-check' },
    ],
  },
  {
    label: 'Acteurs',
    items: [
      { id: 'entreprises',     label: 'Entreprises',          icon: 'fa-store' },
      { id: 'livreurs',        label: 'Livreurs',             icon: 'fa-motorcycle' },
      { id: 'partenaires',     label: 'Partenaires',          icon: 'fa-handshake' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { id: 'notifications',   label: 'Notifications',        icon: 'fa-bell' },
      { id: 'communication',   label: 'Communication',        icon: 'fa-comment-dots' },
      { id: 'finances',        label: 'Finances',             icon: 'fa-coins' },
    ],
  },
  {
    label: 'Système',
    items: [
      { id: 'journal',         label: "Journal d'activité",   icon: 'fa-clipboard-list' },
      { id: 'sauvegarde',      label: 'Sauvegarde',           icon: 'fa-database' },
      { id: 'confidentialite', label: 'Confidentialité',      icon: 'fa-lock' },
      { id: 'avance',          label: 'Paramètres avancés',   icon: 'fa-sliders' },
      { id: 'sante',           label: 'Santé du système',     icon: 'fa-heart-pulse' },
    ],
  },
];

/* Métadonnées par section (titre + sous-titre) */
export const SEC_META: Record<ParamSection, { title: string; sub: string; group: string }> = {
  profil:          { title: 'Profil administrateur', sub: 'Identité, avatar et informations de compte',                   group: 'Compte' },
  securite:        { title: 'Sécurité',              sub: 'Mot de passe, double authentification et session actuelle',              group: 'Compte' },
  zone:            { title: 'Zone & Couverture',     sub: 'Zone géographique, communes et alertes',                       group: 'Ma zone' },
  validations:     { title: 'Validations',           sub: 'Mode, délais et règles par type d\'acteur',                   group: 'Ma zone' },
  entreprises:     { title: 'Entreprises',           sub: 'Commission, documents requis et catégories autorisées',        group: 'Acteurs' },
  livreurs:        { title: 'Livreurs',              sub: 'Rayon, distance, assignation automatique et score',            group: 'Acteurs' },
  partenaires:     { title: 'Partenaires',           sub: 'Tiers, commissions, objectifs et programme bonus',             group: 'Acteurs' },
  notifications:   { title: 'Notifications',         sub: 'Canaux (SMS, e-mail, WhatsApp…) et événements notifiables',   group: 'Opérations' },
  communication:   { title: 'Communication',         sub: 'Templates de messages, réponse auto et signature',             group: 'Opérations' },
  finances:        { title: 'Finances',              sub: 'Devise, taxes, limites de retrait et méthodes de paiement',   group: 'Opérations' },
  journal:         { title: "Journal d'activité",    sub: 'Historique complet de toutes vos actions avec filtres',        group: 'Système' },
  sauvegarde:      { title: 'Sauvegarde',            sub: 'Sauvegarde automatique, historique et restauration',           group: 'Système' },
  confidentialite: { title: 'Confidentialité',       sub: 'Cookies, rétention des données et conformité RGPD',           group: 'Système' },
  avance:          { title: 'Paramètres avancés',    sub: 'Mode maintenance, urgence, cache et logs système',             group: 'Système' },
  sante:           { title: 'Santé du système',      sub: 'État en temps réel de tous les services de la plateforme',    group: 'Système' },
};

/* BUG CORRIGÉ (historique, voir ParametresPage.tsx) — sections encore
 * 100% maquette, sans le moindre appel réseau. Déplacé ici avec le reste
 * de la config de navigation. */
export const MOCK_SECTIONS = new Set<ParamSection>([
  'finances',
  'sauvegarde', 'confidentialite', 'avance',
]);
