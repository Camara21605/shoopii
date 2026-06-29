/* ============================================================
 * FICHIER : src/modules/email/email.service.ts
 *
 * AJOUTS vs version précédente :
 *
 *  1. sendPasswordResetOtpEmail()
 *     → Remplace sendPasswordResetEmail()
 *     → Envoie un CODE OTP à 6 chiffres (pas un lien UUID)
 *     → Template avec les 6 chiffres bien mis en valeur
 *     → Indique l'expiration et les consignes de sécurité
 *
 *  2. sendPasswordChangedEmail()
 *     → Envoyé après resetPassword() réussi
 *     → Alerte l'utilisateur que son MDP a changé
 *     → Contient un lien d'alerte si ce n'était pas lui
 *
 *  3. sendPasswordResetEmail() (ancienne version)
 *     → Conservée pour compatibilité (redirige vers la nouvelle)
 *     → Marquée @deprecated
 *
 *  4. Tous les autres emails existants sont inchangés :
 *     sendInvitationEmail(), sendWelcomeEmail(), sendContactEmail()
 * ============================================================ */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { UserRole } from '../../common/enums/user-role.enum';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface SendInvitationEmailParams {
  toEmail:        string;
  toName?:        string;
  code:           string;
  targetRole:     UserRole | string;
  expiresAt:      Date;
  senderName:     string;
  customMessage?: string;
  ville?:         string;
  quartier?:      string;
  type?:          string;
}

export interface SendWelcomeEmailParams {
  toEmail:   string;
  firstName: string;
  role:      UserRole | string;
  loginUrl:  string;
}

/** @deprecated Utiliser SendPasswordResetOtpEmailParams à la place */
export interface SendPasswordResetEmailParams {
  toEmail:   string;
  firstName: string;
  resetUrl:  string;
  expiresAt: Date;
}

/** Paramètres pour l'email OTP de réinitialisation */
export interface SendPasswordResetOtpEmailParams {
  toEmail:   string;
  firstName: string;
  /** Code OTP à 6 chiffres en clair — haché en base, brut dans l'email */
  otpCode:   string;
  expiresAt: Date;
}

/** Paramètres pour l'email de confirmation de changement de mot de passe */
export interface SendPasswordChangedEmailParams {
  toEmail:   string;
  firstName: string;
  changedAt: Date;
  loginUrl:  string;
}

