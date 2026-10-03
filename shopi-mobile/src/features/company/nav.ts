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
        { id: 'retours', label: 'Retours & SAV', icon: 'return-down-back-outline', perm: ['returns', 'view'] },
        { id: 'messages', label: 'Messages', icon: 'chatbubble-ellipses-outline', native: '/messages' },
      ],
    },
    {
      title: 'Catalogue',
      items: services
        ? [
            { id: 'services', label: 'Services', icon: 'construct-outline', perm: ['services', 'view'] },
            { id: 'ajouter-service', label: 'Ajouter un service', icon: 'add-circle-outline', perm: ['services', 'create'] },
          ]
        : [
            { id: 'produits', label: 'Produits', icon: 'pricetag-outline', perm: ['products', 'view'], native: '/entreprise/produits' },
            { id: 'ajouter', label: 'Ajouter produit', icon: 'add-circle-outline', perm: ['products', 'create'], native: '/entreprise/ajouter' },
            { id: 'inventaire', label: 'Inventaire', icon: 'file-tray-stacked-outline', perm: ['products', 'view'] },
            { id: 'fournisseurs', label: 'Fournisseurs', icon: 'business-outline', perm: ['fournisseurs', 'view'] },
            { id: 'promotions', label: 'Promotions', icon: 'pricetags-outline', perm: ['promotions', 'view'] },
          ],
    },
    {
      title: 'Marketing',
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'trending-up-outline', perm: ['statistics', 'view'] },
        { id: 'seo', label: 'SEO & Marketing', icon: 'search-outline', perm: ['statistics', 'view'] },
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
        { id: 'finances', label: 'Finances', icon: 'cash-outline', perm: ['payments', 'view'] },
        { id: 'portefeuille', label: 'Portefeuille', icon: 'wallet-outline', perm: ['wallet', 'view'] },
        { id: 'clients', label: 'Clients', icon: 'people-outline', perm: ['orders', 'view'] },
        { id: 'avis', label: 'Avis clients', icon: 'star-outline', perm: ['orders', 'view'] },
      ],
    },
    {
      title: 'Équipe',
      items: [{ id: 'equipe', label: 'Gestion de l’équipe', icon: 'people-circle-outline', perm: ['team', 'view'] }],
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
