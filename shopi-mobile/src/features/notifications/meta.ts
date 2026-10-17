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
  message: { icon: 'chatbubble-ellipses', color: '#1F1F1F' },
  conversation: { icon: 'chatbubble-ellipses', color: '#1F1F1F' },
  follow: { icon: 'person-add', color: '#7C3AED' },
  product: { icon: 'heart', color: '#DB2777' },
  promo: { icon: 'pricetag', color: '#D97706' },
  payment: { icon: 'card', color: '#0D9488' },
  review: { icon: 'star', color: '#D97706' },
  stock: { icon: 'file-tray-stacked', color: '#DC2626' },
  account: { icon: 'shield-checkmark', color: '#059669' },
  call: { icon: 'call', color: '#1F1F1F' },
  group_call: { icon: 'call', color: '#1F1F1F' },
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

/** Destination au toucher : écran de l'application, page du site, ou le détail sur place. */
export type NotifTarget = { app: string } | { web: string } | { detail: true } | null;

/**
 * Où mène une notification. D'abord la décision du SERVEUR (`n.target`,
 * même règle pour la liste, le temps réel et les push) : écran natif, ou
 * détail sur place quand il n'existe pas d'écran dédié — jamais une page
 * au hasard. Sinon (anciens serveurs, rôles sans règle), l'ancienne logique
 * — même ordre que resolveNavTarget du site :
 *   commande / livraison → suivi de commande · message / appel → messagerie
 *   produit → fiche produit · sinon actionUrl du serveur.
 */
