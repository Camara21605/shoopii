/* ============================================================
 * FICHIER : src/modules/presence/presence-device.service.ts
 *
 * RÔLE : l'état « JOIGNABLE » — application fermée, mais téléphone avec
 * internet. Trois sources, du plus fréquent au plus précis :
 *
 *   1. Le téléphone se manifeste de lui-même (POST /presence/device-ping),
 *      avec le jeton signé que l'application lui a confié :
 *        - en quittant l'application (passage en arrière-plan) ;
 *        - toutes les ~15 min, tâche Android qui ne tourne QU'AVEC du réseau ;
 *        - à chaque push reçu (message, commande, appel…).
 *   2. Quelqu'un ouvre sa conversation ou son profil public alors qu'il n'est
 *      pas dans l'appli : le serveur lui envoie une VÉRIFICATION silencieuse
 *      (push FCM « data », rien ne s'affiche). Le téléphone répond en une ou
 *      deux secondes s'il a internet → « joignable » ; pas de réponse en
 *      PROBE_TIMEOUT_MS → « hors ligne » (données coupées, téléphone éteint).
 *   3. Un socket de l'application téléphone ouvert = internet actif (gateway).
 *
 * Le changement d'état est diffusé en direct (événement socket `presence`)
 * aux contacts et à ceux qui regardent son profil (room presence-watch).
 *
 * Garde-fous : jeton HMAC propre à cet usage (n'autorise que ce ping) ; le
 * compte doit être actif et avoir encore un téléphone enregistré ; une
 * vérification par personne et par minute au plus ; 20 personnes par appel.
 * Ne lève jamais vers l'appelant (la présence n'est jamais bloquante).
 * ============================================================ */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import { PresenceService } from '../messagerie/services/presence.service';
import { BroadcastService } from '../messagerie/services/broadcast.service';
import type { PresenceStatus } from '../messagerie/interfaces/messaging.interfaces';
import { NotificationPreferenceService } from '../notifications/services/notification-preference.service';
import { FcmService } from '../notifications/services/fcm.service';
import { AndroidPushService } from '../notifications/services/android-push.service';
import { CallService } from '../call/call.service';
import { withRedisTimeout } from '../../common/utils/redis-timeout.util';
import { DEVICE_TOKEN_TTL_MS, PROBE_TOKEN_TTL_MS, signPresence, verifyPresence } from './presence-token.util';

/** Délai de réponse d'un téléphone à une vérification avant de le dire hors ligne. */
export const PROBE_TIMEOUT_MS = 15_000;
/** Une vérification par personne au plus toutes les … */
const PROBE_COOLDOWN_S = 60;
/** Un téléphone qui s'est manifesté il y a moins de … n'a pas besoin d'être vérifié. */
const FRESH_MS = 90_000;
/** Fréquence demandée à la tâche Android périodique (minimum Android : 15 min). */
export const DEVICE_PING_INTERVAL_MIN = 15;

export interface PresenceView {
  status: PresenceStatus;
  lastSeen: string | null;
  reachableUntil: string | null;
}

