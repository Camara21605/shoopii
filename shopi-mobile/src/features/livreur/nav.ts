/**
 * Rubriques de l'espace livreur — même liste et même ordre que la barre
 * latérale du site (dashboards/livreur/components/Sidebar.tsx), plus le
 * réseau (barre du bas mobile du site). `native` = écran de l'application ;
 * sinon la rubrique s'ouvre sur le site (/dashboard/livreur/<web>) en
 * attendant sa version native.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type LivreurNavItem = { id: string; label: string; icon: IconName; native?: Href; web?: string };
export type LivreurNavSection = { title: string; items: LivreurNavItem[] };

export const LIVREUR_NAV: LivreurNavSection[] = [
  {
    title: 'Principal',
    items: [
      { id: 'overview', label: 'Vue d’ensemble', icon: 'pie-chart-outline', native: '/livreur' },
      { id: 'missions', label: 'Missions disponibles', icon: 'bicycle-outline', native: '/livreur/missions' },
      { id: 'encours', label: 'En cours', icon: 'navigate-outline', native: '/livreur/encours' },
      { id: 'historique', label: 'Historique', icon: 'time-outline', native: '/livreur/historique' },
    ],
  },
  {
    title: 'Réseau',
    items: [
      { id: 'boutiques', label: 'Mes boutiques', icon: 'storefront-outline', native: '/livreur/boutiques' },
      { id: 'reseau-correspondants', label: 'Correspondants', icon: 'business-outline', native: '/livreur/reseau/correspondants' },
      { id: 'reseau-livreurs', label: 'Livreurs', icon: 'people-outline', native: '/livreur/reseau/livreurs' },
    ],
  },
  {
    title: 'Finances',
    items: [
      { id: 'revenus', label: 'Mes revenus', icon: 'cash-outline', native: '/livreur/revenus' },
    ],
  },
  {
    title: 'Mon compte',
    items: [
      { id: 'zone', label: 'Ma zone de livraison', icon: 'map-outline', native: '/livreur/zone' },
      { id: 'evaluation', label: 'Mon évaluation', icon: 'star-outline', native: '/livreur/evaluation' },
      { id: 'profil', label: 'Mon profil', icon: 'person-circle-outline', native: '/livreur/profil' },
      { id: 'parametres', label: 'Paramètres', icon: 'settings-outline', native: '/livreur/parametres' },
    ],
  },
];

export const webPath = (it: LivreurNavItem) => `/dashboard/livreur/${it.web ?? it.id}`;
