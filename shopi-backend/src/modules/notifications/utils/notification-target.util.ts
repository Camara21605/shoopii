/* ============================================================
 * FICHIER : src/modules/notifications/utils/notification-target.util.ts
 *
 * RÔLE : OÙ MÈNE UNE NOTIFICATION — une seule source de vérité, utilisée
 * par la liste (GET /notifications), le temps réel (notif:new) et les
 * push (Android + navigateur). Les clients n'ont plus à deviner.
 *
 *   target.web       page du site   (/dashboard/livreur/…, /commande/:id/suivi…)
 *   target.app       écran de l'application mobile (route expo-router), ou
 *                    null : pas d'écran dédié → l'application affiche le
 *                    détail de la notification au lieu d'ouvrir n'importe quoi
 *   target.label     texte du bouton (« Voir la mission », « Voir mes gains »…)
 *   target.category  filtre du centre de notifications
 *
 * POURQUOI resourceType D'ABORD (et pas le type) : le type est un enum
 * Postgres réutilisé pour plusieurs sens (ex. ORDER_STATUS_CHANGED sert
 * aussi pour un séquestre, un litige ou un retrait EN ATTENTE ; PAYMENT_SENT
 * pour une commission ou un débit du portefeuille). Le resourceType, lui,
 * dit exactement de quoi on parle. Avant, un « retrait en attente » menait
 * à /commande/<id du retrait>/suivi — une page introuvable.
 *
 * PORTÉE : routage complet pour le LIVREUR. Pour les autres rôles, seules
 * les destinations universelles (conversation, groupe, ticket d'aide) sont
 * données ; sinon `null` et les clients gardent leur logique actuelle.
 * ============================================================ */

import { NotificationActorType } from 'src/database/entities/notification/notification.entity';

export type NotificationCategory = 'missions' | 'gains' | 'avis' | 'messages' | 'compte';

export interface NotificationTarget {
  /** Page du site (chemin interne commençant par « / »). */
  web:      string;
  /** Écran de l'application, ou null (afficher le détail sur place). */
  app:      string | null;
  /** Texte du bouton d'action. */
  label:    string;
  category: NotificationCategory;
}

