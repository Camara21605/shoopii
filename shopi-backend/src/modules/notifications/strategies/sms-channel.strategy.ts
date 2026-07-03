/* ============================================================
 * FICHIER : src/modules/notifications/strategies/sms-channel.strategy.ts
 *
 * RÔLE : Strategy SMS — stub prêt pour Twilio / Orange GN / MTN GN.
 *
 * ÉTAT ACTUEL : Stub fonctionnel (Phase 1).
 *   → Log l'envoi sans appel API réel.
 *   → Prêt à être branché sur Twilio en Phase 2.
 *
 * POURQUOI UN STUB ?
 *   → L'infrastructure (queue, delivery log, retry, DND) est en place.
 *   → Brancher Twilio = 20 lignes dans sendViaTwilio().
 *   → Le reste du système ne change pas.
 *
 * FOURNISSEURS PLANIFIÉS :
 *   - Twilio (international)
 *   - Orange Guinée API (local +224 6xx)
 *   - MTN Guinée API   (local +224 6xx)
 *
 * Le choix du fournisseur se fera selon le préfixe du numéro.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import {
  Notification, NotificationChannel, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { IChannelStrategy }       from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult }        from '../interfaces/notification.interfaces';
import { isDndActive }                 from '../utils/dnd.util';

@Injectable()
export class SmsChannelStrategy implements IChannelStrategy {

  readonly channel = NotificationChannel.SMS;

  private readonly logger = new Logger(SmsChannelStrategy.name);

  constructor(
    private readonly config: ConfigService,
  ) {}

  canSend(pref: NotificationPreference, notif: Notification): boolean {
    // 1. Switch global SMS (opt-out requis légalement)
    if (!pref.globalSmsEnabled) return false;

    // 2. Mode DND (sauf URGENT)
    if (
      notif.priority !== NotificationPriority.URGENT &&
      isDndActive(pref)
    ) return false;

    // 3. Préférence par type
    const typePref = pref.preferences?.[notif.type];
    if (typePref && typePref.sms === false) return false;

    // 4. Numéro disponible
    if (!pref.notificationPhone) return false;

    return true;
  }

  async deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult> {
    const phone = pref.notificationPhone!;
    const start = Date.now();

    try {
      // ── Sélection du fournisseur selon le préfixe ─────
      const result = await this.dispatch(phone, notif.body);

      this.logger.debug(
        `SMS sent notif=${notif.id} to=${phone} `
        + `provider=${result.provider} duration=${Date.now() - start}ms`,
      );

      return {
        channel:          NotificationChannel.SMS,
        success:          true,
        providerMessageId: result.messageId,
        durationMs:       Date.now() - start,
        meta:             { phoneUsed: phone },
      };
    } catch (err: any) {
      this.logger.warn(
        `SMS failed notif=${notif.id} to=${phone} err=${err?.message}`,
      );
      return {
        channel:            NotificationChannel.SMS,
        success:            false,
        errorCode:          err?.code ?? 'SMS_ERROR',
        errorMessage:       err?.message ?? 'Erreur envoi SMS',
        isPermanentFailure: false,
        durationMs:         Date.now() - start,
        meta:               { phoneUsed: phone },
      };
    }
  }

  // ─── Dispatch selon le préfixe du numéro ─────────────────

  private async dispatch(
    phone: string,
    body:  string,
  ): Promise<{ provider: string; messageId: string }> {
    // +224 → numéro guinéen → Orange GN ou MTN GN (Phase 2)
    // Autre → Twilio international
    const isGuinean = phone.startsWith('+224');

    if (isGuinean) {
      return this.sendViaOrangeGN(phone, body);
    }
    return this.sendViaTwilio(phone, body);
  }

  /**
   * STUB — Orange Guinée SMS API.
   * À brancher en Phase 2 avec les credentials Orange.
   *
   * Documentation Orange GN : https://developer.orange.com/apis/sms-gn
   */
  private async sendViaOrangeGN(
    phone: string,
    body:  string,
  ): Promise<{ provider: string; messageId: string }> {
    this.logger.log(`[STUB] Orange GN SMS → ${phone}: "${body.substring(0, 50)}..."`);
    // TODO Phase 2: appel API Orange GN
    return { provider: 'orange_gn', messageId: `stub-${Date.now()}` };
  }

  /**
   * STUB — Twilio SMS API.
   * À brancher en Phase 2 avec TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN.
   */
  private async sendViaTwilio(
    phone: string,
    body:  string,
  ): Promise<{ provider: string; messageId: string }> {
    this.logger.log(`[STUB] Twilio SMS → ${phone}: "${body.substring(0, 50)}..."`);
    // TODO Phase 2:
    // const client = twilio(this.config.get('TWILIO_ACCOUNT_SID'), ...);
    // const msg = await client.messages.create({ to: phone, from: '...', body });
    // return { provider: 'twilio', messageId: msg.sid };
    return { provider: 'twilio', messageId: `stub-${Date.now()}` };
  }
}
