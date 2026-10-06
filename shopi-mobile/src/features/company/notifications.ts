/**
 * Notifications de l'ENTREPRISE — ce n'est pas le centre du client :
 * une boutique reçoit des commandes à traiter, des retours, des alertes de
 * stock, des avis à qui répondre, des paiements, des abonnés et des
 * nouvelles de son équipe. Chaque notification mène donc à la rubrique de
 * gestion concernée (comme notificationUtils.resolveNavTarget du site et les
 * actionUrl envoyés par le serveur — notification-event.service.ts), et le
 * bouton d'action n'est proposé que si le collaborateur a la permission
 * d'ouvrir cette rubrique (même règle que le menu, nav.ts).
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

import type { AppNotification } from '@/features/notifications/api';

import { buildNav, webPath, type NavItem } from './nav';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── Catégories (filtres) ─────────────────────────────────────────────── */

export type CompanyCategory = 'commandes' | 'retours' | 'stock' | 'avis' | 'argent' | 'boutique' | 'compte';
export type CompanyFilter = 'all' | 'unread' | CompanyCategory;

export const COMPANY_FILTERS: { key: CompanyFilter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Toutes', icon: 'albums-outline' },
  { key: 'unread', label: 'Non lues', icon: 'ellipse' },
  { key: 'commandes', label: 'Commandes', icon: 'cube-outline' },
  { key: 'retours', label: 'Retours', icon: 'return-down-back-outline' },
  { key: 'stock', label: 'Stock', icon: 'file-tray-stacked-outline' },
  { key: 'avis', label: 'Avis', icon: 'star-outline' },
  { key: 'argent', label: 'Paiements', icon: 'wallet-outline' },
  { key: 'boutique', label: 'Boutique', icon: 'storefront-outline' },
  { key: 'compte', label: 'Compte & équipe', icon: 'people-outline' },
];

const prefix = (type: string) => type.split('.')[0];

export function categoryOf(n: AppNotification): CompanyCategory {
  const p = prefix(n.type);
  if (p === 'order' || p === 'delivery' || p === 'colis') return 'commandes';
  if (p === 'return') return 'retours';
  if (p === 'stock' || n.type === 'product.out_of_stock' || n.type === 'product.back_in_stock') return 'stock';
  if (p === 'review') return 'avis';
  if (p === 'payment') return 'argent';
  if (p === 'product' || p === 'service' || p === 'follow' || p === 'promo' || p === 'story') return 'boutique';
  /* Annonces système ciblées : leur page dit de quoi il s'agit */
  const url = n.actionUrl ?? '';
  if (url.includes('/finances')) return 'argent';
  return 'compte';
}

/* ── Présentation par type ────────────────────────────────────────────── */

export type CompanyTypeMeta = { icon: IconName; color: string; label: string };

const META: Record<string, CompanyTypeMeta> = {
  order: { icon: 'cube', color: '#059669', label: 'Commande' },
  delivery: { icon: 'bicycle', color: '#059669', label: 'Livraison' },
  colis: { icon: 'cube', color: '#059669', label: 'Colis' },
  return: { icon: 'return-down-back', color: '#EA580C', label: 'Retour' },
  stock: { icon: 'file-tray-stacked', color: '#DC2626', label: 'Stock' },
  review: { icon: 'star', color: '#D97706', label: 'Avis client' },
  payment: { icon: 'wallet', color: '#0D9488', label: 'Paiement' },
  product: { icon: 'heart', color: '#DB2777', label: 'Catalogue' },
  service: { icon: 'heart', color: '#DB2777', label: 'Catalogue' },
  promo: { icon: 'pricetag', color: '#D97706', label: 'Promotion' },
  follow: { icon: 'person-add', color: '#7C3AED', label: 'Abonné' },
  account: { icon: 'shield-checkmark', color: '#059669', label: 'Compte' },
  system: { icon: 'megaphone', color: '#1F1F1F', label: 'Annonce' },
  support: { icon: 'help-buoy', color: '#6B7280', label: 'Support' },
  call: { icon: 'call', color: '#1F1F1F', label: 'Appel' },
  group_call: { icon: 'call', color: '#1F1F1F', label: 'Appel' },
  invitation: { icon: 'key', color: '#7C3AED', label: 'Invitation' },
};

export function metaOf(n: AppNotification): CompanyTypeMeta {
  if (n.type === 'stock.critical' || n.type === 'product.out_of_stock') return { icon: 'alert-circle', color: '#DC2626', label: 'Rupture' };
  if (n.type === 'product.back_in_stock') return { icon: 'file-tray-stacked', color: '#059669', label: 'Stock' };
  if (n.type === 'order.cancelled') return { icon: 'close-circle', color: '#DC2626', label: 'Annulation' };
  if (n.type === 'payment.failed') return { icon: 'alert-circle', color: '#DC2626', label: 'Paiement' };
  return META[prefix(n.type)] ?? { icon: 'notifications', color: '#6B7280', label: 'Information' };
}