export interface SendContactEmailParams {
  toEmail:  string;
  toName?:  string;
  fromName: string;
  sujet:    string;
  message:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS PAR RÔLE
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; emoji: string; color: string }> = {
  admin:         { label: 'Administrateur',  emoji: '🛡️',  color: '#7c3aed' },
  company:       { label: 'Entreprise',      emoji: '🏪',  color: '#059669' },
  delivery:      { label: 'Livreur',         emoji: '🛵',  color: '#0284c7' },
  partner:       { label: 'Partenaire',      emoji: '🤝',  color: '#d97706' },
  correspondent: { label: 'Correspondant',   emoji: '📍',  color: '#dc2626' },
  client:        { label: 'Client',          emoji: '🛍️',  color: '#6366f1' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger      = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromEmail:   string;
  private readonly frontendUrl: string;
  private readonly smtpUser:    string;

  constructor(private readonly config: ConfigService) {
    const port   = config.get<number>('SMTP_PORT', 587);
    const secure = port === 465;

    this.smtpUser    = config.get<string>('SMTP_USER', '');
    this.fromEmail   = config.get<string>('SMTP_FROM',    'noreply@shopi.gn');
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'https://shopi.gn');

    /* Suppression des espaces dans le mot de passe App Password Gmail
       (les utilisateurs copient souvent "xxxx xxxx xxxx xxxx") */
    const rawPass = config.get<string>('SMTP_PASS', '');
    const smtpPass = rawPass.replace(/\s/g, '');

    this.transporter = nodemailer.createTransport({
      host:   config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port,
      secure,
      auth: {
        user: this.smtpUser,
        pass: smtpPass,
      },
      /*
       * Pool de connexions : réutilise la même connexion TCP+TLS+Auth
       * entre les emails → supprime le délai de handshake (2-3s) pour
       * les envois successifs.
       *
       * maxMessages: 20  → recycle la connexion après 20 emails
       *                    (évite que Gmail coupe une connexion trop ancienne)
       * socketTimeout: 30s → coupe les connexions inactives proprement
       * maxConnections: 1  → Gmail autorise 1 connexion simultanée
       */
      pool:           true,
      maxConnections: 1,
      maxMessages:    20,
      socketTimeout:  30_000,
      tls: {
        rejectUnauthorized: false,
      },
    } as any);
  }

  /* ── Vérification de la connexion SMTP au démarrage ───────────────────── */
  async onModuleInit(): Promise<void> {
    if (!this.smtpUser) {
      this.logger.warn('[SMTP] ⚠️  SMTP_USER non configuré — emails désactivés.');
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log(`[SMTP] ✅ Connexion établie avec ${this.config.get('SMTP_HOST')} (${this.smtpUser})`);
    } catch (err: any) {
      this.logger.error(
        `[SMTP] ❌ Connexion IMPOSSIBLE — emails ne seront pas envoyés.`,
      );
      this.logger.error(
        `[SMTP] → Code : ${err.code ?? 'UNKNOWN'} | Message : ${err.message}`,
      );
      this.logger.error(
        `[SMTP] → Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS dans .env`,
      );
      this.logger.error(
        `[SMTP] → Pour Gmail : utilisez un App Password (sans espaces) depuis https://myaccount.google.com/apppasswords`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. EMAIL D'INVITATION
  // ══════════════════════════════════════════════════════════════════════════

  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const { toEmail, code, targetRole, expiresAt, senderName } = params;
    const roleMeta = ROLE_META[targetRole] ?? { label: targetRole, emoji: '👤', color: '#1e40af' };

    const registerUrl = `${this.frontendUrl}/login?code=${encodeURIComponent(code)}&role=${encodeURIComponent(targetRole)}&email=${encodeURIComponent(toEmail)}`;

    const expiryFormatted = expiresAt.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    await this.send({
      to:      toEmail,
      subject: `${senderName} vous a ajouté à l'équipe Shopi (${roleMeta.label})`,
      html:    this.buildInvitationHtml({ toEmail, code, roleMeta, registerUrl, expiryFormatted, senderName }),
      text:    this.buildInvitationText({ code, roleMeta, registerUrl, expiryFormatted, senderName }),
    });

    this.logger.log(`[INVITATION] Email envoyé à ${toEmail} | Rôle: ${targetRole} | Code: ${code}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. EMAIL DE BIENVENUE
  // ══════════════════════════════════════════════════════════════════════════

  async sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
    const { toEmail, firstName, role, loginUrl } = params;
    const roleMeta = ROLE_META[role] ?? { label: role, emoji: '👤', color: '#1e40af' };

    await this.send({
      to:      toEmail,
      subject: `🎉 Bienvenue sur Shopi, ${firstName} !`,
      html:    this.buildWelcomeHtml({ firstName, roleMeta, loginUrl }),
      text:    `Bonjour ${firstName},\n\nVotre compte ${roleMeta.label} sur Shopi a été créé avec succès.\n\nConnectez-vous ici : ${loginUrl}`,
    });

    this.logger.log(`[BIENVENUE] Email envoyé à ${toEmail} | Rôle: ${role}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. EMAIL OTP — RÉINITIALISATION MOT DE PASSE (NOUVELLE VERSION)
  //
  //  sendPasswordResetOtpEmail()
  //  Envoie le code OTP à 6 chiffres après forgotPassword().
  //  Le code est présenté visuellement avec les chiffres séparés,
  //  facilitant la saisie sur mobile.
  // ══════════════════════════════════════════════════════════════════════════

  async sendPasswordResetOtpEmail(params: SendPasswordResetOtpEmailParams): Promise<void> {
    const { toEmail, firstName, otpCode, expiresAt } = params;

    const expiryTime = expiresAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    await this.send({
      to:      toEmail,
      subject: `Shopi — Vérification de connexion (${expiryTime})`,
      html:    this.buildOtpEmailHtml({ firstName, otpCode, expiryTime }),
      text: [
        `Bonjour ${firstName},`,
        '',
        'Votre code de vérification Shopi :',
        '',
        `  ${otpCode}`,
        '',
        `Ce code est valable jusqu'à ${expiryTime}.`,
        '',
        'Si vous n\'avez pas demandé ce code, ignorez cet email.',
        'Votre mot de passe reste inchangé.',
        '',
        '---',
        'Shopi Africa — shopi.gn',
      ].join('\n'),
    });

    this.logger.log(`[OTP EMAIL] Envoyé à ${toEmail} | Expiration: ${expiryTime}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. EMAIL DE CONFIRMATION DE CHANGEMENT DE MOT DE PASSE (NOUVEAU)
  //
  //  sendPasswordChangedEmail()
  //  Envoyé après resetPassword() réussi.
  //  Alerte l'utilisateur et lui permet de signaler si ce n'était pas lui.
  // ══════════════════════════════════════════════════════════════════════════

  async sendPasswordChangedEmail(params: SendPasswordChangedEmailParams): Promise<void> {
    const { toEmail, firstName, changedAt, loginUrl } = params;

    const changedFormatted = changedAt.toLocaleString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // Lien de signalement d'activité suspecte
    const reportUrl = `${this.frontendUrl}/support?subject=Activité+suspecte&type=password-changed`;

    await this.send({
      to:      toEmail,
      subject: `Shopi — Modification du mot de passe le ${changedAt.toLocaleDateString('fr-FR')}`,
      html:    this.buildPasswordChangedHtml({ firstName, changedFormatted, loginUrl, reportUrl }),
      text: [
        `Bonjour ${firstName},`,
        '',
        `Votre mot de passe Shopi a été modifié le ${changedFormatted}.`,
        '',
        'Si c\'était vous, vous pouvez ignorer cet email.',
        '',
        '⚠️ Si ce n\'était PAS vous, signalez-le immédiatement :',
        reportUrl,
        '',
        '---',
        'Shopi Africa — shopi.gn',
      ].join('\n'),
    });

    this.logger.log(`[PWD CHANGED] Email de confirmation envoyé à ${toEmail}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. EMAIL DE RÉINITIALISATION (ancienne version — @deprecated)
  //    Conservée pour compatibilité. Utiliser sendPasswordResetOtpEmail().
  // ══════════════════════════════════════════════════════════════════════════

  /** @deprecated Utiliser sendPasswordResetOtpEmail() à la place */
  async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
    const { toEmail, firstName, resetUrl, expiresAt } = params;
    const expiryFormatted = expiresAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    await this.send({
      to:      toEmail,
      subject: '🔒 Réinitialisation de votre mot de passe Shopi',
      html:    this.buildPasswordResetHtml({ firstName, resetUrl, expiryFormatted }),
      text:    `Bonjour ${firstName},\n\nLien de réinitialisation (valable jusqu'à ${expiryFormatted}) :\n${resetUrl}`,
    });

    this.logger.log(`[RESET PWD LEGACY] Email envoyé à ${toEmail}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. EMAIL DE CONTACT (inchangé)
  // ══════════════════════════════════════════════════════════════════════════

  async sendContactEmail(params: SendContactEmailParams): Promise<void> {
    const { toEmail, toName, fromName, sujet, message } = params;

    await this.send({
      to:      toEmail,
      from:    `"${fromName} via Shopi" <${this.fromEmail}>`,
      subject: `📩 ${sujet}`,
      html:    this.buildContactHtml({ toName, fromName, sujet, message }),
      text:    `Message de ${fromName}\n\nSujet : ${sujet}\n\n${message}\n\n---\nEnvoyé via Shopi Africa`,
    });

    this.logger.log(`[CONTACT EMAIL] Email envoyé à ${toEmail} | Sujet: ${sujet}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER D'ENVOI CENTRALISÉ
  // Gère automatiquement ECONNRESET : si la connexion poolée est morte,
  // nodemailer (pool:true) la recrée — on laisse l'erreur remonter
  // pour qu'elle soit loguée sans crasher le handler HTTP appelant.
  // ══════════════════════════════════════════════════════════════════════════

  private async send(opts: {
    to:       string;
    subject:  string;
    html:     string;
    text:     string;
    from?:    string;
  }): Promise<void> {
    const from = opts.from ?? `"Shopi Africa" <${this.fromEmail}>`;
    try {
      const info = await this.transporter.sendMail({
        from,
        to:         opts.to,
        replyTo:    this.fromEmail,
        subject:    opts.subject,
        html:       opts.html,
        text:       opts.text,
        /*
         * Headers anti-spam essentiels :
         * - X-Mailer         : identifie l'expéditeur (réduit le score spam)
         * - X-Priority       : 3 = normal (1 = urgent → spam trigger)
         * - Precedence: bulk → indique que c'est un email automatique
         * - List-Unsubscribe : exigé par Gmail/Yahoo depuis 2024 pour les emails en masse
         */
        headers: {
          'X-Mailer':        'Shopi Mailer 1.0',
          'X-Priority':      '3',
          'Precedence':      'bulk',
          'List-Unsubscribe': `<mailto:${this.fromEmail}?subject=unsubscribe>`,
        },
      });
      this.logger.debug(`[SMTP] ✉ Envoyé à ${opts.to} | messageId: ${info.messageId} | response: ${info.response}`);
    } catch (err: any) {
      this.logger.error(
        `[SMTP] ❌ Échec d'envoi à ${opts.to} — ${err.code ?? err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEMPLATES HTML PRIVÉS
  // ══════════════════════════════════════════════════════════════════════════

  /** Template email OTP — 6 chiffres mis en valeur */
  private buildOtpEmailHtml(p: {
    firstName:   string;
    otpCode:     string;
    expiryTime:  string;
  }): string {
    // Séparer les 6 chiffres pour l'affichage visuel
    const digits = p.otpCode.split('');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code de vérification Shopi</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:16px;padding:10px 20px;color:#fff;font-size:22px;font-weight:900;letter-spacing:-.5px;display:inline-block;">
            Sho<span style="opacity:.7">pi</span>
          </div>
        </td></tr>

        <!-- Carte -->
        <tr><td style="background:#fff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(30,64,175,.08);">

          <!-- Icône -->
          <div style="text-align:center;margin-bottom:20px;">
            <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">🔐</div>
          </div>

          <!-- Titre -->
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;text-align:center;">
            Code de vérification
          </h1>
          <p style="margin:0 0 28px;font-size:14px;color:#475569;text-align:center;line-height:1.6;">
            Bonjour <strong>${p.firstName}</strong>, voici votre code pour réinitialiser votre mot de passe Shopi.
          </p>

          <!-- Code OTP -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#f8faff;border:2px solid #3b82f6;border-radius:16px;padding:24px 20px;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">
                Votre code à 6 chiffres
              </div>
              <!-- Chiffres individuels pour une meilleure lisibilité -->
              <div style="display:inline-flex;gap:8px;justify-content:center;">
                ${digits.map(d => `
                  <div style="
                    width:48px;height:60px;
                    background:#fff;border:2px solid #bfdbfe;border-radius:10px;
                    display:inline-flex;align-items:center;justify-content:center;
                    font-size:28px;font-weight:900;color:#1e40af;
                    font-family:'Courier New',monospace;
                  ">${d}</div>
                `).join('')}
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:16px;">
                ⏰ Valable jusqu'à <strong style="color:#dc2626;">${p.expiryTime}</strong> — 10 minutes
              </div>
            </td></tr>
          </table>

          <!-- Instructions -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
            <p style="margin:0;font-size:13.5px;color:#475569;line-height:1.7;">
              <strong>Comment utiliser ce code :</strong><br />
              Retournez sur la page Shopi, saisissez ce code à 6 chiffres dans les cases prévues, puis créez votre nouveau mot de passe.
            </p>
          </div>

          <!-- Alerte sécurité -->
          <div style="background:#fff8ed;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
            <p style="margin:0;font-size:12.5px;color:#92400e;line-height:1.6;">
              🛡️ <strong>Shopi ne vous demandera jamais ce code par téléphone ou SMS.</strong>
              Si vous n'avez pas demandé ce code, ignorez cet email — votre mot de passe reste inchangé.
            </p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8;">
            Shopi Africa — La marketplace africaine de référence<br />
            <a href="${this.frontendUrl}" style="color:#3b82f6;text-decoration:none;">shopi.gn</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /** Template email de confirmation de changement de mot de passe */
  private buildPasswordChangedHtml(p: {
    firstName:        string;
    changedFormatted: string;
    loginUrl:         string;
    reportUrl:        string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(30,64,175,.08);">
        <tr><td>

          <!-- En-tête -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">✅</div>
          </div>

          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;text-align:center;">
            Mot de passe modifié
          </h1>

          <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
            Bonjour <strong>${p.firstName}</strong>,<br /><br />
            Votre mot de passe Shopi a été modifié avec succès le <strong>${p.changedFormatted}</strong>.
          </p>

          <!-- Bouton connexion -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${p.loginUrl}" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;display:inline-block;">
                🔑 Se connecter avec mon nouveau mot de passe
              </a>
            </td></tr>
          </table>

          <!-- Alerte si ce n'était pas l'utilisateur -->
          <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#b91c1c;line-height:1.7;">
              <strong>⚠️ Ce n'était pas vous ?</strong><br />
              Si vous n'avez pas modifié votre mot de passe, votre compte est peut-être compromis.
              <a href="${p.reportUrl}" style="color:#b91c1c;font-weight:700;">Signalez-le immédiatement →</a>
            </p>
          </div>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /** Template invitation (inchangé) */
  private buildInvitationHtml(p: {
    toEmail: string; code: string;
    roleMeta: { label: string; emoji: string; color: string };
    registerUrl: string; expiryFormatted: string; senderName: string;
  }): string {
    return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(30,64,175,.08);">
        <tr><td align="center" style="padding-bottom:20px;">
          <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:16px;padding:10px 20px;color:#fff;font-size:22px;font-weight:900;display:inline-block;">Shopi</div>
        </td></tr>
        <tr><td>
          <div style="background:${p.roleMeta.color}12;border:1.5px solid ${p.roleMeta.color}30;border-radius:12px;padding:14px 20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:28px;">${p.roleMeta.emoji}</span>
            <div style="font-size:13px;font-weight:700;color:${p.roleMeta.color};text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Invitation ${p.roleMeta.label}</div>
          </div>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Vous êtes invité à rejoindre Shopi !</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
            <strong>${p.senderName}</strong> vous a envoyé une invitation pour créer votre compte <strong>${p.roleMeta.label}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#f8faff;border:2px dashed #3b82f6;border-radius:14px;padding:20px;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Code d'activation</div>
              <div style="font-family:'Courier New',monospace;font-size:26px;font-weight:900;color:#1e40af;letter-spacing:4px;">${p.code}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:10px;">Saisissez ce code dans le formulaire d'inscription</div>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td align="center">
              <a href="${p.registerUrl}" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;display:inline-block;">
                ✨ Créer mon compte maintenant →
              </a>
            </td></tr>
          </table>
          <div style="background:#fff8ed;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
            <p style="margin:0;font-size:12.5px;color:#92400e;">⏰ <strong>Lien expire le ${p.expiryFormatted}.</strong></p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Shopi Africa · <a href="${this.frontendUrl}" style="color:#3b82f6;">shopi.gn</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private buildInvitationText(p: {
    code: string; roleMeta: { label: string; emoji: string; color: string };
    registerUrl: string; expiryFormatted: string; senderName: string;
  }): string {
    return [
      `Invitation Shopi — Créez votre compte ${p.roleMeta.label}`,
      `=`.repeat(50), '',
      `${p.senderName} vous a invité à rejoindre Shopi.`,
      `Code d'activation : ${p.code}`, '',
      `Lien (valable jusqu'au ${p.expiryFormatted}) :`, p.registerUrl,
      '', '---', 'Shopi Africa — shopi.gn',
    ].join('\n');
  }

  private buildWelcomeHtml(p: {
    firstName: string;
    roleMeta: { label: string; emoji: string; color: string };
    loginUrl: string;
  }): string {
    return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:40px 36px;">
        <tr><td align="center">
          <div style="font-size:48px;margin-bottom:12px;">🎉</div>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Bienvenue, ${p.firstName} !</h1>
          <p style="font-size:14px;color:#475569;margin:0 0 24px;">Votre compte <strong>${p.roleMeta.label}</strong> sur Shopi est actif.</p>
          <a href="${p.loginUrl}" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;display:inline-block;">
            ${p.roleMeta.emoji} Accéder à mon espace →
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private buildPasswordResetHtml(p: {
    firstName: string; resetUrl: string; expiryFormatted: string;
  }): string {
    return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:40px 36px;">
        <tr><td>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0f172a;">🔒 Réinitialisation de mot de passe</h1>
          <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.7;">
            Bonjour <strong>${p.firstName}</strong>, ce lien est valable jusqu'à <strong>${p.expiryFormatted}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td align="center">
              <a href="${p.resetUrl}" style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;display:inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private buildContactHtml(p: {
    toName?: string; fromName: string; sujet: string; message: string;
  }): string {
    return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:40px 36px;">
        <tr><td>
          <h1 style="margin:0 0 18px;font-size:22px;color:#0f172a;">📩 Nouveau message</h1>
          <p style="font-size:14px;color:#475569;line-height:1.7;">
            Bonjour <strong>${p.toName ?? 'Correspondant'}</strong>,<br />
            Vous avez reçu un message de <strong>${p.fromName}</strong> via Shopi Africa.
          </p>
          <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:10px;margin:20px 0;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Sujet</div>
            <div style="font-size:17px;color:#0f172a;font-weight:700;">${p.sujet}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;color:#334155;font-size:14px;line-height:1.8;white-space:pre-line;">${p.message}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }
}