/**
 * ============================================================
 * FICHIER : src/modules/messagerie/services/presence.service.ts
 *
 * RÔLE : Gestion de la présence en ligne des utilisateurs
 *        via Redis (O(1), TTL natif, compatible multi-instances).
 *
 * POURQUOI REDIS PLUTÔT QUE MySQL :
 *   • MySQL n'a pas de TTL natif → cron job nécessaire
 *   • Redis SET/GET = O(1) contre SELECT = O(log n)
 *   • Redis survit aux crashs serveur (RDB/AOF)
 *   • Redis pub/sub permet la sync multi-serveurs
 *
 * STRUCTURE DES CLÉS :
 *   presence:{userId}         → UserPresence JSON (TTL 45s)
 *   presence:sockets:{userId} → SSET des socketIds actifs
 *   presence:seen:{userId}    → ISO de la DERNIÈRE ACTIVITÉ (TTL 90 j) —
 *                               « Vu il y a 5 min » dans la messagerie
 *
 * DERNIÈRE CONNEXION — deux défauts corrigés :
 *   1. Elle n'était écrite qu'à une déconnexion PROPRE, dans la clé de
 *      présence : application fermée / réseau perdu → la clé expirait
 *      (45 s) et l'heure disparaissait avec elle. Elle vit maintenant dans
 *      sa propre clé, rafraîchie à chaque heartbeat (30 s).
 *   2. Un redémarrage du serveur (déploiement) ne déconnecte pas
 *      proprement les sockets : leurs ids restaient pour toujours dans
 *      presence:sockets:* (constaté : 19 et 20 sockets fantômes). SCARD ne
 *      retombait plus jamais à 0 → l'utilisateur n'était jamais déclaré
 *      hors ligne. Le gateway fournit désormais la liste des sockets
 *      RÉELLEMENT ouverts (fetchSockets) et l'ensemble est resynchronisé.
 *
 * STRATÉGIE :
 *   - Connexion socket  → SETEX presence:* TTL 45s + SADD sockets
 *   - Heartbeat 30s     → SETEX rafraîchit le TTL
 *   - Déconnexion       → SREM sockets ; si SCARD=0 → DEL presence
 *   - TTL 45s > 30s     → garde en ligne même si heartbeat manque 1 fois
 * ============================================================
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis }  from '@nestjs-modules/ioredis';
import type { Redis }   from 'ioredis';
import type { UserPresence } from '../interfaces/messaging.interfaces';
import { withRedisTimeout } from '../../../common/utils/redis-timeout.util';

/** Durée (secondes) avant qu'un utilisateur soit considéré hors-ligne */
const PRESENCE_TTL_S = 45;

/** Préfixe Redis pour les clés de présence */
const KEY_PRESENCE = (userId: string) => `presence:${userId}`;
const KEY_SOCKETS  = (userId: string) => `presence:sockets:${userId}`;
const KEY_SEEN     = (userId: string) => `presence:seen:${userId}`;

/** Conservation de la dernière activité (« Vu le … ») */
const LAST_SEEN_TTL_S = 90 * 24 * 60 * 60;

/** Délai max toléré pour une lecture de présence avant de dégrader
 *  gracieusement — voir withTimeout ci-dessous. Un `try/catch` seul ne
 *  protège pas contre une commande qui reste EN ATTENTE sans jamais
 *  répondre (queue Redis pendant une reconnexion, cf. enableOfflineQueue
 *  dans app.module.ts) : isOnline() est appelée une fois PAR CONTACT dans
 *  MessagerieService.getConversations() — sans borne de temps, une panne
 *  Redis peut y cumuler des dizaines de secondes d'attente.
 *
 *  300ms plutôt que 2000ms : isOnlineOrUnknown() est aussi dans le chemin
 *  critique de CallService.startCall() (à l'intérieur de la transaction,
 *  verrou consultatif tenu pendant l'attente) — la latence Redis réelle
 *  observée est sub-milliseconde, donc 300ms plafonne largement un accroc
 *  réel sans jamais retarder un appel normal. */
