/*
 * FICHIER: src/shared/types/index.ts
 * Types TypeScript partagés dans tout le projet Shopi
 */

/** Type de notification Toast */
export type ToastType = 's' | 'i' | 'w' | 'e';

/** Un message toast */
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

/** Statut d'une commande */
export type OrderStatus = 'new' | 'prep' | 'ship' | 'del' | 'can';

/** Statut d'un retour */
export type ReturnStatus = 'pending' | 'approved' | 'refused';

/** Statut d'une promotion */
export type PromoStatus = 'active' | 'scheduled' | 'draft';

/** Niveau de stock d'un produit */
export type StockLevel = 'ok' | 'low' | 'out';

/** Segment client */
export type ClientSegment = 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau';

/** Une commande */
export interface Order {
  id: string;
  em: string;
  nm: string;
  vt: string;
  client: string;
  price: number;
  status: OrderStatus;
  date: string;
  livreur: string;
  zone: string;
  /** UUID réel de la commande (pour la navigation vers la page de suivi) */
  uuid?: string;
}

/** Un produit */
export interface Product {
  em: string;
  nm: string;
  cat: string;
  price: number;
  old?: number;
  stock: number;
  ventes: number;
  note: number;
  promo?: boolean;
  active: boolean;
}

/** Un livreur */
export interface Livreur {
  em: string;
  nm: string;
  zone: string;
  trips: number;
  rating: number;
  status: 'online' | 'busy' | 'offline';
  today: number;
}

/** Un correspondant */
export interface Correspondant {
  nm: string;
  ville: string;
  cat: string;
  ord: number;
  em: string;
}

/** Un client */
export interface Client {
  nm: string;
  email: string;
  orders: number;
  total: string;
  seg: ClientSegment;
  last: string;
}

/** Une transaction financière */
export interface Transaction {
  ic: string;
  nm: string;
  sub: string;
  amt: string;
  dir: 'in' | 'out';
  bg: string;
}

/** Une promotion */
export interface Promo {
  nm: string;
  code: string;
  type: string;
  typeL: string;
  status: PromoStatus;
  uses: number;
  max: number;
  revenue: string;
  expire: string;
}

/** Un message client */
export interface Message {
  nm: string;
  txt: string;
  time: string;
  unread: boolean;
  av: string;
  color: string;
}

/** Un retour produit */
export interface Return {
  id: string;
  em: string;
  nm: string;
  client: string;
  motif: string;
  status: ReturnStatus;
  date: string;
  montant: string;
}

/** Une alerte de stock */
export interface StockAlert {
  em: string;
  nm: string;
  qty: number;
  min: number;
  type: 'red' | 'amber';
}

/** Un avis client */
export interface Review {
  av: string;
  bg: string;
  nm: string;
  prod: string;
  stars: number;
  txt: string;
  date: string;
  reply?: string;
}

/** Page du dashboard entreprise */
export type EntreprisePage =
  | 'overview'
  | 'commandes'
  | 'retours'
  | 'produits'
  | 'ajouter'
  | 'inventaire'
  | 'promotions'
  | 'analytics'
  | 'messages'
  | 'seo'
  | 'livreurs'
  | 'correspondants'
  | 'finances'
  | 'portefeuille'
  | 'clients'
  | 'avis'
  | 'parametres'
  | 'reseauCorrespondants'
  | 'reseauLivreurs'
  | 'profilCorrespondantReseau'
  | 'profilLivreurReseau'
  | 'profil'
  | 'boutique-preview';