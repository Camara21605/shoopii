/* ============================================================
 * FICHIER : src/modules/notifications/services/android-push.service.ts
 *
 * RÔLE : Notifications système de l'application Android (FCM), pour TOUS
 * les types : messages, commandes, livraisons, paiements, avis, promotions,
 * compte, assistance…
 *
 * On envoie un message FCM « data » haute priorité (jamais un bloc
 * « notification » tout fait) : c'est l'application qui construit la
 * notification — logo Shoneya, catégorie lisible (« Commande », « Message »…),
 * photo de l'expéditeur, conversation regroupée, boutons Répondre / Marquer
 * comme lu (voir shopi-mobile/modules/shopi-calls/…/NotifNotifier.kt).
 * Haute priorité : arrive tout de suite même téléphone en veille.
 * Ne lève jamais.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FcmService, type FcmSendResult } from './fcm.service';

/** Catégorie = canal Android (réglable par l'utilisateur) + libellé affiché dans l'en-tête. */
export interface PushCategory { id: string; label: string }

const CATEGORIES: Array<[RegExp, PushCategory]> = [
  [/^(message|conversation)\./,                 { id: 'messages',   label: 'Message' }],
  [/^(call|group_call)\./,                      { id: 'calls',      label: 'Appel manqué' }],
  [/^(order|return)\./,                         { id: 'orders',     label: 'Commande' }],
  [/^(delivery|colis)\./,                       { id: 'deliveries', label: 'Livraison' }],
  [/^payment\./,                                { id: 'payments',   label: 'Paiement' }],
  [/^review\./,                                 { id: 'social',     label: 'Avis' }],
  [/^(follow|story)\.|^(product|service)\.liked/, { id: 'social',   label: 'Activité' }],
  [/^(promo|crm)\./,                            { id: 'promos',     label: 'Promotion' }],
  [/^(stock|product)\./,                        { id: 'products',   label: 'Produit' }],
  [/^(account|invitation)\./,                   { id: 'account',    label: 'Compte' }],
  [/^support\./,                                { id: 'support',    label: 'Assistance' }],
  [/^system\./,                                 { id: 'system',     label: 'Shoneya' }],
];

export function pushCategory(type: string): PushCategory {
  for (const [re, cat] of CATEGORIES) if (re.test(type)) return cat;
  return { id: 'general', label: 'Notification' };
}

/**
 * Écran de l'application mobile à ouvrir au toucher (routes expo-router de
 * shopi-mobile) : la conversation, le groupe, sinon le centre de notifications
 * (qui mène ensuite à la commande, au produit…).
 */
export function appRoute(resourceType?: string | null, resourceId?: string | null, extra?: Record<string, string | null | undefined>): string {
  const q = extra
    ? Object.entries(extra).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
    : '';
  if (resourceType === 'conversation' && resourceId) return `/messages/${resourceId}${q ? `?${q}` : ''}`;
  if (resourceType === 'delivery_group' && resourceId) return `/messages/groupe/${resourceId}`;
  return '/notifications';
}

/** Ce qui est affiché ; tout est converti en chaînes (exigence FCM). */
export interface AndroidNotifContent {
  type:           string;
  title:          string;
  body:           string;
  /** Photo de l'expéditeur / de la boutique (grande icône ronde). */
  avatar?:        string | null;
  /** Écran de l'application à ouvrir (route expo-router). */
  route:          string;
  /** Les notifications de même `tag` se remplacent (une par conversation, une par commande…). */
  tag:            string;
  notifId?:       string | null;
  unread?:        number;
  conversationId?: string | null;
  senderName?:    string | null;
  /** Boutons Répondre / Marquer comme lu (messages uniquement). */
  actionToken?:   string | null;
}

@Injectable()
export class AndroidPushService {

  constructor(
    private readonly fcm:    FcmService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.fcm.isEnabled();
  }

  /** URL publique de l'API (les boutons de la notification l'appellent directement). */
  apiBase(): string | undefined {
    const base = this.config.get<string>('API_PUBLIC_URL') ?? this.config.get<string>('RENDER_EXTERNAL_URL');
    return base ? `${base.replace(/\/+$/, '').replace(/\/api$/, '')}/api` : undefined;
  }

  buildData(c: AndroidNotifContent): Record<string, string> {
    const cat = pushCategory(c.type);
    const api = this.apiBase();
    const data: Record<string, string> = {
      kind:          'notif',
      type:          c.type,
      category:      cat.id,
      categoryLabel: cat.label,
      title:         c.title.slice(0, 120),
      body:          c.body.slice(0, 900),
      route:         c.route,
      tag:           c.tag.slice(0, 200),
      sentAt:        String(Date.now()),
    };
    if (c.avatar)         data.avatar = c.avatar;
    if (c.notifId)        data.notifId = c.notifId;
    if (typeof c.unread === 'number') data.unread = String(c.unread);
    if (c.conversationId) data.conversationId = c.conversationId;
    if (c.senderName)     data.senderName = c.senderName;
    if (c.actionToken && api) {
      data.actionToken = c.actionToken;
      data.replyUrl    = `${api}/messagerie/push-reply`;
      data.readUrl     = `${api}/messagerie/push-read`;
    }
    return data;
  }

  /** Envoi vers UN téléphone. `gone` = jeton à supprimer (application désinstallée). */
  send(token: string, data: Record<string, string>): Promise<FcmSendResult> {
    return this.fcm.sendData(token, data, { ttlSeconds: 24 * 60 * 60 });
  }

  /** Ferme une notification sur les téléphones (conversation lue ailleurs, commande traitée…). */
  dismiss(token: string, tag: string): Promise<FcmSendResult> {
    return this.fcm.sendData(token, { kind: 'dismiss', tag }, { ttlSeconds: 6 * 60 * 60 });
  }
}