const PRESENCE_OP_TIMEOUT_MS = 300;

/** Écritures de présence (connexion / déconnexion / heartbeat) : hors chemin
 *  critique d'un appel, donc un peu plus de marge que les lectures — mais
 *  toujours bornées, jamais suspendues sur une panne Redis. */
const PRESENCE_WRITE_TIMEOUT_MS = 1000;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ─────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────

  /**
   * Enregistre un socket actif pour userId.
   * Définit la présence comme "en ligne" avec TTL.
   */
  async onConnect(userId: string, socketId: string, liveSocketIds?: string[]): Promise<void> {
    try {
      /* BUG CORRIGÉ — ces écritures n'avaient AUCUNE borne de temps : ioredis
       * (enableOfflineQueue: true, voir app.module.ts) met les commandes en
       * file pendant une panne Redis, donc `await pipeline.exec()` restait
       * suspendu jusqu'à ~1 min. Or MessagerieGateway.handleConnection()
       * attend cette méthode AVANT d'émettre `connected` et de prévenir les
       * contacts : pendant une panne Redis, plus aucune connexion temps réel
       * ne se terminait. Même disjoncteur partagé que la lecture de présence
       * (withRedisTimeout) : une panne déjà détectée court-circuite
       * immédiatement, sans rejouer le timeout à chaque connexion. */
      await withRedisTimeout(async () => {
        const pipeline = this.redis.pipeline();

        /* Ensemble des sockets = sockets réellement ouverts (élimine les fantômes
         * laissés par un redémarrage du serveur), sinon simple ajout. */
        const ids = liveSocketIds ? Array.from(new Set([...liveSocketIds, socketId])) : [socketId];
        if (liveSocketIds) pipeline.del(KEY_SOCKETS(userId));
        pipeline.sadd(KEY_SOCKETS(userId), ...ids);
        pipeline.setex(KEY_SEEN(userId), LAST_SEEN_TTL_S, new Date().toISOString());

        // Définit la présence avec TTL auto-expirante
        const presence: UserPresence = {
          online:   true,
          lastSeen: new Date().toISOString(),
          sockets:  0,  // mis à jour en dessous
        };

        pipeline.setex(
          KEY_PRESENCE(userId),
          PRESENCE_TTL_S,
          JSON.stringify(presence),
        );

        await pipeline.exec();

        // Met à jour le compteur sockets dans la clé présence
        await this.refreshPresence(userId);
      }, undefined, PRESENCE_WRITE_TIMEOUT_MS, this.logger, 'presence.onConnect');

      this.logger.debug(`[Presence] ONLINE userId=${userId} socket=${socketId}`);
    } catch (err) {
      // Redis indisponible : la connexion socket reste valide, on dégrade
      // simplement le tracking de présence sans faire planter le gateway.
      this.logger.warn(`[Presence] Redis indisponible (onConnect userId=${userId}) : ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────────────────

  /**
   * Retire un socket du Set actif.
   * Si le Set est vide → utilisateur hors ligne (lastSeen mis à jour).
   *
   * Retourne true si l'utilisateur est maintenant hors ligne
   * (utile pour broadcaster l'événement offline).
   */
  async onDisconnect(userId: string, socketId: string, liveSocketIds?: string[]): Promise<boolean> {
    try {
      /* Borné comme onConnect() (voir son commentaire) : fallback false =
       * « on ne sait pas », donc aucun broadcast « hors ligne » erroné. */
      return await withRedisTimeout<boolean>(async () => {
        const now = new Date().toISOString();
        await this.redis.setex(KEY_SEEN(userId), LAST_SEEN_TTL_S, now);

        /* Sockets restants : ceux RÉELLEMENT ouverts si le gateway les fournit
         * (l'ensemble Redis est alors remplacé — fin des sockets fantômes). */
        let remaining: number;
        if (liveSocketIds) {
          const live = liveSocketIds.filter(id => id !== socketId);
          await this.redis.del(KEY_SOCKETS(userId));
          if (live.length > 0) await this.redis.sadd(KEY_SOCKETS(userId), ...live);
          remaining = live.length;
        } else {
          await this.redis.srem(KEY_SOCKETS(userId), socketId);
          remaining = await this.redis.scard(KEY_SOCKETS(userId));
        }

        if (remaining === 0) {
          // Plus aucun socket → passe hors ligne
          const presence: UserPresence = {
            online:   false,
            lastSeen: now,
            sockets:  0,
          };

          // Garde la clé 30 jours pour afficher « Vu le … » (dernière déconnexion) côté client
          await this.redis.setex(
            KEY_PRESENCE(userId),
            60 * 60 * 24 * 30,
            JSON.stringify(presence),
          );

          this.logger.debug(`[Presence] OFFLINE userId=${userId}`);
          return true;
        }

        // Encore des sockets actifs — rafraîchit le TTL
        await this.refreshPresence(userId);
        return false;
      }, false, PRESENCE_WRITE_TIMEOUT_MS, this.logger, 'presence.onDisconnect');
    } catch (err) {
      // Redis indisponible : on n'empêche jamais la déconnexion du socket.
      this.logger.warn(`[Presence] Redis indisponible (onDisconnect userId=${userId}) : ${(err as Error).message}`);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // HEARTBEAT
  // ─────────────────────────────────────────────────────────

  /**
   * Appelé depuis le gateway toutes les 30s pour maintenir
   * la présence en vie (rafraîchit le TTL Redis).
   */
  async heartbeat(userId: string): Promise<void> {
    try {
      await withRedisTimeout(() => this.refreshPresence(userId), undefined, PRESENCE_WRITE_TIMEOUT_MS, this.logger, 'presence.heartbeat');
    } catch (err) {
      this.logger.warn(`[Presence] Redis indisponible (heartbeat userId=${userId}) : ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────────────

  /**
   * Retourne la présence d'un utilisateur.
   * Null si jamais connecté (aucune clé Redis).
   */
  async getPresence(userId: string): Promise<UserPresence | null> {
    try {
      const raws = await withRedisTimeout(
        () => this.redis.mget(KEY_PRESENCE(userId), KEY_SEEN(userId)), null, PRESENCE_OP_TIMEOUT_MS, this.logger, 'getPresence',
      );
      if (!raws) return null;
      return this.merge(raws[0], raws[1]);
    } catch {
      return null;
    }
  }

  /**
   * Vérifie si un utilisateur est en ligne (helper rapide).
   * Retourne false si Redis est indisponible.
   */
  async isOnline(userId: string): Promise<boolean> {
    try {
      const presence = await this.getPresence(userId);
      return presence?.online === true;
    } catch {
      return false;
    }
  }

  /**
   * Variante utilisée UNIQUEMENT par la porte d'appel 1:1 (CallService).
   *
   * isOnline() (ci-dessus) traite "Redis indisponible" exactement comme
   * "confirmé hors ligne" — les deux renvoient false. Pour un simple point
   * vert dans la messagerie, cette confusion est un dégât mineur (badge
   * imprécis). Mais utilisée pour bloquer un appel 1:1, elle a pour effet
   * qu'UNE panne Redis bloque silencieusement TOUS les appels de la
   * plateforme — constaté en prod (les appels de groupe, eux, n'ont jamais
   * eu cette dépendance et continuaient de fonctionner normalement).
   *
   * Ici, une panne Redis renvoie true ("on ne sait pas, donc on laisse
   * sonner" — au pire l'appel ne sera pas décroché, comme un appel
   * téléphonique normal) plutôt que false ("hors ligne confirmé, on bloque").
   */
  async isOnlineOrUnknown(userId: string): Promise<boolean> {
    const TIMEOUT = Symbol('timeout');
    try {
      const raw = await withRedisTimeout<string | null | typeof TIMEOUT>(
        () => this.redis.get(KEY_PRESENCE(userId)), TIMEOUT, PRESENCE_OP_TIMEOUT_MS, this.logger, 'isOnlineOrUnknown',
      );
      if (raw === TIMEOUT) return true; // Redis injoignable — on ne sait pas, donc on ne bloque pas l'appel
      if (!raw) return false; // Redis a répondu : clé absente = vraiment hors ligne
      const presence = JSON.parse(raw) as UserPresence;
      return presence.online === true;
    } catch {
      return true; // Redis injoignable — on ne sait pas, donc on ne bloque pas l'appel
    }
  }

  /**
   * Retourne la présence de plusieurs utilisateurs en un seul
   * appel Redis pipeline (batch) — optimisation N+1.
   * Retourne tous null si Redis est indisponible.
   */
  async getBulkPresence(
    userIds: string[],
  ): Promise<Map<string, UserPresence | null>> {
    if (userIds.length === 0) return new Map();

    try {
      const pipeline = this.redis.pipeline();
      userIds.forEach(id => pipeline.mget(KEY_PRESENCE(id), KEY_SEEN(id)));

      /* ⚠️ Sans borne de temps ici, une panne/latence Redis (ioredis met en
       * file les commandes par défaut au lieu d'échouer immédiatement) fait
       * pendre TOUTE la liste des conversations — c'est le SEUL appel
       * Redis de getConversations()/getContactInfoBulk(), utilisé par
       * l'écran le plus consulté de la messagerie. Constaté en prod avec
       * Redis en panne : chargement de la messagerie très lent/bloqué. */
      const results = await withRedisTimeout(() => pipeline.exec(), null, PRESENCE_OP_TIMEOUT_MS, this.logger, 'getBulkPresence');
      const map     = new Map<string, UserPresence | null>();

      if (!results) {
        userIds.forEach(id => map.set(id, null));
        return map;
      }

      userIds.forEach((id, i) => {
        const pair = results?.[i]?.[1] as (string | null)[] | null;
        map.set(id, pair ? this.merge(pair[0], pair[1]) : null);
      });

      return map;
    } catch {
      /* Redis indisponible → tous hors-ligne par défaut */
      const map = new Map<string, UserPresence | null>();
      userIds.forEach(id => map.set(id, null));
      return map;
    }
  }

  // ─────────────────────────────────────────────────────────
  // INTERNAL
  // ─────────────────────────────────────────────────────────

  private async refreshPresence(userId: string): Promise<void> {
    const socketCount = await this.redis.scard(KEY_SOCKETS(userId));

    const presence: UserPresence = {
      online:   socketCount > 0,
      lastSeen: new Date().toISOString(),
      sockets:  socketCount,
    };

    await this.redis.setex(
      KEY_PRESENCE(userId),
      PRESENCE_TTL_S,
      JSON.stringify(presence),
    );
    /* Dernière activité : survit à l'expiration de la clé de présence */
    await this.redis.setex(KEY_SEEN(userId), LAST_SEEN_TTL_S, presence.lastSeen);
  }

  /**
   * Présence lue + dernière activité durable. Clé de présence expirée (appli
   * fermée sans déconnexion propre) → hors ligne, vu à la dernière activité.
   * null seulement si l'on ne sait rien de cet utilisateur.
   */
  private merge(rawPresence: string | null, seen: string | null): UserPresence | null {
    let presence: UserPresence | null = null;
    try { presence = rawPresence ? JSON.parse(rawPresence) as UserPresence : null; } catch { presence = null; }
    if (presence?.online) return presence;
    const lastSeen = [presence?.lastSeen, seen ?? undefined].filter((v): v is string => !!v).sort().pop();
    if (!lastSeen) return presence;
    return { online: false, lastSeen, sockets: 0 };
  }

  // ─────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────

  async onModuleDestroy(): Promise<void> {
    // Nettoyage propre si le module est détruit (redémarrage Kubernetes)
    this.logger.log('[Presence] Module détruit — nettoyage Redis ignoré (TTL auto)');
  }
}
