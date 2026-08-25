/* ============================================================
 * FICHIER : src/modules/session/session.service.ts
 *
 * RÔLE : Application de la session unique par utilisateur.
 *
 * PLACEMENT : module autonome (dépend uniquement de Redis) plutôt
 *   que rattaché à AuthModule — AuthModule a besoin de diffuser des
 *   événements via NotificationBroadcastService (NotificationsModule),
 *   et les gateways Socket.IO (NotificationsModule, MessagerieModule,
 *   CallModule…) ont besoin de SessionService pour valider les
 *   connexions. Le rattacher à AuthModule créerait un cycle
 *   AuthModule ↔ NotificationsModule. Un module dédié, sans aucune
 *   dépendance auth-spécifique, casse ce cycle proprement.
 *
 * SOURCE DE VÉRITÉ : Redis, clé `active_session:{userId}` →
 *   sessionId (chaîne simple, aucun format à parser).
 *
 * POURQUOI REDIS ET PAS UNIQUEMENT LA TABLE refresh_tokens :
 *   SUPER_ADMIN n'a jamais de refresh token (voir AuthService.
 *   issueTokensForUser — reconnexion manuelle après 4h). Un
 *   mécanisme basé uniquement sur refresh_tokens ne couvrirait
 *   donc pas ce rôle. Redis, lui, s'applique uniformément à
 *   TOUS les rôles via le claim `sid` du JWT d'accès.
 *
 * ATOMICITÉ (course de connexions simultanées, cf. mission §15) :
 *   `SET key value EX ttl GET` est une seule commande Redis —
 *   Redis exécute les commandes séquentiellement (mono-thread),
 *   donc deux connexions concurrentes sont forcément sérialisées
 *   par le serveur. Celle qui s'exécute en second voit forcément
 *   la valeur écrite par la première comme "ancienne session" et
 *   la révoque — jamais les deux actives en même temps.
 *
 * LIMITE CONNUE (à documenter, pas à contourner) : la politique
 *   d'éviction Redis observée sur cet environnement est
 *   `volatile-lru` (voir logs de démarrage backend) — sous forte
 *   pression mémoire, une clé avec TTL comme `active_session:*`
 *   peut être évincée avant son expiration naturelle, ce qui
 *   déconnecterait un utilisateur légitime sans nouvelle connexion
 *   réelle. Recommandation opérationnelle : passer la politique
 *   d'éviction Redis à `noeviction` ou dimensionner la mémoire en
 *   conséquence — voir rapport final.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import Redis                  from 'ioredis';
import * as crypto            from 'crypto';

/** Durée de vie de la session dans Redis — alignée sur le refresh token
 *  le plus long (rememberMe = 7 jours). Renouvelée à chaque refresh actif
 *  via touchSession(). */
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

export interface SessionMeta {
  userId:     string;
  deviceId:   string | null;
  ipAddress:  string | null;
  userAgent:  string | null;
  createdAt:  string;
}

export interface StartSessionResult {
  sessionId:         string;
  previousSessionId: string | null;
  sessionReplaced:   boolean;
}

function activeSessionKey(userId: string): string {
  return `active_session:${userId}`;
}

function sessionMetaKey(sessionId: string): string {
  return `session_meta:${sessionId}`;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /**
   * Démarre une nouvelle session pour cet utilisateur — remplace
   * atomiquement toute session déjà active (GETSET Redis).
   *
   * N'émet AUCUN événement temps réel elle-même : c'est à l'appelant
   * (AuthService) de diffuser la révocation, car lui seul sait dans
   * quel contexte (login, register, switch-account…) cet appel a lieu.
   */
  async startSession(
    userId:    string,
    deviceId:  string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<StartSessionResult> {
    const sessionId = crypto.randomUUID();

    /* Commande atomique unique : pose la nouvelle valeur ET récupère
     * l'ancienne en un seul aller-retour Redis.
     *
     * NE PAS utiliser `SET key value EX ttl GET` (option GET native,
     * Redis 6.2+) : constaté en pratique que le proxy de ce Redis Cloud
     * managé la rejette avec "ERR syntax error" alors que `INFO server`
     * annonce redis_version 8.6.2 — les proxys Redis Cloud sur certains
     * plans ne traduisent pas toutes les combinaisons de flags récentes
     * même quand le moteur sous-jacent les supporte. EVAL (Lua), lui,
     * est supporté sans exception depuis Redis 2.6 — atomicité garantie
     * par l'exécution mono-thread des scripts Lua, sans dépendre d'une
     * syntaxe de commande récente. */
    const previousSessionId = await this.redis.eval(
      `local old = redis.call('GET', KEYS[1])
       redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
       return old`,
      1, activeSessionKey(userId), sessionId, SESSION_TTL_SEC,
    ) as string | null;

    const meta: SessionMeta = {
      userId, deviceId, ipAddress, userAgent,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(sessionMetaKey(sessionId), JSON.stringify(meta), 'EX', SESSION_TTL_SEC);

    const sessionReplaced = !!previousSessionId && previousSessionId !== sessionId;

    this.logger.log(
      `[SESSION] Nouvelle session ${sessionId} pour user=${userId}` +
      (sessionReplaced ? ` — remplace ${previousSessionId}` : ' — aucune session précédente'),
    );

    return {
      sessionId,
      previousSessionId: sessionReplaced ? previousSessionId : null,
      sessionReplaced,
    };
  }

  /**
   * Vérifie que `sessionId` est bien la session ACTIVE de `userId`.
   * Utilisé par JwtStrategy et chaque gateway Socket.IO sur toute
   * requête/connexion authentifiée.
   */
  async validateSession(userId: string, sessionId: string | undefined | null): Promise<boolean> {
    if (!sessionId) return false;
    const current = await this.redis.get(activeSessionKey(userId));
    return current === sessionId;
  }

  /**
   * Prolonge le TTL de la session active — appelé à chaque rotation de
   * refresh token pour qu'une session réellement utilisée ne se fasse
   * jamais expirer par TTL. Ne prolonge QUE si sessionId est toujours
   * l'actif (évite de ressusciter une clé déjà remplacée par une
   * connexion plus récente survenue entre-temps).
   */
  async touchSession(userId: string, sessionId: string): Promise<void> {
    const current = await this.redis.get(activeSessionKey(userId));
    if (current !== sessionId) return;
    await this.redis.expire(activeSessionKey(userId), SESSION_TTL_SEC);
    await this.redis.expire(sessionMetaKey(sessionId), SESSION_TTL_SEC);
  }

  /**
   * Termine explicitement une session (déconnexion volontaire). Ne
   * supprime le pointeur `active_session:{userId}` QUE s'il correspond
   * encore à ce sessionId — sinon on effacerait la session d'un appareil
   * B qui se serait entre-temps connecté après un logout tardif de A.
   */
  async endSession(userId: string, sessionId: string | null | undefined): Promise<void> {
    if (!sessionId) return;
    const current = await this.redis.get(activeSessionKey(userId));
    if (current === sessionId) {
      await this.redis.del(activeSessionKey(userId));
    }
    await this.redis.del(sessionMetaKey(sessionId));
  }
}
