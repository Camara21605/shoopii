/* ============================================================
 * FICHIER : src/modules/notifications/services/fcm.service.ts
 *
 * RÔLE : Envoi de push vers l'application mobile Android (Firebase Cloud
 * Messaging). Utilisé pour faire sonner un appel entrant quand l'application
 * est fermée (voir CallPushService).
 *
 * CONFIGURATION (une seule variable, sur Render) :
 *   FIREBASE_SERVICE_ACCOUNT = contenu du fichier JSON du compte de service
 *   (console Firebase → Paramètres du projet → Comptes de service → Générer
 *   une nouvelle clé privée), tel quel ou encodé en base64.
 * Absente ou invalide → isEnabled() = false : rien n'est envoyé, l'appel
 * sonne seulement dans l'application ouverte. Ne lève jamais.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

/** Codes FCM signifiant que le jeton ne sert plus (application désinstallée, jeton renouvelé). */
const GONE_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface FcmSendResult {
  ok:    boolean;
  /** Jeton à supprimer définitivement. */
  gone?: boolean;
  code?: string;
}

@Injectable()
export class FcmService {

  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('FIREBASE_SERVICE_ACCOUNT')?.trim();
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT absent — les appels ne sonneront pas application mobile fermée.');
      return;
    }
    try {
      const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const account = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
      this.app = getApps().find(a => a.name === 'shopi-fcm') ?? initializeApp({
        credential: cert({
          projectId:   account.project_id,
          clientEmail: account.client_email,
          /* Render / .env remplacent parfois les retours à la ligne de la clé par « \n » littéraux. */
          privateKey:  account.private_key.replace(/\\n/g, '\n'),
        }),
      }, 'shopi-fcm');
      this.logger.log(`FCM prêt (projet ${account.project_id}).`);
    } catch (err) {
      this.logger.error(`FIREBASE_SERVICE_ACCOUNT illisible — FCM désactivé : ${(err as Error).message}`);
      this.app = null;
    }
  }

  isEnabled(): boolean {
    return this.app !== null;
  }

  /**
   * Message « data » uniquement (pas de bloc notification) : c'est l'application
   * qui décide de l'affichage — pour un appel, une notification plein écran
   * avec la sonnerie du téléphone. Priorité haute : réveille le téléphone en veille.
   */
  async sendData(
    token: string,
    data: Record<string, string>,
    opts: { ttlSeconds: number; collapseKey?: string },
  ): Promise<FcmSendResult> {
    if (!this.app) return { ok: false, code: 'FCM_DISABLED' };
    const message: Message = {
      token,
      data,
      android: {
        priority:    'high',
        ttl:         opts.ttlSeconds * 1000,
        collapseKey: opts.collapseKey,
      },
    };
    try {
      await getMessaging(this.app).send(message);
      return { ok: true };
    } catch (err: any) {
      const code: string = err?.errorInfo?.code ?? err?.code ?? 'FCM_ERROR';
      if (!GONE_CODES.has(code)) this.logger.warn(`Push FCM échoué (${code}) jeton=…${token.slice(-8)}`);
      return { ok: false, gone: GONE_CODES.has(code), code };
    }
  }
}
