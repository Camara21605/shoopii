/**
 * Rubriques de l'espace correspondant — même liste et même ordre que la barre
 * latérale du site (dashboards/correspondant/layout/Sidebar.tsx), sauf
 * « Portefeuille » (ouvert par « Gérer » sur la carte du solde) et
 * « Messages » (icône 💬 de l'en-tête). `native` = écran de l'application ;
 * sinon la rubrique s'ouvre sur le site (/dashboard/correspondant/<web>) en
 * attendant sa version native.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type CorrespondantNavItem = { id: string; label: string; icon: IconName; native?: Href; web?: string };
export type CorrespondantNavSection = { title: string; items: CorrespondantNavItem[] };

export const CORRESPONDANT_NAV: CorrespondantNavSection[] = [
  {
    title: 'Principal',
    items: [
      { id: 'overview', label: 'Vue d’ensemble', icon: 'pie-chart-outline', native: '/correspondant' },
      { id: 'colis', label: 'Colis', icon: 'cube-outline', native: '/correspondant/colis' },
      { id: 'transferts', label: 'Transferts', icon: 'swap-horizontal-outline', native: '/correspondant/transferts' },
      { id: 'retours', label: 'Retours', icon: 'return-down-back-outline', native: '/correspondant/retours' },
    ],
  },
  {
    title: 'Mes relations',
    items: [
      { id: 'boutiques', label: 'Boutiques', icon: 'storefront-outline', native: '/correspondant/boutiques' },
      { id: 'livreurs', label: 'Livreurs', icon: 'bicycle-outline', native: '/correspondant/livreurs' },
      { id: 'clients', label: 'Clients', icon: 'people-outline', native: '/correspondant/clients' },
    ],
  },
  {
    title: 'Finances & compte',
    items: [
      { id: 'revenus', label: 'Mes revenus', icon: 'cash-outline', native: '/correspondant/revenus' },
      { id: 'zone', label: 'Ma zone', icon: 'map-outline', native: '/correspondant/zone' },
      { id: 'evaluation', label: 'Mon évaluation', icon: 'star-outline', native: '/correspondant/evaluation' },
      { id: 'profil', label: 'Mon profil', icon: 'person-circle-outline', native: '/correspondant/profil' },
      { id: 'parametres', label: 'Paramètres', icon: 'settings-outline', native: '/correspondant/parametres' },
    ],
  },
];

export const webPath = (it: CorrespondantNavItem) => `/dashboard/correspondant/${it.web ?? it.id}`;
