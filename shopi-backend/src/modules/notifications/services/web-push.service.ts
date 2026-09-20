/* ============================================================
 * FICHIER : src/modules/notifications/services/web-push.service.ts
 *
 * RÔLE : Envoi des notifications Web Push (standard W3C + VAPID) vers les
 * navigateurs / applications installées (PWA Chrome, Firefox, Edge, Safari
 * iOS 16.4+). Gratuit, sans compte Firebase ni carte bancaire : le navigateur
 * fournit lui-même une "subscription" (endpoint + clés), que le client envoie
 * à POST /notifications/push-token (platform = 'web', token = JSON).
 *
 * CONFIG (variables d'environnement, à définir aussi sur Render) :
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  — paire générée une seule fois
 *   VAPID_SUBJECT                          — mailto:… ou https://… (contact)
 * Sans ces variables le service est simplement INACTIF (aucun crash) :
 * l'app continue de fonctionner, sans push.
 *
 * SÉCURITÉ (SSRF) — le serveur POSTe vers l'`endpoint` fourni par le client.
 * Sans contrôle, un utilisateur pourrait enregistrer une URL interne
 * (métadonnées cloud, localhost, réseau privé) et faire émettre des requêtes
 * par le serveur. On n'accepte donc QUE du https vers les vrais services push
 * des navigateurs (liste blanche ci-dessous).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import * as webpush           from 'web-push';

/** Services push légitimes (Chrome/Android, Firefox, Safari, Edge). */
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
];

/** Abonnement Web Push tel que renvoyé par PushManager.subscribe().toJSON(). */
export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Contenu affiché par le service worker (reste < 4 Ko, limite du standard). */
export interface WebPushPayload {
  title:   string;
  body:    string;
  /** Route interne ouverte au clic (ex: /messagerie?conv=…). */
  url?:    string;
  /** Petite image de la notification (ex: avatar de l'expéditeur). */
  icon?:   string;
  /** Grande image (ex: photo d'un produit). */
  image?:  string;
  /** Regroupe/remplace les notifications d'un même sujet (ex: une conversation). */
  tag?:    string;
  /** Nombre de non-lus → pastille sur l'icône de l'application. */
  unread?: number;
  type?:   string;
  notifId?: string;
}

export interface WebPushResult {
  ok:      boolean;
  /** true = abonnement définitivement invalide (404/410) → à supprimer. */
  gone?:   boolean;
  status?: number;
}

function isAllowedEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

@Injectable()
export class WebPushService {

  private readonly logger  = new Logger(WebPushService.name);
  private readonly publicKey: string | null;

  constructor(config: ConfigService) {
    const pub     = config.get<string>('VAPID_PUBLIC_KEY');
    const priv    = config.get<string>('VAPID_PRIVATE_KEY');
    const subject = config.get<string>('VAPID_SUBJECT') ?? 'mailto:noreply@shoneya.com';

    if (pub && priv) {
      try {
        webpush.setVapidDetails(subject, pub, priv);
        this.publicKey = pub;
        this.logger.log('Web Push actif (clés VAPID chargées).');
        return;
      } catch (err) {
        this.logger.error(`Clés VAPID invalides — Web Push désactivé : ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes — Web Push désactivé.');
    }
    this.publicKey = null;
  }

  isEnabled(): boolean { return this.publicKey !== null; }

  /** Clé publique exposée au navigateur pour s'abonner (non secrète). */
  getPublicKey(): string | null { return this.publicKey; }

  /**
   * Valide et normalise le `token` stocké pour une plateforme 'web'
   * (JSON de la subscription). Renvoie null si invalide ou hors liste blanche.
   */
  parseSubscription(token: string): WebPushSubscription | null {
    if (typeof token !== 'string' || token.length > 4096) return null;
    let data: any;
    try { data = JSON.parse(token); } catch { return null; }
    if (!data || !isAllowedEndpoint(data.endpoint)) return null;
    const p256dh = data.keys?.p256dh;
    const auth   = data.keys?.auth;
    if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
    if (p256dh.length > 200 || auth.length > 100) return null;
    return { endpoint: data.endpoint, keys: { p256dh, auth } };
  }

  async send(
    subscription: WebPushSubscription,
    payload:      WebPushPayload,
    urgent = false,
  ): Promise<WebPushResult> {
    if (!this.publicKey) return { ok: false };

    const body = JSON.stringify({
      ...payload,
      title: payload.title.slice(0, 100),
      body:  payload.body.slice(0, 180),
    });

    try {
      const res = await webpush.sendNotification(subscription, body, {
        TTL:     24 * 60 * 60,                 // 24 h : au-delà, un message périmé n'a plus d'intérêt
        urgency: urgent ? 'high' : 'normal',
        timeout: 8_000,
      });
      return { ok: true, status: res.statusCode };
    } catch (err: any) {
      const status = Number(err?.statusCode) || undefined;
      const gone   = status === 404 || status === 410;
      if (!gone) {
        this.logger.warn(`Web Push échec (${status ?? err?.code ?? 'réseau'}) : ${String(err?.body ?? err?.message).slice(0, 120)}`);
      }
      return { ok: false, gone, status };
    }
  }
}