/** Ce qu'il faut savoir d'une notification pour décider où elle mène. */
export interface NotificationTargetInput {
  recipientType: string;
  type:          string;
  resourceType?: string | null;
  resourceId?:   string | null;
  payload?:      Record<string, unknown> | null;
  actionUrl?:    string | null;
  actorType?:    string | null;
  actorId?:      string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/**
 * Commande concernée : payload.commandeId, sinon resourceId quand la ressource
 * EST la commande, sinon l'id contenu dans l'ancienne actionUrl
 * « /commande/<id>/suivi » (notifications créées avant cette version).
 */
export function commandeIdOf(n: NotificationTargetInput): string | null {
  const fromPayload = n.payload?.commandeId;
  if (isId(fromPayload)) return fromPayload;
  if ((n.resourceType === 'order' || n.resourceType === 'commission') && isId(n.resourceId)) return n.resourceId;
  const m = /^\/commande\/([0-9a-f-]{36})\/suivi/i.exec(n.actionUrl ?? '');
  return m && isId(m[1]) ? m[1] : null;
}

/** Destinations valables pour tous les rôles. */
function universal(n: NotificationTargetInput): NotificationTarget | null {
  const prefix = n.type.split('.')[0];
  if (n.resourceType === 'conversation' && isId(n.resourceId)) {
    return { web: `/messagerie?conv=${n.resourceId}`, app: `/messages/${n.resourceId}`, label: 'Ouvrir la conversation', category: 'messages' };
  }
  if (n.resourceType === 'delivery_group' && isId(n.resourceId)) {
    return { web: '/messagerie', app: `/messages/groupe/${n.resourceId}`, label: 'Ouvrir le groupe', category: 'messages' };
  }
  if (prefix === 'message' || prefix === 'conversation' || prefix === 'call' || prefix === 'group_call') {
    return { web: '/messagerie', app: '/messages', label: 'Ouvrir la messagerie', category: 'messages' };
  }
  if (n.resourceType === 'support_ticket' && isId(n.resourceId)) {
    return { web: `/support/tickets/${n.resourceId}`, app: `/support/${n.resourceId}`, label: 'Voir le ticket', category: 'compte' };
  }
  return null;
}

/* ─── LIVREUR ─────────────────────────────────────────────────── */

const L = '/dashboard/livreur';

/** Nouvelle mission confiée (à accepter ou refuser). */
function isMissionOffer(n: NotificationTargetInput): boolean {
  if (n.payload?.kind === 'mission_assigned') return true;
  /* Anciennes notifications : « order.placed » adressée au livreur = mission choisie à la commande */
  return n.type === 'order.placed';
}

function forDelivery(n: NotificationTargetInput): NotificationTarget {
  const prefix = n.type.split('.')[0];
  const rt = n.resourceType ?? '';

  /* Missions diffusées par l'entreprise : elles s'acceptent sur l'accueil du livreur. */
  if (rt === 'livreur_mission') {
    return { web: L, app: '/livreur', label: 'Voir les missions disponibles', category: 'missions' };
  }

  /* Avis laissé par un client sur une livraison. */
  if (rt === 'review' || prefix === 'review') {
    return { web: `${L}/evaluation`, app: '/livreur/evaluation', label: 'Voir l’avis', category: 'avis' };
  }

  /* Gains : commission d'une livraison → revenus. */
  if (rt === 'commission') {
    return { web: `${L}/revenus`, app: '/livreur/revenus', label: 'Voir mes gains', category: 'gains' };
  }

  /* Portefeuille gelé → l'aide (seul moyen de le débloquer). */
  if (rt === 'wallet' && prefix === 'account') {
    return { web: '/support', app: '/support', label: 'Contacter l’aide', category: 'compte' };
  }

  /* Mouvements du portefeuille et retraits. */
  if (rt === 'wallet' || rt === 'retrait') {
    return { web: `${L}/wallet`, app: '/livreur/portefeuille', label: 'Voir mon portefeuille', category: 'gains' };
  }

  /* Tout ce qui concerne UNE commande : la mission correspondante. */
  const cmd = commandeIdOf(n);
  if (cmd && (prefix === 'order' || prefix === 'delivery' || prefix === 'payment' || prefix === 'colis'
    || rt === 'order' || rt === 'payment' || rt === 'escrow' || rt === 'dispute')) {
    const offer = isMissionOffer(n);
    return {
      /* Le site accepte/refuse une mission sur « Missions » ; ensuite la page de suivi
       * de la commande (adaptée au livreur : code de validation, étapes). */
      web: offer ? `${L}/missions?mission=${cmd}` : `/commande/${cmd}/suivi`,
      app: `/livreur/missions/${cmd}`,
      label: offer ? 'Voir la mission' : rt === 'dispute' ? 'Voir le litige' : prefix === 'payment' || rt === 'escrow' ? 'Voir la commande' : 'Suivre la mission',
      category: rt === 'escrow' || prefix === 'payment' ? 'gains' : 'missions',
    };
  }

  /* Nouvel abonné : son profil s'il en a un dans l'espace livreur, sinon mon profil (compteur d'abonnés). */
  if (prefix === 'follow') {
    const id = isId(n.actorId) ? n.actorId : null;
    if (id && n.actorType === NotificationActorType.DELIVERY) {
      return { web: `${L}/reseau/livreurs/${id}`, app: `/livreur/reseau/livreurs/${id}`, label: 'Voir son profil', category: 'compte' };
    }
    if (id && n.actorType === NotificationActorType.CORRESPONDENT) {
      return { web: `${L}/reseau/correspondants/${id}`, app: `/livreur/reseau/correspondants/${id}`, label: 'Voir son profil', category: 'compte' };
    }
    if (id && n.actorType === NotificationActorType.COMPANY) {
      return { web: `${L}/boutiques`, app: `/boutique/${id}`, label: 'Voir la boutique', category: 'compte' };
    }
    return { web: `${L}/profil`, app: '/livreur/profil', label: 'Voir mon profil', category: 'compte' };
  }

  /* Compte : validé, suspendu, réactivé, vérifié… */
  if (prefix === 'account' || prefix === 'invitation' || rt === 'account' || rt === 'acteur') {
    return { web: `${L}/profil`, app: '/livreur/profil', label: 'Voir mon compte', category: 'compte' };
  }

  /* Annonce de l'équipe Shoneya ou autre : l'adresse donnée par le serveur si
   * elle reste dans l'espace livreur, sinon l'accueil ; pas d'écran dédié dans
   * l'application → elle affiche le détail. */
  const url = n.actionUrl ?? '';
  const web = url.startsWith(L) || url.startsWith('/support') || url.startsWith('/aide') ? url : L;
  return { web, app: null, label: 'Ouvrir', category: prefix === 'payment' ? 'gains' : 'compte' };
}

/**
 * Où mène la notification pour SON destinataire. `null` = pas de règle
 * spécifique (le client applique sa logique habituelle).
 */
export function resolveNotificationTarget(n: NotificationTargetInput): NotificationTarget | null {
  const u = universal(n);
  if (u) return u;
  if ((n.recipientType as NotificationActorType) === NotificationActorType.DELIVERY) return forDelivery(n);
  return null;
}

/** Ajoute `notif=<id>` à une route : l'écran ouvert depuis un push marque la notification lue. */
export function withNotifParam(path: string, notifId: string | null | undefined): string {
  if (!notifId) return path;
  return `${path}${path.includes('?') ? '&' : '?'}notif=${encodeURIComponent(notifId)}`;
}
