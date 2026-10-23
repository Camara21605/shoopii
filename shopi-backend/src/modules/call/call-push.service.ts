/* ============================================================
 * FICHIER : src/modules/call/call-push.service.ts
 *
 * RÔLE : Faire sonner un appel entrant sur le téléphone de l'appelé MÊME
 * SI l'application est fermée ou en arrière-plan :
 *   - site / PWA : push Web haute priorité → notification « <Nom> — Appel
 *     audio entrant » avec Répondre / Refuser (public/push-sw.js) ;
 *   - application Android : push FCM « data » haute priorité → écran d'appel
 *     plein écran avec la sonnerie du téléphone, en boucle, même verrouillé
 *     (shopi-mobile/modules/shopi-calls). Envoyé UNE fois : c'est le téléphone
 *     qui fait durer la sonnerie, pas besoin de renvoi.
 *
 * FONCTIONNEMENT
 *   1. call:initiate réussit → notifyIncoming() : push urgent, expire au
 *      bout de 45 s (une sonnerie n'a aucun intérêt au-delà).
 *   2. Décroché, refusé, annulé, manqué → notifyEnded() : ferme la
 *      notification (y compris sur les AUTRES appareils du même compte).
 *   3. « Refuser » depuis la notification : le service worker n'a ni session
 *      ni cookie. Il présente un jeton SIGNÉ lié à cet appel et à ce
 *      destinataire (signRejectToken / verifyRejectToken) — un jeton volé ne
 *      permet de refuser QUE cet appel, et seulement pendant ~45 s.
 *
 * Respecte les réglages du destinataire : notifications push coupées ou mode
 * « ne pas déranger » → aucun push (l'appel sonne normalement dans l'appli).
 * Ne lève jamais : un push raté ne doit jamais faire échouer l'appel.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

import { NotificationPreferenceService } from '../notifications/services/notification-preference.service';
import { WebPushService }                from '../notifications/services/web-push.service';
import { FcmService }                    from '../notifications/services/fcm.service';
import { isDndActive }                   from '../notifications/utils/dnd.util';
import { NotificationActorType }         from 'src/database/entities/notification/notification.entity';
import { CallService }                   from './call.service';
import { CallStatus }                    from 'src/database/entities/call/call.entity';

/** Durée pendant laquelle une sonnerie (et son jeton de refus) reste valable. */
export const CALL_PUSH_TTL_S = 45;

/**
 * Une notification web ne peut sonner/vibrer QU'UNE fois (le téléphone joue son son de
 * notification, pas une sonnerie en boucle). Pour reproduire une vraie sonnerie, le serveur
 * RENVOIE la notification (même tag, `renotify`) toutes les 6 s tant que l'appel sonne : à chaque
 * renvoi le téléphone sonne et vibre de nouveau. S'arrête dès que l'appel est décroché, refusé,
 * annulé ou expiré.
 */
export const RING_REPEAT_INTERVAL_MS = 6_000;
export const RING_REPEAT_MAX         = 6;

export interface IncomingCallPush {
  calleeUserId:   string;
  callId:         string;
  conversationId: string;
  callerUserId:   string;
  callerName:     string;
  callerAvatar?:  string | null;
  callType:       'audio' | 'video';
}

@Injectable()
export class CallPushService {

  private readonly logger = new Logger(CallPushService.name);

