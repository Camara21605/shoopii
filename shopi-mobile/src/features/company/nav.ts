/**
 * Rubriques de l'espace entreprise — même liste, mêmes permissions et même
 * ordre que la barre latérale du site (dashboards/entreprise/layout/Sidebar.tsx).
 * `native` = écran de l'application ; sinon la rubrique s'ouvre sur le site
 * (/dashboard/entreprise/<chemin>) en attendant sa version native.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  /** [groupe, action] de permission ; absent = toujours visible. */
  perm?: [string, string];
  /** Écran natif ; sinon page du site. */
  native?: Href;
  /** Chemin du site sous /dashboard/entreprise (par défaut : id). */
  web?: string;
};
export type NavSection = { title: string; items: NavItem[] };

export function buildNav(businessModel: string): NavSection[] {
  const services = businessModel === 'services';
  return [
    {
      title: 'Principal',
      items: [
        { id: 'overview', label: 'Vue d’ensemble', icon: 'pie-chart-outline', native: '/entreprise' },
        { id: 'commandes', label: 'Commandes', icon: 'cube-outline', perm: ['orders', 'view'], native: '/entreprise/commandes' },
        { id: 'retours', label: 'Retours & SAV', icon: 'return-down-back-outline', perm: ['returns', 'view'], native: '/entreprise/retours' },
      ],
    },
    {
      title: 'Catalogue',
      items: services
        ? [
            { id: 'services', label: 'Services', icon: 'construct-outline', perm: ['services', 'view'], native: '/entreprise/services' },
            { id: 'ajouter-service', label: 'Ajouter un service', icon: 'add-circle-outline', perm: ['services', 'create'], native: '/entreprise/services/nouveau' },
          ]
        : [
            { id: 'produits', label: 'Produits', icon: 'pricetag-outline', perm: ['products', 'view'], native: '/entreprise/produits' },
            { id: 'ajouter', label: 'Ajouter produit', icon: 'add-circle-outline', perm: ['products', 'create'], native: '/entreprise/ajouter' },
            { id: 'inventaire', label: 'Inventaire', icon: 'file-tray-stacked-outline', perm: ['products', 'view'], native: '/entreprise/inventaire' },
            { id: 'fournisseurs', label: 'Fournisseurs', icon: 'business-outline', perm: ['fournisseurs', 'view'], native: '/entreprise/fournisseurs' },
            { id: 'promotions', label: 'Promotions', icon: 'pricetags-outline', perm: ['promotions', 'view'], native: '/entreprise/promotions' },
          ],
    },
    {
      title: 'Marketing',
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'trending-up-outline', perm: ['statistics', 'view'], native: '/entreprise/analytics' },
        { id: 'seo', label: 'SEO & Marketing', icon: 'search-outline', perm: ['statistics', 'view'], native: '/entreprise/seo' },
      ],
    },
    {
      title: 'Réseau & Logistique',
      items: [
        { id: 'livreurs', label: 'Mes livreurs', icon: 'bicycle-outline', perm: ['deliveries', 'view'], native: '/entreprise/livreurs' },
        { id: 'correspondants', label: 'Correspondants', icon: 'location-outline', perm: ['deliveries', 'view'], native: '/entreprise/correspondants' },
      ],
    },
    {
      title: 'Finances & Clients',
      items: [
        { id: 'finances', label: 'Finances', icon: 'cash-outline', perm: ['payments', 'view'], native: '/entreprise/finances' },
        { id: 'clients', label: 'Clients', icon: 'people-outline', perm: ['orders', 'view'], native: '/entreprise/clients' },
        { id: 'avis', label: 'Avis clients', icon: 'star-outline', perm: ['orders', 'view'], native: '/entreprise/avis' },
      ],
    },
    {
      title: 'Équipe',
      items: [{ id: 'equipe', label: 'Gestion de l’équipe', icon: 'people-circle-outline', perm: ['team', 'view'], native: '/entreprise/equipe' }],
    },
    {
      title: 'Boutique',
      items: [
        { id: 'parametres', label: 'Paramètres', icon: 'settings-outline', perm: ['settings', 'view'], native: '/entreprise/parametres' },
        { id: 'boutique-preview', label: 'Voir ma boutique', icon: 'open-outline', perm: ['boutique', 'view'] },
      ],
    },
  ];
}

export const SITE = 'https://www.shoneya.com';
export const webPath = (item: Pick<NavItem, 'id' | 'web'>) => `/dashboard/entreprise/${item.web ?? item.id}`;
