/* ============================================================
 * FICHIER : src/modules/notifications/strategies/email-channel.strategy.ts
 *
 * RÔLE : Strategy EMAIL — envoie via l'API HTTP Brevo.
 *
 * CONFIG (variables d'environnement) :
 *   BREVO_API_KEY — clé API Brevo (format xkeysib-...)   — fallback: canal désactivé
 *   MAIL_FROM     — adresse expéditeur (défaut: SMTP_FROM ou noreply@shopi.app)
 *
 * BUG CORRIGÉ (prod) : ce canal envoyait auparavant en SMTP brut
 * (nodemailer, port 587) — Render (plan free) restreint/bloque les
 * connexions sortantes sur ce port (vérifié par test direct : succès
 * instantané hors Render, échec systématique par timeout depuis Render).
 * Bascule vers l'API HTTP Brevo (port 443, jamais bloqué), même
 * correctif que MailService (src/modules/email/email.service.ts) —
 * voir ce fichier pour le détail complet du diagnostic.
 *
 * GESTION DES ERREURS :
 *   - HTTP 400 (adresse/paramètre invalide) → isPermanentFailure: true
 *   - Autre (réseau, 5xx, rate limit) → isPermanentFailure: false (retry BullMQ)
 * ============================================================ */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Notification, NotificationChannel, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { IChannelStrategy }       from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult }        from '../interfaces/notification.interfaces';
import { isDndActive }                 from '../utils/dnd.util';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class EmailChannelStrategy implements IChannelStrategy {

  readonly channel = NotificationChannel.EMAIL;

  private readonly logger      = new Logger(EmailChannelStrategy.name);
  private readonly apiKey:     string;
  private readonly fromAddress: string;

  constructor(
    /**
     * @Optional() — ConfigService peut être absent en test unitaire.
     * En production, ConfigModule.forRoot({ isGlobal: true }) garantit sa présence.
     */
    @Optional()
    private readonly config?: ConfigService,
  ) {
    this.apiKey = config?.get<string>('BREVO_API_KEY') ?? '';
    this.fromAddress =
      config?.get<string>('MAIL_FROM') ?? config?.get<string>('SMTP_FROM') ?? 'noreply@shopi.app';
    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY non configurée — canal EMAIL désactivé');
    }
  }

  canSend(pref: NotificationPreference, notif: Notification): boolean {
    if (!pref.globalEmailEnabled)                                       return false;
    if (notif.priority !== NotificationPriority.URGENT && isDndActive(pref)) return false;
    const typePref = pref.preferences?.[notif.type];
    if (typePref && typePref.email === false)                           return false;
    if (!pref.notificationEmail)                                        return false;
    if (!this.apiKey)                                                   return false;
    return true;
  }

  async deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult> {
    const emailTo = pref.notificationEmail!;
    const start   = Date.now();

    try {
      const res = await fetch(BREVO_API_URL, {
        method:  'POST',
        headers: {
          accept:         'application/json',
          'content-type': 'application/json',
          'api-key':      this.apiKey,
        },
        body: JSON.stringify({
          sender:      { name: 'Shopi', email: this.fromAddress },
          to:          [{ email: emailTo }],
          subject:     notif.title,
          htmlContent: this.buildHtml(notif),
          textContent: notif.body,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err  = new Error(`HTTP ${res.status} ${res.statusText} — ${body}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }

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
      const errorCode   = err?.status ? `HTTP_${err.status}` : 'EMAIL_ERROR';
      const isPermanent = err?.status === 400;

      this.logger.warn(
        `EMAIL failed notif=${notif.id} to=${emailTo} `
        + `code=${errorCode} permanent=${isPermanent} message=${err?.message ?? 'N/A'}`,
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