  /** callId → minuteur de renvoi de la sonnerie. */
  private readonly ringTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly webPush:     WebPushService,
    private readonly fcm:         FcmService,
    private readonly prefs:       NotificationPreferenceService,
    private readonly callService: CallService,
    private readonly config:      ConfigService,
  ) {}

  // ── Jeton de refus signé ─────────────────────────────────────

  private secret(): Buffer {
    /* Clé dérivée de JWT_SECRET pour cet usage précis : ne sert jamais à autre chose. */
    return createHmac('sha256', this.config.get<string>('JWT_SECRET') ?? 'no-secret')
      .update('call-push-reject-v1').digest();
  }

  signRejectToken(callId: string, calleeUserId: string): string {
    const body = Buffer.from(JSON.stringify({
      c: callId, u: calleeUserId, e: Date.now() + CALL_PUSH_TTL_S * 1000,
    })).toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /** Renvoie { callId, calleeUserId } si le jeton est authentique et non expiré, sinon null. */
  verifyRejectToken(token: string): { callId: string; calleeUserId: string } | null {
    if (typeof token !== 'string' || token.length > 600) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = createHmac('sha256', this.secret()).update(body).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (typeof data.c !== 'string' || typeof data.u !== 'string' || typeof data.e !== 'number') return null;
      if (Date.now() > data.e) return null;
      return { callId: data.c, calleeUserId: data.u };
    } catch {
      return null;
    }
  }

  // ── Envoi ────────────────────────────────────────────────────

  /** Appareils du destinataire autorisés à recevoir ce push (navigateurs et téléphones Android). */
  private async devicesFor(calleeUserId: string): Promise<{
    devices: { token: string }[]; android: { token: string }[];
    actorType: NotificationActorType; actorId: string;
  } | null> {
    const webOn = this.webPush.isEnabled();
    const fcmOn = this.fcm.isEnabled();
    if (!webOn && !fcmOn) return null;
    const recipient = await this.callService.resolveNotificationRecipient(calleeUserId);
    if (!recipient) return null;

    const pref = await this.prefs.getOrCreate(recipient.type, recipient.id);
    if (!pref.globalPushEnabled || isDndActive(pref)) return null;

    const tokens  = pref.pushTokens ?? [];
    const devices = webOn ? tokens.filter(t => t.platform === 'web') : [];
    const android = fcmOn ? tokens.filter(t => t.platform === 'android') : [];
    return devices.length || android.length
      ? { devices, android, actorType: recipient.type, actorId: recipient.id }
      : null;
  }

  /**
   * Le destinataire a-t-il au moins un appareil qui peut sonner par push
   * (push activé, pas en « ne pas déranger ») ? Sert à ne pas déclarer
   * « hors ligne » quelqu'un dont l'application est simplement fermée.
   * Ne lève jamais.
   */
  async peutSonner(calleeUserId: string): Promise<boolean> {
    try {
      return !!(await this.devicesFor(calleeUserId));
    } catch {
      return false;
    }
  }

  /** URL publique de l'API, pour que le service worker puisse refuser l'appel. */
  private rejectUrl(): string | undefined {
    const base = this.config.get<string>('API_PUBLIC_URL') ?? this.config.get<string>('RENDER_EXTERNAL_URL');
    return base ? `${base.replace(/\/+$/, '').replace(/\/api$/, '')}/api/calls/push-reject` : undefined;
  }

  /**
   * Envoie UNE fois la notification d'appel. reachable=false : personne n'est
   * joignable ; delivered : au moins un appareil a accepté la notification
   * (l'appelant voit alors « Ça sonne… »).
   * `rering` : renvoi périodique — seulement vers les navigateurs (le téléphone Android
   * fait déjà sonner en boucle ; un renvoi relancerait la sonnerie depuis le début).
   */
  private async sendIncomingOnce(call: IncomingCallPush, rering = false): Promise<{ reachable: boolean; delivered: boolean }> {
    const target = await this.devicesFor(call.calleeUserId);
    if (!target) return { reachable: false, delivered: false };
    if (rering && !target.devices.length) return { reachable: false, delivered: false };
    let delivered = false;

    const label = call.callType === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant';
    const rejectUrl = this.rejectUrl();
    const expiresAt = Date.now() + CALL_PUSH_TTL_S * 1000;

    const payload = {
      title: call.callerName,
      body:  label,
      icon:  call.callerAvatar ?? undefined,
      tag:   `call:${call.callId}`,
      type:  'call.incoming',
      url:   `/messagerie?conv=${call.conversationId}`,
      data: {
        callId:         call.callId,
        conversationId: call.conversationId,
        callerUserId:   call.callerUserId,
        callType:       call.callType,
        expiresAt,
        ...(rejectUrl && { rejectUrl, rejectToken: this.signRejectToken(call.callId, call.calleeUserId) }),
      },
    };

    const gone: string[] = [];
    await Promise.all(target.devices.map(async (device) => {
      const subscription = this.webPush.parseSubscription(device.token);
      if (!subscription) { gone.push(device.token); return; }
      const result = await this.webPush.send(subscription, payload, true, {
        ttlSeconds: CALL_PUSH_TTL_S,
        topic:      call.callId.replace(/-/g, '').slice(0, 32),
      });
      if (result.ok) delivered = true;
      if (result.gone) gone.push(device.token);
    }));

    if (!rering) {
      const data: Record<string, string> = {
        type:           'call.incoming',
        callId:         call.callId,
        conversationId: call.conversationId,
        callerUserId:   call.callerUserId,
        callerName:     call.callerName,
        callerAvatar:   call.callerAvatar ?? '',
        callType:       call.callType,
        expiresAt:      String(expiresAt),
        ...(rejectUrl && { rejectUrl, rejectToken: this.signRejectToken(call.callId, call.calleeUserId) }),
      };
      await Promise.all(target.android.map(async (device) => {
        const result = await this.fcm.sendData(device.token, data, { ttlSeconds: CALL_PUSH_TTL_S });
        if (result.ok) delivered = true;
        if (result.gone) gone.push(device.token);
      }));
    }

    for (const token of gone) {
      await this.prefs.removeToken(target.actorType, target.actorId, { token });
    }
    return { reachable: true, delivered };
  }

  /** true : la notification d'appel est partie vers au moins un appareil (il sonne). */
  async notifyIncoming(call: IncomingCallPush): Promise<boolean> {
    try {
      const sent = await this.sendIncomingOnce(call);
      if (!sent.reachable) return false;
      this.scheduleRering(call, 1);
      return sent.delivered;
    } catch (err) {
      this.logger.warn(`Push d'appel entrant ignoré : ${(err as Error).message}`);
      return false;
    }
  }

  /** Renvoie la sonnerie tant que l'appel sonne encore (voir RING_REPEAT_INTERVAL_MS). */
  private scheduleRering(call: IncomingCallPush, attempt: number): void {
    if (attempt > RING_REPEAT_MAX) return;
    const timer = setTimeout(() => {
      void (async () => {
        this.ringTimers.delete(call.callId);
        try {
          const current = await this.callService.findCallById(call.callId);
          if (!current || current.status !== CallStatus.RINGING) return;   // décroché / refusé / annulé : on s'arrête
          if (!(await this.sendIncomingOnce(call, true)).reachable) return;
          this.scheduleRering(call, attempt + 1);
        } catch (err) {
          this.logger.warn(`Renvoi de sonnerie ignoré : ${(err as Error).message}`);
        }
      })();
    }, RING_REPEAT_INTERVAL_MS);
    timer.unref?.();
    this.ringTimers.set(call.callId, timer);
  }

  private stopRering(callId: string): void {
    const timer = this.ringTimers.get(callId);
    if (timer) { clearTimeout(timer); this.ringTimers.delete(callId); }
  }

  /** Ferme la notification d'appel (décroché, refusé, annulé, manqué) sur tous les appareils du destinataire. */
  async notifyEnded(calleeUserId: string, callId: string): Promise<void> {
    this.stopRering(callId);
    try {
      const target = await this.devicesFor(calleeUserId);
      if (!target) return;
      await Promise.all(target.devices.map(async (device) => {
        const subscription = this.webPush.parseSubscription(device.token);
        if (!subscription) return;
        await this.webPush.send(subscription, {
          title: 'Appel terminé',
          body:  '',
          tag:   `call:${callId}`,
          type:  'call.ended',
          data:  { callId },
        }, true, { ttlSeconds: 20 });
      }));
      /* Téléphones Android : coupe la sonnerie et retire l'écran d'appel. */
      await Promise.all(target.android.map(device =>
        this.fcm.sendData(device.token, { type: 'call.ended', callId }, { ttlSeconds: 20 })));
    } catch (err) {
      this.logger.warn(`Push de fin d'appel ignoré : ${(err as Error).message}`);
    }
  }
}