@Injectable()
export class PresenceDeviceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceDeviceService.name);
  /** userId → a encore un téléphone enregistré (cache 10 min : un ping toutes les 15 min par appareil). */
  private readonly deviceCache = new Map<string, { ok: boolean; at: number }>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly presence: PresenceService,
    private readonly broadcast: BroadcastService,
    private readonly prefs: NotificationPreferenceService,
    private readonly fcm: FcmService,
    private readonly androidPush: AndroidPushService,
    private readonly calls: CallService,
    private readonly config: ConfigService,
    private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleDestroy() {
    this.timers.forEach(t => clearTimeout(t));
  }

  private secret() {
    return this.config.get<string>('JWT_SECRET') ?? '';
  }

  pingUrl(): string | null {
    const api = this.androidPush.apiBase();
    return api ? `${api}/presence/device-ping` : null;
  }

  /** Jeton confié à l'application (renouvelé à chaque ouverture). */
  credentials(userId: string) {
    return {
      token: signPresence({ u: userId }, this.secret(), DEVICE_TOKEN_TTL_MS),
      url: this.pingUrl(),
      intervalMinutes: DEVICE_PING_INTERVAL_MIN,
      expiresAt: new Date(Date.now() + DEVICE_TOKEN_TTL_MS).toISOString(),
    };
  }

  // ── Le téléphone se manifeste ──────────────────────────────────

  /** Renvoie true si le jeton est valide (la réponse HTTP reste la même dans tous les cas). */
  async devicePing(token: unknown): Promise<boolean> {
    const claims = verifyPresence(token, this.secret());
    if (!claims) return false;
    if (!(await this.hasPhone(claims.u))) return false;

    const before = await this.presence.markReachable(claims.u);
    if (before === 'offline') await this.announce(claims.u);
    return true;
  }

  /** Compte actif ET au moins un téléphone encore enregistré (déconnexion = plus de « joignable »). */
  private async hasPhone(userId: string): Promise<boolean> {
    const hit = this.deviceCache.get(userId);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ok;
    let ok = false;
    try {
      const rows: { status: string }[] = await this.db.query('SELECT status FROM users WHERE id = $1 AND "deletedAt" IS NULL', [userId]);
      if (rows[0]?.status === 'active') ok = (await this.phoneTokens(userId)).length > 0;
    } catch (err) {
      this.logger.warn(`hasPhone(${userId}) : ${(err as Error).message}`);
      return hit?.ok ?? false;
    }
    if (this.deviceCache.size > 20_000) this.deviceCache.clear();
    this.deviceCache.set(userId, { ok, at: Date.now() });
    return ok;
  }

  /** Jetons FCM des téléphones Android du compte (tous, même notifications coupées : la vérification est invisible). */
  private async phoneTokens(userId: string): Promise<string[]> {
    const recipient = await this.calls.resolveNotificationRecipient(userId);
    if (!recipient) return [];
    const pref = await this.prefs.getOrCreate(recipient.type, recipient.id);
    return (pref.pushTokens ?? []).filter(t => t.platform === 'android' && !!t.token).map(t => t.token);
  }

  // ── Lecture ────────────────────────────────────────────────────

  async view(userIds: string[]): Promise<Record<string, PresenceView>> {
    const map = await this.presence.getBulkPresence(userIds);
    const out: Record<string, PresenceView> = {};
    for (const id of userIds) {
      const p = map.get(id);
      const status = PresenceService.statusOf(p);
      out[id] = { status, lastSeen: p && !p.online ? p.lastSeen : null, reachableUntil: status === 'reachable' ? (p?.reachableUntil ?? null) : null };
    }
    return out;
  }

  // ── Profils publics (boutique, livreur, point relais, client) ──

  /**
   * Présence du propriétaire d'un profil public. Connecté : la vérification
   * silencieuse part aussi (le résultat arrive en direct si l'on suit
   * `userId` avec 'presence:watch', sinon au prochain appel).
   */
  async actorView(type: string, id: string, requesterId: string | null) {
    const userId = await this.actorUserId(type, id);
    if (!userId) return null;
    if (requesterId) {
      const r = (await this.probe(requesterId, [userId]))[userId];
      if (r) return { userId, ...r };
    }
    return { userId, ...(await this.view([userId]))[userId], checking: false };
  }

  private static readonly ACTOR_TABLES: Record<string, string> = {
    client: 'clients', company: 'entreprises', delivery: 'livreurs', correspondent: 'correspondants', partner: 'partenaires',
  };

  private async actorUserId(type: string, id: string): Promise<string | null> {
    const table = PresenceDeviceService.ACTOR_TABLES[type];
    if (!table) return null;
    const rows: { userId: string | null }[] = await this.db.query(`SELECT "userId" FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return rows[0]?.userId ?? null;
  }

  // ── Vérification « es-tu là ? » ───────────────────────────────

  /**
   * Vérifie, sans rien afficher, les personnes qui ne sont pas dans l'appli
   * et dont le téléphone ne s'est pas manifesté récemment. Renvoie l'état
   * actuel ; le résultat de la vérification arrive en direct (socket).
   */
  async probe(requesterId: string, userIds: string[]): Promise<Record<string, PresenceView & { checking: boolean }>> {
    const ids = Array.from(new Set(userIds.filter(id => id && id !== requesterId))).slice(0, 20);
    const current = await this.view(ids);
    const out: Record<string, PresenceView & { checking: boolean }> = {};
    await Promise.all(ids.map(async id => {
      const v = current[id];
      out[id] = { ...v, checking: v.status !== 'online' ? await this.startProbe(id) : false };
    }));
    return out;
  }

  private async startProbe(userId: string): Promise<boolean> {
    if (!this.fcm.isEnabled() || !this.pingUrl()) return false;

    const reachAt = await this.presence.reachableAt(userId);
    if (reachAt && Date.now() - Date.parse(reachAt) < FRESH_MS) return false;

    /* Une vérification par personne et par minute (toutes instances confondues). */
    const free = await withRedisTimeout(
      () => this.redis.set(`presence:probe:${userId}`, '1', 'EX', PROBE_COOLDOWN_S, 'NX'),
      null, 500, this.logger, 'presence.probe.lock',
    ).catch(() => null);
    if (free !== 'OK') return false;

    const tokens = await this.phoneTokens(userId).catch(() => [] as string[]);
    if (!tokens.length) return false;

    const startedAt = new Date().toISOString();
    const probeId = randomUUID();
    const data = {
      kind: 'presence.ping',
      url: this.pingUrl() as string,
      token: signPresence({ u: userId, p: probeId }, this.secret(), PROBE_TOKEN_TTL_MS),
    };
    /* TTL court : une vérification arrivée en retard n'a plus de sens. */
    await Promise.all(tokens.map(t => this.fcm.sendData(t, data, { ttlSeconds: 20, collapseKey: 'presence' }).catch(() => null)));

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.finishProbe(userId, startedAt);
    }, PROBE_TIMEOUT_MS);
    this.timers.add(timer);
    return true;
  }

  /** Pas de réponse depuis le début de la vérification → plus « joignable ». */
  private async finishProbe(userId: string, startedAt: string): Promise<void> {
    try {
      const p = await this.presence.getPresence(userId);
      if (p?.online) return;
      const reachAt = await this.presence.reachableAt(userId);
      if (reachAt && reachAt >= startedAt) return; // il a répondu
      const changed = await this.presence.clearReachable(userId, startedAt);
      if (changed) await this.announce(userId);
    } catch (err) {
      this.logger.warn(`finishProbe(${userId}) : ${(err as Error).message}`);
    }
  }

  // ── Diffusion ──────────────────────────────────────────────────

  /** Prévient en direct les contacts et ceux qui regardent son profil. */
  private async announce(userId: string): Promise<void> {
    try {
      const v = (await this.view([userId]))[userId];
      const contacts = await this.contactUserIds(userId);
      this.broadcast.presenceChanged(contacts, {
        userId,
        online: v.status === 'online',
        lastSeen: v.lastSeen ?? new Date().toISOString(),
        status: v.status,
        reachableUntil: v.reachableUntil,
      });
    } catch (err) {
      this.logger.warn(`announce(${userId}) : ${(err as Error).message}`);
    }
  }

  /** Mêmes destinataires que MessagerieGateway : conversations directes + membres des mêmes groupes. */
  private async contactUserIds(userId: string): Promise<string[]> {
    const ids = new Set<string>();
    const direct: { uid: string | null }[] = await this.db.query(
      `SELECT DISTINCT CASE WHEN "initiatorUserId" = $1 THEN "recipientUserId" ELSE "initiatorUserId" END AS uid
         FROM conversations WHERE "initiatorUserId" = $1 OR "recipientUserId" = $1`,
      [userId],
    );
    direct.forEach(r => { if (r.uid && r.uid !== userId) ids.add(r.uid); });
    try {
      const rows: { userId: string }[] = await this.db.query(
        `SELECT DISTINCT m."userId" FROM delivery_group_members m
          WHERE m."isActive" = true AND m."userId" <> $1
            AND m."groupId" IN (SELECT "groupId" FROM delivery_group_members WHERE "userId" = $1 AND "isActive" = true)`,
        [userId],
      );
      rows.forEach(r => { if (r.userId) ids.add(r.userId); });
    } catch {
      /* groupes indisponibles : les contacts directs sont quand même prévenus */
    }
    return Array.from(ids);
  }
}
