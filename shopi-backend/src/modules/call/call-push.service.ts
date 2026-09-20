/* ============================================================
 * FICHIER : src/modules/call/call-push.service.ts
 *
 * RÔLE : Faire sonner un appel entrant sur le téléphone de l'appelé MÊME
 * SI l'application est fermée ou en arrière-plan : un push Web à haute
 * priorité affiche une notification « <Nom> — Appel audio entrant » avec
 * les boutons Répondre / Refuser (rendu dans public/push-sw.js).
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
import { isDndActive }                   from '../notifications/utils/dnd.util';
import { NotificationActorType }         from 'src/database/entities/notification/notification.entitiy';
import { CallService }                   from './call.service';

/** Durée pendant laquelle une sonnerie (et son jeton de refus) reste valable. */
export const CALL_PUSH_TTL_S = 45;

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

  constructor(
    private readonly webPush:     WebPushService,
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

  /** Appareils web du destinataire autorisés à recevoir ce push. */
  private async devicesFor(calleeUserId: string): Promise<{
    devices: { token: string }[]; actorType: NotificationActorType; actorId: string;
  } | null> {
    if (!this.webPush.isEnabled()) return null;
    const recipient = await this.callService.resolveNotificationRecipient(calleeUserId);
    if (!recipient) return null;

    const pref = await this.prefs.getOrCreate(recipient.type, recipient.id);
    if (!pref.globalPushEnabled || isDndActive(pref)) return null;

    const devices = (pref.pushTokens ?? []).filter(t => t.platform === 'web');
    return devices.length ? { devices, actorType: recipient.type, actorId: recipient.id } : null;
  }

  /** URL publique de l'API, pour que le service worker puisse refuser l'appel. */
  private rejectUrl(): string | undefined {
    const base = this.config.get<string>('API_PUBLIC_URL') ?? this.config.get<string>('RENDER_EXTERNAL_URL');
    return base ? `${base.replace(/\/+$/, '').replace(/\/api$/, '')}/api/calls/push-reject` : undefined;
  }

  async notifyIncoming(call: IncomingCallPush): Promise<void> {
    try {
      const target = await this.devicesFor(call.calleeUserId);
      if (!target) return;

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
        if (result.gone) gone.push(device.token);
      }));
      for (const token of gone) {
        await this.prefs.removeToken(target.actorType, target.actorId, { token });
      }
    } catch (err) {
      this.logger.warn(`Push d'appel entrant ignoré : ${(err as Error).message}`);
    }
  }

  /** Ferme la notification d'appel (décroché, refusé, annulé, manqué) sur tous les appareils du destinataire. */
  async notifyEnded(calleeUserId: string, callId: string): Promise<void> {
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
    } catch (err) {
      this.logger.warn(`Push de fin d'appel ignoré : ${(err as Error).message}`);
    }
  }
}
