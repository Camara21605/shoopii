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
import { withRedisTimeout }   from '../../common/utils/redis-timeout.util';

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

/** Délai max toléré pour une opération Redis critique du chemin
 *  d'authentification (login, validation de session sur CHAQUE requête
 *  authentifiée) avant de dégrader gracieusement plutôt que de bloquer
 *  toute l'application. Voir withRedisTimeout ci-dessous. */
const REDIS_OP_TIMEOUT_MS = 3_000;

/** Sentinelle distincte de toute valeur Redis réelle (y compris `null`,
 *  qui est une réponse légitime : "cette clé n'existe pas") — permet de
 *  distinguer sans ambiguïté "Redis a répondu : rien ici" de "Redis n'a
 *  pas répondu du tout" dans les callers qui doivent réagir différemment
 *  aux deux (ex. validateSession : fail-open uniquement sur le 2e cas). */
const REDIS_DOWN = Symbol('REDIS_DOWN');

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /**
   * Indique si une session est déjà active pour cet utilisateur, SANS
   * la remplacer ni la modifier (simple lecture) — utilisé pour demander
   * confirmation à l'utilisateur avant de fermer son autre appareil.
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    const existing = await withRedisTimeout<string | null>(
      () => this.redis.get(activeSessionKey(userId)), null, REDIS_OP_TIMEOUT_MS, this.logger, 'hasActiveSession',
    );
    return !!existing;
  }

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
    const meta: SessionMeta = {
      userId, deviceId, ipAddress, userAgent,
      createdAt: new Date().toISOString(),
    };

    /* Les deux écritures sont indépendantes (clés distinctes, sessionId
     * déjà généré localement) — en parallèle plutôt qu'en séquence pour
     * borner à REDIS_OP_TIMEOUT_MS (pas 2×) le pire cas si Redis est
     * indisponible. */
    const [previousSessionId] = await Promise.all([
      withRedisTimeout<string | null>(
        () => this.redis.eval(
          `local old = redis.call('GET', KEYS[1])
           redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
           return old`,
          1, activeSessionKey(userId), sessionId, SESSION_TTL_SEC,
        ) as Promise<string | null>,
        /* fallback si Redis est indisponible : on n'a pas pu poser ce
         * pointeur ni lire l'ancien — le login se poursuit quand même
         * (voir issueTokensForUser), juste sans garantie de session
         * unique tant que Redis n'est pas revenu. */
        null,
        REDIS_OP_TIMEOUT_MS, this.logger, 'startSession:eval',
      ),
      withRedisTimeout(
        () => this.redis.set(sessionMetaKey(sessionId), JSON.stringify(meta), 'EX', SESSION_TTL_SEC),
        null,
        REDIS_OP_TIMEOUT_MS, this.logger, 'startSession:meta',
      ),
    ]);

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
    /* FAIL-OPEN volontaire si Redis est indisponible : cette vérification
     * tourne sur CHAQUE requête authentifiée (JwtStrategy, gateways
     * Socket.IO) — une panne Redis ne doit jamais transformer en 401/500
     * généralisé tout le trafic authentifié du site. Le JWT reste signé
     * et vérifié indépendamment de Redis ; la session unique n'est elle
     * plus garantie que le temps de la panne. */
    const current = await withRedisTimeout<string | null | typeof REDIS_DOWN>(
      () => this.redis.get(activeSessionKey(userId)), REDIS_DOWN, REDIS_OP_TIMEOUT_MS, this.logger, 'validateSession',
    );
    if (current === REDIS_DOWN) return true;
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
    /* Best-effort : une panne Redis ici ne fait que raccourcir la durée
     * de vie de la session (TTL non prolongé) — jamais bloquant. */
    const current = await withRedisTimeout<string | null | typeof REDIS_DOWN>(
      () => this.redis.get(activeSessionKey(userId)), REDIS_DOWN, REDIS_OP_TIMEOUT_MS, this.logger, 'touchSession:get',
    );
    if (current === REDIS_DOWN || current !== sessionId) return;
    await Promise.all([
      withRedisTimeout(() => this.redis.expire(activeSessionKey(userId), SESSION_TTL_SEC), 0, REDIS_OP_TIMEOUT_MS, this.logger, 'touchSession:expire1'),
      withRedisTimeout(() => this.redis.expire(sessionMetaKey(sessionId), SESSION_TTL_SEC), 0, REDIS_OP_TIMEOUT_MS, this.logger, 'touchSession:expire2'),
    ]);
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
