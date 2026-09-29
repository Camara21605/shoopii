/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-broadcast.service.ts
 *
 * RÔLE : Pont entre les services REST et le gateway Socket.IO.
 *
 * POURQUOI CE SERVICE ?
 *   Le gateway NotificationGateway possède le serveur Socket.IO.
 *   Les services (NotificationService, etc.) ont besoin d'émettre
 *   des events sans dépendre du gateway → dépendance circulaire.
 *
 *   Solution (identique à BroadcastService dans MessagerieModule) :
 *     1. Ce service commence sans serveur (server = null).
 *     2. NotificationGateway.afterInit() injecte le serveur via setServer().
 *     3. Les services peuvent ensuite émettre des events.
 *
 * MAPPING actorType + actorId → room Socket.IO :
 *   Room : `notif:user:{userId}`
 *
 *   PROBLÈME : on a actorType + actorId (profil), pas userId (users.id).
 *   SOLUTION : Redis cache actorKey → userId (peuplé à la connexion socket).
 *              Si cache miss → pas d'émission (acteur hors ligne, OK).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import Redis                  from 'ioredis';
import type { Server }        from 'socket.io';
import type { NotificationActorType } from 'src/database/entities/notification/notification.entity';

/** Préfixe des clés Redis pour le mapping acteur → userId */
const ACTOR_USER_KEY_PREFIX = 'notif:actor:';

/** TTL du cache acteur → userId : 24h */
const ACTOR_CACHE_TTL = 86_400;

/** Motif de désactivation d'un compte — voir deconnecterUtilisateur(). */
export type MotifDesactivation = 'account_banned' | 'account_suspended' | 'account_deleted';

const MESSAGES_DESACTIVATION: Record<MotifDesactivation, string> = {
  account_banned:    'Votre compte a été bloqué par l\'administration.',
  account_suspended: 'Votre compte a été suspendu.',
  account_deleted:   'Votre compte a été supprimé.',
};

@Injectable()
export class NotificationBroadcastService {

  private server: Server | null = null;

  /**
   * ⚠️ FAILLE CORRIGÉE (audit sécurité) — emitToSession() ne coupait QUE
   * les sockets du namespace /notifications (le seul à appeler setServer()
   * ci-dessus). Une session révoquée (nouvel appareil, vol de refresh
   * token détecté) laissait donc un socket déjà ouvert sur /messaging,
   * /location ou /support pleinement actif jusqu'à expiration naturelle
   * du token — l'attaquant continuait de recevoir des messages, suivre un
   * livreur ou interagir sur un ticket support. Chaque gateway concerné
   * s'enregistre maintenant ici via registerSessionServer(), et
   * emitToSession() coupe la session sur TOUS les namespaces enregistrés.
   */
  private readonly sessionServers: Server[] = [];