export function targetOf(n: AppNotification): NotifTarget {
  if (n.target) return n.target.app ? { app: n.target.app } : { detail: true };

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

/* ── Espace LIVREUR : filtres, libellés et icônes de son métier ─────────── */

export type LivreurFilter = 'all' | 'unread' | 'missions' | 'gains' | 'avis' | 'compte';
type LivreurCategory = Exclude<LivreurFilter, 'all' | 'unread'>;

export const LIVREUR_FILTERS: { key: LivreurFilter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Toutes', icon: 'albums-outline' },
  { key: 'unread', label: 'Non lues', icon: 'ellipse' },
  { key: 'missions', label: 'Missions', icon: 'bicycle-outline' },
  { key: 'gains', label: 'Gains', icon: 'wallet-outline' },
  { key: 'avis', label: 'Avis', icon: 'star-outline' },
  { key: 'compte', label: 'Compte', icon: 'person-circle-outline' },
];

/** Catégorie d'une notification du livreur (décidée par le serveur, sinon déduite du type). */
export function livreurCategoryOf(n: AppNotification): LivreurCategory {
  const c = n.target?.category;
  if (c === 'missions' || c === 'gains' || c === 'avis' || c === 'compte') return c;
  const p = n.type.split('.')[0];
  const rt = n.resourceType ?? '';
  if (rt === 'commission' || rt === 'wallet' || rt === 'retrait' || rt === 'escrow' || p === 'payment') return 'gains';
  if (p === 'review' || rt === 'review') return 'avis';
  if (p === 'order' || p === 'delivery' || p === 'colis' || rt === 'livreur_mission' || rt === 'order') return 'missions';
  return 'compte';
}

/** Libellé précis sous la notification du livreur (« Mission », « Retrait », « Avis »…). */
export function livreurLabelOf(n: AppNotification): string {
  const p = n.type.split('.')[0];
  const rt = n.resourceType ?? '';
  if (rt === 'retrait') return 'Retrait';
  if (rt === 'wallet') return p === 'account' ? 'Portefeuille bloqué' : 'Portefeuille';
  if (rt === 'commission') return 'Gain';
  if (rt === 'escrow' || p === 'payment') return 'Paiement';
  if (rt === 'dispute') return 'Litige';
  if (rt === 'livreur_mission') return 'Mission disponible';
  if (p === 'review' || rt === 'review') return 'Avis';
  if (p === 'follow') return 'Abonnement';
  if (p === 'support' || rt === 'support_ticket') return 'Aide';
  if (p === 'account' || p === 'invitation') return 'Compte';
  if (livreurCategoryOf(n) === 'missions') return 'Mission';
  return 'Annonce';
}

/** Icône + couleur adaptées au livreur (une mission n'est pas une « commande » de client). */
export function livreurMetaOf(n: AppNotification): TypeMeta {
  const p = n.type.split('.')[0];
  const rt = n.resourceType ?? '';
  if (rt === 'retrait' || rt === 'wallet') return p === 'account' ? { icon: 'lock-closed', color: '#DC2626' } : { icon: 'wallet', color: '#0D9488' };
  if (rt === 'commission' || rt === 'escrow' || p === 'payment') return { icon: 'cash', color: '#0D9488' };
  if (rt === 'dispute') return { icon: 'alert-circle', color: '#DC2626' };
  if (rt === 'livreur_mission') return { icon: 'flash', color: '#D97706' };
  if (livreurCategoryOf(n) === 'missions') return { icon: 'bicycle', color: '#059669' };
  return typeMeta(n.type);
}

/* ── Espace CLIENT : ses filtres et libellés ─────────────────────────────── */

export type ClientFilter = 'all' | 'unread' | 'commandes' | 'retours' | 'boutique' | 'argent' | 'compte';
type ClientCategory = Exclude<ClientFilter, 'all' | 'unread'>;

export const CLIENT_FILTERS: { key: ClientFilter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Toutes', icon: 'albums-outline' },
  { key: 'unread', label: 'Non lues', icon: 'ellipse' },
  { key: 'commandes', label: 'Commandes', icon: 'cube-outline' },
  { key: 'retours', label: 'Retours', icon: 'return-down-back-outline' },
  { key: 'boutique', label: 'Boutiques', icon: 'storefront-outline' },
  { key: 'argent', label: 'Portefeuille', icon: 'wallet-outline' },
  { key: 'compte', label: 'Compte', icon: 'person-circle-outline' },
];

/** Catégorie d'une notification du client (décidée par le serveur, sinon déduite du type). */
export function clientCategoryOf(n: AppNotification): ClientCategory {
  const c = n.target?.category;
  if (c === 'commandes' || c === 'retours' || c === 'boutique' || c === 'argent' || c === 'compte') return c;
  const p = n.type.split('.')[0];
  const rt = n.resourceType ?? '';
  if (p === 'return') return 'retours';
  if (rt === 'wallet' || rt === 'retrait' || p === 'payment') return 'argent';
  if (p === 'order' || p === 'delivery' || p === 'colis') return 'commandes';
  if (p === 'product' || p === 'promo' || p === 'crm' || p === 'story' || p === 'review') return 'boutique';
  return 'compte';
}

/** Libellé précis sous la notification du client. */
export function clientLabelOf(n: AppNotification): string {
  const p = n.type.split('.')[0];
  const rt = n.resourceType ?? '';
  if (p === 'return' || rt === 'return') return 'Retour';
  if (rt === 'wallet' || rt === 'retrait') return 'Portefeuille';
  if (rt === 'dispute') return 'Litige';
  if (p === 'payment' || rt === 'escrow') return 'Paiement';
  if (p === 'order' || p === 'delivery' || p === 'colis') return 'Commande';
  if (p === 'crm' || rt === 'crm_campaign') return 'Message d’une boutique';
  if (p === 'story') return 'Story';
  if (n.type === 'product.back_in_stock') return 'De retour en stock';
  if (n.type === 'product.price_drop') return 'Baisse de prix';
  if (p === 'product') return 'Produit';
  if (p === 'review') return 'Réponse à votre avis';
  if (p === 'support' || rt === 'support_ticket') return 'Aide';
  if (p === 'account') return 'Compte';
  return 'Annonce';
}

/** Icône adaptée (un paiement échoué, un litige se voient tout de suite). */
export function clientMetaOf(n: AppNotification): TypeMeta {
  const rt = n.resourceType ?? '';
  if (n.type === 'payment.failed' || rt === 'dispute' || n.type === 'order.cancelled') return { icon: 'alert-circle', color: '#DC2626' };
  if (rt === 'wallet' || rt === 'retrait') return { icon: 'wallet', color: '#0D9488' };
  if (n.payload?.status === 'AWAITING_CLIENT') return { icon: 'cube', color: '#7C3AED' };
  if (n.type.startsWith('crm.') || rt === 'crm_campaign') return { icon: 'storefront', color: '#D97706' };
  if (n.type === 'product.price_drop') return { icon: 'trending-down', color: '#059669' };
  return typeMeta(n.type);
}
