/**
 * Présentation des notifications — même logique que le site
 * (shopi-frontend/src/shared/notifications/notificationUtils.ts) :
 * icône + couleur par type, catégories de filtre, temps relatif,
 * regroupement par date, et page à ouvrir au toucher.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { AppNotification } from './api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type TypeMeta = { icon: IconName; color: string };

const TYPE_META: Record<string, TypeMeta> = {
  order: { icon: 'cube', color: '#059669' },
  delivery: { icon: 'bicycle', color: '#059669' },
  colis: { icon: 'cube', color: '#059669' },
  message: { icon: 'chatbubble-ellipses', color: '#1652F0' },
  conversation: { icon: 'chatbubble-ellipses', color: '#1652F0' },
  follow: { icon: 'person-add', color: '#7C3AED' },
  product: { icon: 'heart', color: '#DB2777' },
  promo: { icon: 'pricetag', color: '#D97706' },
  payment: { icon: 'card', color: '#0D9488' },
  review: { icon: 'star', color: '#D97706' },
  stock: { icon: 'file-tray-stacked', color: '#DC2626' },
  account: { icon: 'shield-checkmark', color: '#059669' },
  call: { icon: 'call', color: '#1652F0' },
  group_call: { icon: 'call', color: '#1652F0' },
  support: { icon: 'help-buoy', color: '#6B7280' },
};

export function typeMeta(type: string): TypeMeta {
  return TYPE_META[type.split('.')[0]] ?? { icon: 'notifications', color: '#6B7280' };
}

export type NotifFilter = 'all' | 'unread' | 'order' | 'message' | 'product' | 'promo' | 'account';

export const FILTERS: { key: NotifFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
  { key: 'order', label: 'Commandes' },
  { key: 'message', label: 'Messages' },
  { key: 'product', label: 'Produits' },
  { key: 'promo', label: 'Promotions' },
  { key: 'account', label: 'Compte' },
];

/** Catégorie de filtre d'un type (regroupe commandes + livraisons + paiements, etc.) — comme le site. */
export function categoryOf(type: string): Exclude<NotifFilter, 'all' | 'unread'> {
  const p = type.split('.')[0];
  if (['order', 'delivery', 'colis', 'payment'].includes(p)) return 'order';
  if (['message', 'conversation', 'call', 'group_call'].includes(p)) return 'message';
  if (['product', 'stock', 'review'].includes(p)) return 'product';
  if (p === 'promo') return 'promo';
  return 'account';
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'À l’instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604_800) return `Il y a ${Math.floor(diff / 86_400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Groupes de date : Aujourd'hui · Hier · Cette semaine · Plus ancien. */
export function groupByDate(list: AppNotification[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const yesterday = today - 86_400_000;
  const week = today - 6 * 86_400_000;
  const groups: { title: string; data: AppNotification[] }[] = [
    { title: 'Aujourd’hui', data: [] },
    { title: 'Hier', data: [] },
    { title: 'Cette semaine', data: [] },
    { title: 'Plus ancien', data: [] },
  ];
  for (const n of list) {
    const t = new Date(n.createdAt).getTime();
    groups[t >= today ? 0 : t >= yesterday ? 1 : t >= week ? 2 : 3].data.push(n);
  }
  return groups.filter((g) => g.data.length > 0);
}

/**
 * Où mène une notification — même ordre de priorité que resolveNavTarget du site :
 *   commande / livraison → suivi de commande · message / appel → messagerie
 *   produit → fiche produit · sinon actionUrl du serveur.
 * { app } = écran de l'application ; { web } = page du site (navigateur intégré).
 */
export function targetOf(n: AppNotification): { app: '/messages' } | { web: string } | null {
  const p = n.type.split('.')[0];
  const cmdId = (n.payload?.commandeId as string | undefined) ?? null;
  const res = n.resourceId ?? null;
  const url = n.actionUrl ?? '';

  if (p === 'order') return res ? { web: `/commande/${res}/suivi` } : null;
  if (p === 'delivery' || p === 'colis') return cmdId || res ? { web: `/commande/${cmdId ?? res}/suivi` } : null;
  if (['message', 'conversation', 'call', 'group_call'].includes(p)) return { app: '/messages' };
  if (p === 'payment' && cmdId) return { web: `/commande/${cmdId}/suivi` };
  if (url.startsWith('/commandes/')) return { web: `/commande/${url.split('/')[2]}/suivi` };
  if (url.startsWith('/') || url.startsWith('http')) return { web: url };
  if (p === 'product' && res) return { web: `/produit/${res}` };
  if (p === 'support') return { web: '/aide' };
  return null;
}