/** À traiter en priorité : nouvelle commande, retour demandé, rupture de stock. */
export const isUrgent = (n: AppNotification) =>
  !n.isRead && (n.type === 'order.placed' || n.type === 'return.requested' || n.type === 'stock.critical' || n.type === 'product.out_of_stock');

/* ── Destination ──────────────────────────────────────────────────────── */

export type CompanyTarget =
  | { app: Href; section?: string }
  | { web: string; section?: string };

const DASH = '/dashboard/entreprise';
const section = (s: string) => `${DASH}/${s}`;

/** Page de gestion visée par une notification (rubrique du tableau de bord, suivi de commande…). */
function rawTarget(n: AppNotification): string | null {
  const p = prefix(n.type);
  const res = n.resourceId ?? null;
  const cmdId = (n.payload?.commandeId as string | undefined) ?? null;
  const url = n.actionUrl ?? '';

  if (p === 'message' || p === 'conversation' || p === 'call' || p === 'group_call') return '/messages';
  if (p === 'order') return res ? `/commande/${res}/suivi` : section('commandes');
  if (p === 'delivery' || p === 'colis') return cmdId || res ? `/commande/${cmdId ?? res}/suivi` : section('commandes');
  if (p === 'payment') return cmdId ? `/commande/${cmdId}/suivi` : section('finances');
  if (p === 'return') return section('retours');
  if (p === 'stock' || n.type === 'product.out_of_stock' || n.type === 'product.back_in_stock') return section('inventaire');
  if (p === 'review') return section('avis');
  if (p === 'product') return section('produits');
  if (p === 'service') return section('services');
  if (p === 'promo') return section('promotions');
  if (p === 'account') return section('parametres');
  /* Anciennes adresses de commande envoyées avant le correctif serveur (comme le site) */
  if (url.startsWith('/commandes/')) return `/commande/${url.split('/')[2]}/suivi`;
  if (url.startsWith('/dashboard/commandes/')) return section('commandes');
  if (url === `${DASH}/profil`) return section('parametres');
  if (url.startsWith('/') || url.startsWith('http')) return url;
  if (p === 'support') return '/aide';
  return null;
}

/**
 * Où mène la notification, pour CET utilisateur :
 *   - rubrique native de l'application si elle existe (Vue d'ensemble, Paramètres, Ajouter un produit…) ;
 *   - sinon page du site ;
 *   - `section` = rubrique du tableau de bord (pour vérifier la permission).
 */
export function targetOf(n: AppNotification, businessModel: string): CompanyTarget | null {
  const raw = rawTarget(n);
  if (!raw) return null;
  if (raw === '/messages') return { app: '/messages' };
  if (raw.startsWith(`${DASH}/`) || raw === DASH) {
    const id = raw.slice(DASH.length + 1).split(/[/?#]/)[0] || 'overview';
    const item = findItem(businessModel, id);
    if (item?.native) return { app: item.native, section: id };
    return { web: item ? webPath(item) : raw, section: id };
  }
  return { web: raw, section: raw.startsWith('/commande/') ? 'commandes' : undefined };
}

function findItem(businessModel: string, id: string): NavItem | undefined {
  for (const s of buildNav(businessModel)) for (const it of s.items) if (it.id === id) return it;
  return undefined;
}

/** Permission nécessaire pour ouvrir la rubrique (absente = toujours autorisé). */
export function permissionFor(target: CompanyTarget | null, businessModel: string): [string, string] | undefined {
  if (!target?.section) return undefined;
  return findItem(businessModel, target.section)?.perm;
}

/** Libellé du bouton d'action — vocabulaire de gestion, pas celui du client. */
export function actionLabel(n: AppNotification): string {
  const p = prefix(n.type);
  const url = n.actionUrl ?? '';
  if (n.type === 'order.placed') return 'Traiter la commande';
  if (p === 'order' || p === 'delivery' || p === 'colis') return 'Voir la commande';
  if (n.type === 'return.requested') return 'Traiter le retour';
  if (p === 'return') return 'Voir le retour';
  if (n.type === 'product.back_in_stock') return 'Voir l’inventaire';
  if (p === 'stock' || n.type === 'product.out_of_stock') return 'Réapprovisionner';
  if (n.type === 'review.received') return 'Répondre à l’avis';
  if (p === 'review') return 'Voir les avis';
  if (p === 'payment') return n.payload?.commandeId ? 'Voir la commande' : 'Voir mes finances';
  if (p === 'product') return 'Voir mes produits';
  if (p === 'service') return 'Voir mes prestations';
  if (p === 'promo') return 'Voir la promotion';
  if (p === 'follow') return 'Voir le profil';
  if (p === 'account') return 'Voir mon compte';
  if (url.includes('/livreurs')) return 'Voir mes livreurs';
  if (url.includes('/equipe')) return 'Voir l’équipe';
  if (url.includes('/finances')) return 'Voir mes finances';
  return 'Ouvrir';
}

/** Types qui ne s'affichent pas ici : les messages ont leur compteur sur 💬 (comme le site). */
export const isListed = (n: AppNotification) => !n.type.startsWith('message.');
