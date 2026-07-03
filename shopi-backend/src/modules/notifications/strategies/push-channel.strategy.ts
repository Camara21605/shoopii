/* ============================================================
 * FICHIER : src/modules/notifications/strategies/push-channel.strategy.ts
 *
 * RÔLE : Strategy PUSH — FCM (Android/Web) + APNs (iOS).
 *
 * ÉTAT ACTUEL : Stub fonctionnel avec structure FCM complète.
 *   → La logique de sélection token/plateforme est en place.
 *   → L'appel FCM réel est commenté (nécessite firebase-admin).
 *   → Prêt à activer en ajoutant : npm i firebase-admin
 *
 * GESTION MULTI-APPAREILS :
 *   Un acteur peut avoir plusieurs tokens (téléphone + tablette + web).
 *   → Envoi en parallèle sur tous les tokens via Promise.allSettled()
 *   → Si un token est invalide → nettoyage automatique dans preferences
 *
 * CODES D'ERREUR FCM CRITIQUES :
 *   - messaging/registration-token-not-registered → supprimer le token
 *   - messaging/invalid-registration-token        → supprimer le token
 *   - messaging/message-rate-exceeded             → retry (temporaire)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import {
  Notification, NotificationChannel, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import {
  NotificationPreference, PushToken,
} from 'src/database/entities/notification/notification-preference.entity';
import type { IChannelStrategy }  from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult }   from '../interfaces/notification.interfaces';
import { isDndActive }            from '../utils/dnd.util';

/** Codes FCM nécessitant la suppression immédiate du token */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

@Injectable()
export class PushChannelStrategy implements IChannelStrategy {

  readonly channel = NotificationChannel.PUSH;

  private readonly logger = new Logger(PushChannelStrategy.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
  ) {}

  canSend(pref: NotificationPreference, notif: Notification): boolean {
    // 1. Switch global push
    if (!pref.globalPushEnabled) return false;

    // 2. Mode DND (sauf URGENT)
    if (
      notif.priority !== NotificationPriority.URGENT &&
      isDndActive(pref)
    ) return false;

    // 3. Préférence par type
    const typePref = pref.preferences?.[notif.type];
    if (typePref && typePref.push === false) return false;

    // 4. Au moins un token push enregistré
    if (!pref.pushTokens?.length) return false;

    return true;
  }

  async deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult> {
    const tokens = pref.pushTokens ?? [];
    const start  = Date.now();

    if (!tokens.length) {
      return {
        channel:            NotificationChannel.PUSH,
        success:            false,
        errorCode:          'NO_TOKENS',
        isPermanentFailure: true,
      };
    }

    // Envoie en parallèle sur tous les appareils
    const results = await Promise.allSettled(
      tokens.map(t => this.sendToToken(t, notif)),
    );

    // Tokens invalides à nettoyer
    const invalidTokens: string[] = [];
    let   anySuccess = false;
    let   lastError  = '';

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        if (r.value.success) {
          anySuccess = true;
        } else if (r.value.invalidToken) {
          invalidTokens.push(tokens[i].token);
          lastError = r.value.errorCode ?? 'PUSH_ERROR';
        }
      }
    }

    // Nettoyage des tokens invalides
    if (invalidTokens.length > 0) {
      await this.removeInvalidTokens(pref.id, invalidTokens);
    }

    return {
      channel:    NotificationChannel.PUSH,
      success:    anySuccess,
      errorCode:  anySuccess ? undefined : lastError,
      durationMs: Date.now() - start,
    };
  }

  // ─── Envoi sur un token spécifique ───────────────────────

  private async sendToToken(
    token: PushToken,
    notif: Notification,
  ): Promise<{ success: boolean; invalidToken?: boolean; errorCode?: string }> {
    try {
      this.logger.debug(
        `[STUB] Push → platform=${token.platform} `
        + `token=...${token.token.slice(-8)} notif=${notif.id}`,
      );

      // TODO Phase 2 : firebase-admin
      //
      // import * as admin from 'firebase-admin';
      //
      // await admin.messaging().send({
      //   token: token.token,
      //   notification: {
      //     title: notif.title,
      //     body:  notif.body,
      //     imageUrl: notif.imageUrl ?? undefined,
      //   },
      //   data: {
      //     notifId:      notif.id,
      //     type:         notif.type,
      //     resourceType: notif.resourceType ?? '',
      //     resourceId:   notif.resourceId   ?? '',
      //     actionUrl:    notif.actionUrl     ?? '',
      //   },
      //   android: {
      //     priority: notif.priority === NotificationPriority.URGENT ? 'high' : 'normal',
      //     notification: { sound: 'default', channelId: 'shopi_notifications' },
      //   },
      //   apns: {
      //     payload: { aps: { sound: 'default', badge: 1 } },
      //   },
      // });

      return { success: true };
    } catch (err: any) {
      const code       = err?.errorInfo?.code ?? err?.code ?? 'PUSH_ERROR';
      const isInvalid  = INVALID_TOKEN_CODES.has(code);

      this.logger.warn(
        `Push failed token=...${token.token.slice(-8)} code=${code}`,
      );

      return { success: false, invalidToken: isInvalid, errorCode: code };
    }
  }

  // ─── Nettoyage tokens invalides ──────────────────────────

  /**
   * Retire les tokens FCM invalides du profil de préférences.
   * Appelé automatiquement après chaque envoi échoué avec
   * un code d'erreur "token not registered".
   */
  private async removeInvalidTokens(
    prefId:        string,
    invalidTokens: string[],
  ): Promise<void> {
    try {
      const pref = await this.prefRepo.findOne({ where: { id: prefId } });
      if (!pref?.pushTokens) return;

      const before = pref.pushTokens.length;
      pref.pushTokens = pref.pushTokens.filter(
        t => !invalidTokens.includes(t.token),
      );

      if (pref.pushTokens.length < before) {
        await this.prefRepo.save(pref);
        this.logger.log(
          `Removed ${before - pref.pushTokens.length} invalid FCM tokens `
          + `from pref=${prefId}`,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to remove invalid tokens from pref=${prefId}`, err);
    }
  }
}