  private readonly logger = new Logger(NotificationBroadcastService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  /**
   * Appelé par NotificationGateway.afterInit().
   * Injecte le serveur Socket.IO dans ce service.
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('🔌 NotificationBroadcastService: server Socket.IO enregistré');
  }

  /**
   * Enregistre un serveur Socket.IO supplémentaire (un namespace) pour la
   * révocation de session — voir le commentaire sur `sessionServers`
   * ci-dessus. À appeler depuis afterInit() de chaque gateway dont les
   * sockets doivent être coupés quand la session de leur utilisateur est
   * révoquée (en plus de NotificationGateway, qui appelle déjà setServer()
   * et est donc inclus séparément dans emitToSession()).
   */
  registerSessionServer(server: Server): void {
    this.sessionServers.push(server);
  }

  // ─────────────────────────────────────────────────────────
  // CACHE ACTEUR → USERID
  // ─────────────────────────────────────────────────────────

  /**
   * Stocke le mapping actorType:actorId → userId dans Redis.
   * Appelé par NotificationGateway.handleConnection().
   */
  async cacheActorUserId(
    actorType: NotificationActorType,
    actorId:   string,
    userId:    string,
  ): Promise<void> {
    const key = `${ACTOR_USER_KEY_PREFIX}${actorType}:${actorId}`;
    await this.redis.set(key, userId, 'EX', ACTOR_CACHE_TTL);
  }

  /**
   * Résout actorType + actorId → userId depuis Redis.
   * @returns userId ou null si cache miss (acteur jamais connecté)
   */
  async resolveUserId(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<string | null> {
    const key = `${ACTOR_USER_KEY_PREFIX}${actorType}:${actorId}`;
    return this.redis.get(key);
  }

  // ─────────────────────────────────────────────────────────
  // ÉMISSIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Émet un événement Socket.IO sur la room d'un acteur.
   *
   * @returns true si l'acteur était connecté (émission effective)
   *          false si cache miss ou server non initialisé
   */
  async emitToActor(
    actorType: NotificationActorType,
    actorId:   string,
    event:     string,
    payload:   unknown,
  ): Promise<boolean> {
    if (!this.server) {
      this.logger.warn('emitToActor: server Socket.IO non encore initialisé');
      return false;
    }

    const userId = await this.resolveUserId(actorType, actorId);
    if (!userId) {
      // Acteur hors ligne ou jamais connecté → notification en base uniquement
      return false;
    }

    const room = `notif:user:${userId}`;
    this.server.to(room).emit(event, payload);

    this.logger.debug(
      `emit actor=${actorType}:${actorId} room=${room} event=${event}`,
    );

    return true;
  }

  /**
   * Émet une mise à jour du compteur non lu pour un acteur.
   * Raccourci pour notif:unread_count.
   */
  async emitUnreadCount(
    actorType:   NotificationActorType,
    actorId:     string,
    unreadCount: number,
  ): Promise<void> {
    await this.emitToActor(actorType, actorId, 'notif:unread_count', { unreadCount });
  }

  /**
   * Émet directement sur une room userId (quand userId est connu).
   * Utilisé par NotificationGateway pour les events sync.
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`notif:user:${userId}`).emit(event, payload);
  }

  /**
   * Émet sur la room d'une SESSION précise (`session:{sessionId}`), pas
   * d'un utilisateur entier — indispensable pour la révocation de session
   * unique : un même userId peut avoir deux sockets connectés à l'instant T
   * (ancien appareil + nouveau appareil qui vient de se connecter), et
   * `emitToUser` toucherait les deux. `session:{sessionId}` ne cible QUE
   * l'appareil dont la session vient d'être révoquée.
   *
   * Ferme ensuite le socket après un court délai — laisse le temps au
   * client de recevoir l'event avant la coupure de connexion.
   */
  /**
   * Coupe TOUS les sockets temps réel d'un utilisateur, sur tous les
   * namespaces enregistrés (notifications, messagerie/appels, tracking,
   * support) — à appeler quand son compte est banni, suspendu ou supprimé.
   *
   * Sans ça, un compte banni gardait ses sockets déjà ouverts actifs
   * (messages, appels, suivi de livreur…) jusqu'à la prochaine
   * reconnexion : le contrôle de statut n'a lieu qu'à la connexion.
   *
   * Les sockets sont retrouvés par socket.data.userId (posé par chaque
   * gateway à l'authentification) — fonctionne aussi en multi-instances
   * via l'adapter Socket.IO. Le client reçoit d'abord `session:revoked`
   * (déjà géré par le frontend : déconnexion + message sur /login).
   * Ne lève jamais : une panne ici ne doit pas faire échouer le bannissement.
   */
  async deconnecterUtilisateur(userId: string, motif: MotifDesactivation): Promise<number> {
    const servers = this.server ? [this.server, ...this.sessionServers] : this.sessionServers;
    let coupes = 0;
    for (const server of servers) {
      try {
        const sockets = await server.fetchSockets();
        for (const socket of sockets) {
          if (socket.data?.userId !== userId) continue;
          /* Les deux événements déjà gérés par le frontend :
           *  - account_status_changed (socket messagerie) → raccroche tout appel + message
           *  - session:revoked (socket notifications)    → déconnexion + message sur /login */
          socket.emit('account_status_changed', { reason: motif });
          socket.emit('session:revoked', { reason: 'ACCOUNT_DISABLED', message: MESSAGES_DESACTIVATION[motif] });
          coupes++;
          /* Même délai qu'emitToSession : laisse le client recevoir les events */
          setTimeout(() => socket.disconnect(true), 300);
        }
      } catch (err) {
        this.logger.warn(`[deconnecterUtilisateur] namespace ignoré pour user=${userId} : ${(err as Error).message}`);
      }
    }
    if (coupes > 0) this.logger.log(`🔌 ${coupes} socket(s) coupé(s) — ${motif} user=${userId}`);
    return coupes;
  }

  emitToSession(sessionId: string, event: string, payload: unknown): void {
    const room = `session:${sessionId}`;
    /* NotificationGateway (this.server) + tous les gateways enregistrés
     * via registerSessionServer() (messagerie, appels, tracking, support)
     * — voir le commentaire sur `sessionServers` plus haut dans ce fichier. */
    const servers = this.server ? [this.server, ...this.sessionServers] : this.sessionServers;
    for (const server of servers) {
      server.to(room).emit(event, payload);
      setTimeout(() => {
        server.in(room).disconnectSockets(true);
      }, 300);
    }
  }
}
