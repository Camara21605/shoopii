/* ============================================================
 * src/modules/dashboard/client/services/sessions.service.ts
 * Section 6 — Appareils connectés (sessions actives)
 *
 * BUG CORRIGÉ — la liste venait d'une colonne JSON `client.sessions` que rien
 * ne remplissait jamais : l'écran affichait toujours « 0 session active »,
 * même connecté. Et « Révoquer » ne faisait que retirer une ligne de ce JSON,
 * sans déconnecter personne.
 *
 * Désormais la liste est RÉELLE : les sessions actives viennent des refresh
 * tokens non révoqués et non expirés (regroupés par sessionId), la session
 * COURANTE est identifiée par le claim `sid` du JWT, et ses détails
 * (appareil, navigateur, IP, heure de connexion) par la session Redis.
 * Shoneya applique une session unique par compte (voir SessionService) : en
 * pratique une seule ligne — la session en cours — sauf cas particulier
 * (jeton hérité d'avant la session unique).
 *
 * « Révoquer » et « Déconnecter tout » révoquent réellement les refresh tokens
 * ET la session Redis ; l'appareil visé est prévenu en temps réel.
 * La session courante ne se révoque pas ici (c'est la déconnexion normale).
 * ============================================================ */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { User }         from '../../../../database/entities/user.entity';
import { RefreshToken } from '../../../../database/entities/refresh-token.entity';
import { SessionService }  from '../../../session/session.service';
import { GeoIpService }    from '../../../security-alerts/geo-ip.service';
import { NotificationBroadcastService } from '../../../notifications/services/notification-broadcast.service';
import { parseUserAgent }  from '../../../../common/utils/user-agent.util';

export interface SessionItem {
  id:        string;
  device:    string;
  browser:   string;
  os:        string;
  ip:        string;
  /** Pays (résolu depuis l'IP) ou « » si inconnu — le libellé de repli est côté interface */
  location:  string;
  /** Dernière activité (ISO 8601) */
  lastSeen:  string;
  /** Début de la session (ISO 8601) */
  createdAt: string;
  isCurrent: boolean;
  suspect:   boolean;
}

type AuthedUser = User & { sessionId?: string };

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

  constructor(
    @InjectRepository(RefreshToken) private readonly tokenRepo: Repository<RefreshToken>,
    private readonly sessionService: SessionService,
    private readonly geoIp:          GeoIpService,
    private readonly broadcast:      NotificationBroadcastService,
  ) {}

  private country(ip: string | null): string {
    const code = this.geoIp.lookupCountry(ip);
    if (!code) return '';
    try { return this.regionNames.of(code) ?? code; } catch { return code; }
  }

  /** Sessions actives : la courante (Redis) + toute autre session dont un refresh token est encore valable. */
  async getAll(user: AuthedUser): Promise<SessionItem[]> {
    const currentId = user.sessionId ?? null;

    const tokens = await this.tokenRepo.find({
      where: { userId: user.id, revoked: false, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });

    /* Regroupe par session (la rotation crée un nouveau token à chaque refresh) */
    const groups = new Map<string, RefreshToken[]>();
    for (const t of tokens) {
      const key = t.sessionId ?? `legacy:${t.id}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
    }

    const items: SessionItem[] = [];

    const push = (id: string, list: RefreshToken[], meta: { userAgent: string | null; ipAddress: string | null; createdAt: string } | null, isCurrent: boolean) => {
      const latest = list[0];                                  // le plus récent
      const ua     = parseUserAgent(meta?.userAgent ?? latest?.userAgent ?? null);
      const ip     = meta?.ipAddress ?? latest?.ipAddress ?? '';
      const first  = list.length ? list[list.length - 1].createdAt : null;
      items.push({
        id,
        device:    ua.device,
        browser:   ua.browser,
        os:        ua.device,
        ip:        ip ?? '',
        location:  this.country(ip || null),
        lastSeen:  (latest?.createdAt ?? (meta ? new Date(meta.createdAt) : new Date())).toISOString(),
        createdAt: (meta?.createdAt ? new Date(meta.createdAt) : first ?? new Date()).toISOString(),
        isCurrent,
        suspect:   false,
      });
    };

    /* Session courante : détails exacts depuis Redis, activité depuis ses refresh tokens */
    if (currentId) {
      const meta = await this.sessionService.getSessionMeta(currentId);
      push(currentId, groups.get(currentId) ?? [], meta, true);
      groups.delete(currentId);
    }
    for (const [id, list] of groups) push(id, list, null, false);

    /* Une autre session depuis un autre pays que la session courante est signalée comme suspecte */
    const cur = items.find(i => i.isCurrent);
    if (cur?.location) for (const i of items) if (!i.isCurrent && i.location && i.location !== cur.location) i.suspect = true;

    /* Courante d'abord, puis la plus récente */
    return items.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.lastSeen.localeCompare(a.lastSeen));
  }

  /** Révoquer une autre session par son id. */
  async revoquer(user: AuthedUser, sessionId: string): Promise<{ message: string }> {
    if (user.sessionId && sessionId === user.sessionId) {
      throw new BadRequestException('C’est votre session actuelle : utilisez « Se déconnecter » pour la fermer.');
    }
    const legacy = sessionId.startsWith('legacy:');
    const where = legacy
      ? { id: sessionId.slice(7), userId: user.id, revoked: false }
      : { sessionId, userId: user.id, revoked: false };

    const res = await this.tokenRepo.update(where as any, { revoked: true, revokedReason: 'USER_REVOKED' });
    if (!res.affected) throw new NotFoundException('Session introuvable ou déjà terminée.');

    if (!legacy) await this.closeRedisSession(user.id, sessionId);
    this.logger.warn(`[SESSION RÉVOQUÉE] userId=${user.id} | sessionId=${sessionId}`);
    return { message: 'Session révoquée avec succès.' };
  }

  /** Déconnecter toutes les sessions sauf la session actuelle. */
  async revoquerToutes(user: AuthedUser): Promise<{ message: string; count: number }> {
    const others = await this.tokenRepo.find({ where: { userId: user.id, revoked: false }, select: ['id', 'sessionId'] });
    const targets = others.filter(t => !user.sessionId || t.sessionId !== user.sessionId);

    if (targets.length) {
      await this.tokenRepo.update(targets.map(t => t.id) as any, { revoked: true, revokedReason: 'USER_REVOKED' });
      for (const sid of new Set(targets.map(t => t.sessionId).filter((s): s is string => !!s))) {
        await this.closeRedisSession(user.id, sid);
      }
    }
    this.logger.warn(`[AUTRES SESSIONS RÉVOQUÉES] userId=${user.id} | ${targets.length} jeton(s)`);
    return {
      message: targets.length ? 'Les autres sessions ont été déconnectées.' : 'Aucune autre session active.',
      count:   new Set(targets.map(t => t.sessionId ?? t.id)).size,
    };
  }

  /** Ferme la session Redis (l'access token `sid` devient invalide) et prévient l'appareil en temps réel. */
  private async closeRedisSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionService.endSession(userId, sessionId).catch(() => undefined);
    this.broadcast.emitToSession(sessionId, 'session:revoked', {
      reason:  'USER_REVOKED',
      message: 'Cette session a été fermée depuis les paramètres de votre compte.',
    });
  }
}
