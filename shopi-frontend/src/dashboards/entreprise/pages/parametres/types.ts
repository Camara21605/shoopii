// src/dashboards/entreprise/pages/parametres/types.ts

export type ParamSection =
  | 'boutique'
  | 'contact'
  | 'horaires'
  | 'catalogue'
  | 'livraison'
  | 'paiement'
  | 'commissions'
  | 'documents'
  | 'securite'
  | 'notifications'
  | 'confidentialite'
  | 'danger';

export interface ParamNavItem {
  id:        ParamSection;
  icon:      string;
  label:     string;
  pct?:      number;
  dot?:      'red' | 'amber' | 'blue';
}

export const PARAM_NAV_SECTIONS: { title: string; items: ParamNavItem[] }[] = [
  {
    title: 'Identité',
    items: [
      { id: 'boutique',  icon: 'fa-store',        label: 'Boutique & Identité',   pct: 85 },
      { id: 'contact',   icon: 'fa-address-book', label: 'Contact & Localisation', pct: 100 },
    ],
  },
  {
    title: 'Activité',
    items: [
      { id: 'horaires',   icon: 'fa-clock',          label: 'Horaires',           pct: 100 },
      { id: 'catalogue',  icon: 'fa-boxes-stacked',  label: 'Catalogue & Produits', pct: 70 },
      { id: 'livraison',  icon: 'fa-truck',          label: 'Livraison',          pct: 100 },
    ],
  },
  {
    title: 'Finances',
    items: [
      { id: 'paiement',     icon: 'fa-wallet',   label: 'Paiement & Facturation', pct: 100 },
      { id: 'commissions',  icon: 'fa-percent',  label: 'Commissions Shopi',      pct: 100 },
    ],
  },
  {
    title: 'Compte',
    items: [
      { id: 'documents',       icon: 'fa-file-shield',   label: 'Documents',        dot: 'amber' },
      { id: 'securite',        icon: 'fa-lock',          label: 'Sécurité',         pct: 100 },
      { id: 'notifications',   icon: 'fa-bell',          label: 'Notifications',    pct: 100 },
      { id: 'confidentialite', icon: 'fa-shield-halved', label: 'Confidentialité',  pct: 60 },
      { id: 'danger',          icon: 'fa-triangle-exclamation', label: 'Zone sensible', dot: 'red' },
    ],
  },
];