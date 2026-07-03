/* ============================================================
 * FICHIER : src/modules/notifications/strategies/email-channel.strategy.ts
 *
 * RÔLE : Strategy EMAIL — envoie via Nodemailer (SMTP).
 *
 * CONFIG (variables d'environnement) :
 *   MAIL_HOST    — serveur SMTP (ex: smtp.gmail.com)
 *   MAIL_PORT    — port SMTP (défaut: 587)
 *   MAIL_SECURE  — TLS forcé sur port 465 (défaut: false)
 *   MAIL_USER    — adresse d'authentification SMTP
 *   MAIL_PASS    — mot de passe SMTP / App Password
 *   MAIL_FROM    — adresse expéditeur (défaut: noreply@shopi.app)
 *
 * GESTION DES ERREURS :
 *   - Bounce / adresse invalide → isPermanentFailure: true
 *   - Rate limit / réseau → isPermanentFailure: false (retry BullMQ)
 * ============================================================ */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  Notification, NotificationChannel, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { IChannelStrategy }       from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult }        from '../interfaces/notification.interfaces';
import { isDndActive }                 from '../utils/dnd.util';

/** Codes d'erreur Nodemailer considérés permanents (pas de retry) */
const PERMANENT_ERROR_CODES = new Set([
  'EENVELOPE',      // adresse invalide
  'bounce',
  'invalid_email',
  'user_not_found',
]);

@Injectable()
export class EmailChannelStrategy implements IChannelStrategy {

  readonly channel = NotificationChannel.EMAIL;

  private readonly logger      = new Logger(EmailChannelStrategy.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(
    /**
     * @Optional() — ConfigService peut être absent en test unitaire.
     * En production, ConfigModule.forRoot({ isGlobal: true }) garantit sa présence.
     */
    @Optional()
    private readonly config?: ConfigService,
  ) {
    this.fromAddress = config?.get<string>('MAIL_FROM') ?? 'noreply@shopi.app';
    this.transporter = this.buildTransporter();
  }

  canSend(pref: NotificationPreference, notif: Notification): boolean {
    if (!pref.globalEmailEnabled)                                       return false;
    if (notif.priority !== NotificationPriority.URGENT && isDndActive(pref)) return false;
    const typePref = pref.preferences?.[notif.type];
    if (typePref && typePref.email === false)                           return false;
    if (!pref.notificationEmail)                                        return false;
    if (!this.transporter)                                              return false;
    return true;
  }

  async deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult> {
    const emailTo = pref.notificationEmail!;
    const start   = Date.now();

    try {
      await this.transporter!.sendMail({
        from:    this.fromAddress,
        to:      emailTo,
        subject: notif.title,
        html:    this.buildHtml(notif),
        text:    notif.body,
      });

      this.logger.debug(
        `EMAIL sent notif=${notif.id} to=${emailTo} duration=${Date.now() - start}ms`,
      );

      return {
        channel:    NotificationChannel.EMAIL,
        success:    true,
        durationMs: Date.now() - start,
        meta:       { emailUsed: emailTo },
      };
    } catch (err: any) {
      const errorCode   = err?.code ?? err?.response?.code ?? 'EMAIL_ERROR';
      const isPermanent = PERMANENT_ERROR_CODES.has(errorCode);

      this.logger.warn(
        `EMAIL failed notif=${notif.id} to=${emailTo} `
        + `code=${errorCode} permanent=${isPermanent}`,
      );

      return {
        channel:            NotificationChannel.EMAIL,
        success:            false,
        errorCode,
        errorMessage:       err?.message ?? 'Erreur envoi email',
        isPermanentFailure: isPermanent,
        durationMs:         Date.now() - start,
        meta:               { emailUsed: emailTo },
      };
    }
  }

  // ─── Helpers privés ───────────────────────────────────────

  private buildTransporter(): Transporter | null {
    const host = this.config?.get<string>('MAIL_HOST');
    if (!host) {
      this.logger.warn('MAIL_HOST non configuré — canal EMAIL désactivé');
      return null;
    }

    return createTransport({
      host,
      port:   this.config!.get<number>('MAIL_PORT', 587),
      secure: this.config!.get<boolean>('MAIL_SECURE', false),
      auth: {
        user: this.config!.get<string>('MAIL_USER', ''),
        pass: this.config!.get<string>('MAIL_PASS', ''),
      },
    });
  }

  private buildHtml(notif: Notification): string {
    const safeUrl     = this.sanitizeUrl(notif.actionUrl);
    const actionBlock = safeUrl
      ? `<p style="margin-top:20px">
           <a href="${safeUrl}"
              style="background:#1A4FC4;color:#fff;padding:10px 20px;
                     border-radius:6px;text-decoration:none;font-weight:600">
             Voir les détails
           </a>
         </p>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px">
        <div style="border-left:4px solid #1A4FC4;padding-left:16px;margin-bottom:20px">
          <h2 style="margin:0 0 8px;font-size:18px">${this.escapeHtml(notif.title)}</h2>
          <p style="margin:0;color:#555;font-size:14px">${this.escapeHtml(notif.body)}</p>
        </div>
        ${actionBlock}
        <hr style="border:none;border-top:1px solid #eee;margin-top:30px">
        <p style="font-size:11px;color:#aaa">
          Vous recevez cet email car vous êtes inscrit sur Shopi.<br>
          <a href="#" style="color:#aaa">Se désabonner des notifications email</a>
        </p>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** N'autorise que les URLs https://, http:// ou relatives (/path) */
  private sanitizeUrl(url: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
    } catch {
      if (url.startsWith('/')) return url;
    }
    return null;
  }
}
