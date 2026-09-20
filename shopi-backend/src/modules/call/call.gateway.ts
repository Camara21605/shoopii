/* ============================================================
 * FICHIER : src/modules/call/call.gateway.ts
 *
 * RÔLE : Signalisation WebRTC (offer/answer/ICE) + persistance
 *        des appels. Remplace la section "SIGNALING APPELS" qui
 *        vivait auparavant dans messagerie.gateway.ts.
 *
 * PARTAGE LE NAMESPACE /messaging AVEC MessagerieGateway :
 *   NestJS autorise plusieurs classes @WebSocketGateway sur le
 *   même namespace — socket.data.userId, posé par
 *   MessagerieGateway.handleConnection(), reste lisible ici (même
 *   objet Socket sous-jacent). Aucune ré-authentification dupliquée.
 *
 * PRINCIPE : chaque handler appelle CallService (permission,
 * anti-spam, occupé, persistance) AVANT de relayer l'événement.
 * Une erreur de persistance ne doit JAMAIS casser la signalisation
 * live déjà en cours (offer/answer/ice-candidate) — seul
 * `call:initiate` peut bloquer l'appel (c'est le seul moment où
 * la vérification de permission a un sens).
 * ============================================================ */

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Server } from 'socket.io';

import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';
import { CallService } from './call.service';
import { getSocketAllowedOrigins } from '../../common/utils/socket-cors.util';
import { Call, CallStatus, CallType } from 'src/database/entities/call/call.entity';
import {
  CallInitiateDto, CallAcceptDto, CallRejectDto, CallEndDto, CallBusyDto,
  CallOfferDto, CallAnswerDto, CallIceCandidateDto, CallKeepaliveDto,
} from './dto/call-socket.dto';
import { SocketFloodGuard } from '../messagerie/utils/socket-flood-guard';
import { WsValidationExceptionFilter } from '../messagerie/filters/ws-validation.filter';

/* offer+answer+ice-candidate combinés, par CONNEXION (socket.id, pas
 * userId — un flood ne doit pénaliser que la connexion fautive, pas les
 * autres appareils du même utilisateur). 100 messages/10s est très au-
 * dessus de ce qu'une négociation ICE légitime produit (quelques dizaines
 * de candidats au grand maximum, même avec TURN + plusieurs interfaces
 * réseau) — ne bloque jamais un appel réel, seulement un flood soutenu. */
const SIGNAL_FLOOD_MAX      = 100;
const SIGNAL_FLOOD_WINDOW_MS = 10_000;

/* ── Appels fantômes ─────────────────────────────────────────────
 * Une ligne `calls` qui survit à la fin réelle de l'appel (redémarrage du
 * serveur, `call:end` perdu, onglet gelé…) rendait les DEUX utilisateurs
 * « occupés » pour toujours : « Vous êtes déjà en appel » / « occupé » alors
 * que personne n'était en communication. Un client qui se croit en appel
 * envoie `call:keepalive` toutes les 10 s ; sans signe de vie d'un des deux
 * côtés pendant KEEPALIVE_DEAD_MS, l'appel est déclaré mort et fermé. */
const KEEPALIVE_DEAD_MS      = 30_000;
/** Une sonnerie qui dure plus que ça n'a plus de sens (le client annule à 30 s). */
const RINGING_MAX_MS         = 40_000;
const REAP_INTERVAL_MS       = 10_000;
/** Filet absolu : aucun appel ne dure plus que ça. */
const CALL_HARD_CAP_MS       = 6 * 60 * 60 * 1000;
/** Délai de grâce avant de couper un appel CONNECTÉ dont le socket vient de tomber
 *  (bascule Wi-Fi ↔ 4G, micro-coupure) : le client a le temps de se reconnecter. */
const DISCONNECT_GRACE_MS    = 10_000;

/* Même configuration que le ValidationPipe global de main.ts (HTTP) — le
 * pipe global ne s'applique PAS aux @MessageBody() des gateways, il faut
 * le redéclarer explicitement ici. whitelist+forbidNonWhitelisted rejette
 * tout champ non attendu, transform convertit les payloads bruts en
 * instances de classe (nécessaire pour @ValidateNested). */
@UsePipes(new ValidationPipe({
  whitelist:            true,
  transform:            true,
  forbidNonWhitelisted: true,
}))
@UseFilters(WsValidationExceptionFilter)
@WebSocketGateway({
  namespace: '/messaging',
  /* ⚠️ FAILLE CORRIGÉE (audit sécurité) — origin:true acceptait
   * n'importe quelle origine ; voir socket-cors.util.ts. */
  cors: { origin: getSocketAllowedOrigins(), credentials: true },
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(CallGateway.name);
  private readonly floodGuard = new SocketFloodGuard();

  /**
   * callId → quel socket.id précis porte chaque côté de l'appel — permet
   * à handleDisconnect de savoir si LE SOCKET qui vient de se déconnecter
   * est réellement celui engagé dans un appel donné, plutôt que de couper
   * TOUS les appels de l'utilisateur dès qu'UN de ses appareils se
   * déconnecte (ancien comportement, cassait un appel en cours sur le
   * téléphone si l'onglet navigateur du même utilisateur se fermait).
   * En mémoire (comme ActiveGroupCall côté groupe) — perdu au redémarrage,
   * voir le fallback conservateur dans handleDisconnect.
   */
  private readonly callBindings = new Map<string, { callerSocketId: string; calleeSocketId?: string }>();

  constructor(private readonly callService: CallService) {}

  // ── Appels fantômes : suivi de vie + balayage ─────────────────

  /** `${callId}:${userId}` → dernier `call:keepalive` reçu de ce côté. */
  private readonly lastSeen = new Map<string, number>();
  /** callId → première fois où CE process a vu la ligne (grâce après un redémarrage : les clients n'ont pas encore repris leurs signaux). */
  private readonly firstSeen = new Map<string, number>();
  private reapTimer: ReturnType<typeof setInterval> | null = null;
  private reaping = false;

  onModuleInit(): void {
    this.reapTimer = setInterval(() => { void this.sweepDeadCalls(); }, REAP_INTERVAL_MS);
    this.reapTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.reapTimer) { clearInterval(this.reapTimer); this.reapTimer = null; }
  }

  /**
   * Sérialise les handlers de signalisation d'UN MÊME utilisateur (initiate /
   * end / accept / reject / busy / keepalive). Sans ça, un `call:end` envoyé
   * juste après `call:initiate` (l'appelant annule aussitôt) s'exécutait
   * PENDANT l'insertion de la ligne `calls` : `findActiveCallId` ne trouvait
   * rien, l'annulation était perdue et l'appelé sonnait pour un appel que
   * l'appelant croyait annulé — ligne fantôme + « occupé » derrière.
   */
  private readonly userQueues = new Map<string, Promise<unknown>>();

  private runSerial<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.userQueues.get(userId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(task);
    const tail = next.catch(() => undefined);
    this.userQueues.set(userId, tail);
    void tail.then(() => { if (this.userQueues.get(userId) === tail) this.userQueues.delete(userId); });
    return next;
  }

  private async isSideAlive(call: Call, userId: string, now: number): Promise<boolean> {
    const seen = this.lastSeen.get(`${call.id}:${userId}`);
    if (seen !== undefined) return now - seen < KEEPALIVE_DEAD_MS;

    /* Aucun signal reçu de ce côté : vivant pendant la période de grâce (début
     * d'appel, ou redémarrage du serveur)... */
    const ref = Math.min(now - call.startedAt.getTime(), now - (this.firstSeen.get(call.id) ?? now));
    if (ref < KEEPALIVE_DEAD_MS) return true;

    /* ...puis seulement s'il a une connexion ET que celle-ci n'est pas d'une
     * version du client qui envoie des keepalive (un client récent qui n'en
     * envoie pas ne se croit pas en appel : la ligne est un fantôme). Un
     * ancien client (bundle en cache) ne sait pas en envoyer : on le croit
     * tant qu'il est connecté, pour ne jamais couper ses vrais appels. */
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (sockets.length === 0) return false;
    return !sockets.some(sk => (sk.data as { callKeepalive?: boolean } | undefined)?.callKeepalive === true);
  }

  private async findDeadCalls(calls: Call[]): Promise<Call[]> {
    const now  = Date.now();
    const dead: Call[] = [];
    for (const call of calls) {
      if (!this.firstSeen.has(call.id)) this.firstSeen.set(call.id, now);
      const age = now - call.startedAt.getTime();

      if (call.status !== CallStatus.CONNECTED) {
        if (age > RINGING_MAX_MS) dead.push(call);
        continue;
      }
      if (age > CALL_HARD_CAP_MS
        || !(await this.isSideAlive(call, call.callerId, now))
        || !(await this.isSideAlive(call, call.calleeId, now))) {
        dead.push(call);
      }
    }
    return dead;
  }

  /** Ferme les appels morts en base et prévient les deux utilisateurs. */
  private async endDeadCalls(dead: Call[]): Promise<void> {
    if (dead.length === 0) return;
    const ended = await this.callService.forceEndCalls(dead.map(c => c.id));
    for (const call of dead) {
      this.logger.warn(`🧹 Appel fantôme fermé call=${call.id} caller=${call.callerId} callee=${call.calleeId} status=${call.status}`);
      for (const uid of [call.callerId, call.calleeId]) this.lastSeen.delete(`${call.id}:${uid}`);
      this.firstSeen.delete(call.id);
      this.callBindings.delete(call.id);
    }
    for (const e of ended) {
      this.server.to(`user:${e.callerId}`).emit('call:ended', { conversationId: e.conversationId });
      this.server.to(`user:${e.calleeId}`).emit('call:ended', { conversationId: e.conversationId });
    }
  }

  private async sweepDeadCalls(): Promise<void> {
    if (this.reaping) return;
    this.reaping = true;
    try {
      const calls = await this.callService.findAllActiveCalls();
      const liveIds = new Set(calls.map(c => c.id));
      for (const id of this.firstSeen.keys()) if (!liveIds.has(id)) this.firstSeen.delete(id);
      for (const key of this.lastSeen.keys()) if (!liveIds.has(key.split(':')[0])) this.lastSeen.delete(key);
      await this.endDeadCalls(await this.findDeadCalls(calls));
    } catch (e) {
      this.logger.error('❌ Balayage des appels fantômes échoué', e as Error);
    } finally {
      this.reaping = false;
    }
  }

  /**
   * Avant de dire « occupé », ferme immédiatement les appels fantômes des deux
   * utilisateurs concernés — sans attendre le prochain balayage périodique.
   */
  private async reapDeadCallsBetween(userA: string, userB: string): Promise<void> {
    try {
      await this.endDeadCalls(await this.findDeadCalls(await this.callService.findActiveCallsForUsers(userA, userB)));
    } catch (e) {
      this.logger.warn(`Nettoyage préventif des appels échoué : ${(e as Error).message}`);
    }
  }

  /**
   * Ne coupe QUE les appels réellement portés par CE socket précis — pas
   * tous les appels de l'utilisateur. Distinction :
   *   - Appelant qui part, appel jamais accepté : personne d'autre ne peut
   *     porter cet appel à sa place → toujours terminé.
   *   - Un côté dont le binding connu correspond à CE socket → terminé.
   *   - Callee dont AUCUN appareil n'a encore accepté (RINGING, pas de
   *     binding côté callee) : une AUTRE session du même utilisateur peut
   *     encore répondre → jamais terminé sur la seule foi qu'un appareil
   *     tiers vient de se déconnecter.
   *   - Binding inconnu (ex. redémarrage serveur ayant vidé callBindings)
   *     pour un côté callee déjà répondu : comportement conservateur
   *     historique (on termine) plutôt que de risquer un appel orphelin
   *     permanent — compromis déjà assumé avant cette partie.
   */
  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (!userId) return;

    try {
      const activeCalls = await this.callService.findActiveCallsForUser(userId);
      const immediate: Call[] = [];
      const graceful:  Call[] = [];

      for (const call of activeCalls) {
        const binding    = this.callBindings.get(call.id);
        const isCaller    = call.callerId === userId;
        const boundSocket = isCaller ? binding?.callerSocketId : binding?.calleeSocketId;

        let ends = false;
        if (boundSocket) {
          ends = boundSocket === socket.id; // sinon : un AUTRE appareil du même utilisateur porte cet appel
        } else if (isCaller) {
          ends = true;   // aucun autre appareil ne peut porter SON côté
        } else if (call.status === CallStatus.CONNECTED) {
          ends = true;   // binding inconnu (redémarrage serveur) : comportement conservateur
        }
        // callee en RINGING sans binding : une autre session peut encore répondre → ignoré.
        if (!ends) continue;

        (call.status === CallStatus.CONNECTED ? graceful : immediate).push(call);
      }

      if (immediate.length > 0) await this.terminateForDisconnect(userId, socket.id, immediate);

      /* Appel déjà CONNECTÉ : le média passe en pair-à-pair, une micro-coupure du
       * socket (bascule Wi-Fi ↔ 4G, veille brève) ne doit pas raccrocher tout de
       * suite — on laisse DISCONNECT_GRACE_MS au client pour se reconnecter. */
      if (graceful.length > 0) {
        const timer = setTimeout(() => {
          void this.finishAfterGrace(userId, socket.id, graceful.map(c => c.id));
        }, DISCONNECT_GRACE_MS);
        timer.unref?.();
      }
    } catch (e) {
      // Une panne ici ne doit jamais faire planter le process — le pire
      // cas est un appel qui reste "actif" un peu plus longtemps (le balayage le ferme).
      this.logger.error(`❌ Erreur nettoyage appels à la déconnexion user=${userId}`, e as Error);
    }
  }

  private async finishAfterGrace(userId: string, oldSocketId: string, callIds: string[]): Promise<void> {
    try {
      const stillThere = (await this.callService.findActiveCallsForUser(userId)).filter(c => callIds.includes(c.id));
      if (stillThere.length === 0) return;

      if (this.roomSize(`user:${userId}`) > 0) {
        /* Le client s'est reconnecté (autre socket.id) : on garde l'appel et on
         * oublie l'ancien binding, devenu invalide. Son keepalive prouvera s'il
         * est encore réellement en appel. */
        for (const call of stillThere) {
          const binding = this.callBindings.get(call.id);
          if (!binding) continue;
          if (call.callerId === userId) binding.callerSocketId = '';
          else binding.calleeSocketId = undefined;
        }
        this.logger.log(`♻️ Socket rétabli dans le délai de grâce user=${userId} (ancien socket=${oldSocketId}) — appel conservé`);
        return;
      }
      await this.terminateForDisconnect(userId, oldSocketId, stillThere);
    } catch (e) {
      this.logger.error(`❌ Fin d'appel après délai de grâce échouée user=${userId}`, e as Error);
    }
  }

  /** Notifie l'autre participant tout de suite, puis persiste la fin en arrière-plan. */
  private async terminateForDisconnect(userId: string, socketId: string, calls: Call[]): Promise<void> {
    const ids = calls.map(c => c.id);
    for (const call of calls) {
      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
      this.logger.log(`📞 Appel coupé (déconnexion) user=${userId} socket=${socketId} → notifié=${otherUserId}`);
      this.server.to(`user:${otherUserId}`).emit('call:ended', { conversationId: call.conversationId });
      this.callBindings.delete(call.id);
      this.lastSeen.delete(`${call.id}:${call.callerId}`);
      this.lastSeen.delete(`${call.id}:${call.calleeId}`);
      this.firstSeen.delete(call.id);
    }
    this.callService.endAllCallsForUser(userId, ids).catch(e =>
      this.logger.error(`❌ Persistance fin d'appel (déconnexion) échouée user=${userId}`, e as Error));
  }

  private roomSize(room: string): number {
    return (this.server as unknown as { adapter: { rooms: Map<string, Set<string>> } })
      .adapter.rooms.get(room)?.size ?? 0;
  }

  /** Appelant démarre un appel → vérifie permission/occupé/rate-limit, puis notifie l'appelé. */
  @SubscribeMessage('call:initiate')
  handleCallInitiate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallInitiateDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, () => this.doCallInitiate(socket, body));
  }

  private async doCallInitiate(socket: AuthenticatedSocket, body: CallInitiateDto): Promise<void> {
    const callerUserId = socket.data.userId;
    const callerActorId = socket.data.actorId;
    const t0 = performance.now();
    this.logger.log(`📞 call:initiate REÇU caller=${callerUserId} callee=${body.calleeUserId}`);

    try {
      /* Un appel fantôme (mort mais encore en base) ne doit JAMAIS faire
       * répondre « occupé » : on le ferme avant le contrôle d'occupation. */
      await this.reapDeadCallsBetween(callerUserId, body.calleeUserId);

      /* getCallerDisplayInfo en parallèle de startCall() — indépendants,
       * donc pas de latence supplémentaire ajoutée sur le chemin critique
       * (voir son commentaire : résout le nom/avatar RÉELS de l'appelant
       * côté serveur, jamais depuis body.callerName/callerAvatar fournis
       * par le client). */
      const [result, callerInfo] = await Promise.all([
        this.callService.startCall(callerUserId, {
          calleeUserId:   body.calleeUserId,
          callType:       (body.callType ?? 'audio') as CallType,
          conversationId: body.conversationId,
        }, callerActorId),
        this.callService.getCallerDisplayInfo(callerUserId, callerActorId),
      ]);
      const t1 = performance.now();

      if (result.outcome === 'busy') {
        this.logger.log(`📞 call:initiate → busy caller=${callerUserId} callee=${body.calleeUserId}`);
        socket.emit('call:busy', { conversationId: body.conversationId });
        return;
      }
      if (result.outcome === 'offline') {
        this.logger.log(`📞 call:initiate → callee hors ligne caller=${callerUserId} callee=${body.calleeUserId}`);
        socket.emit('call:unavailable', {
          conversationId: body.conversationId,
          reason:  'offline',
          message: 'Cette personne est hors ligne pour le moment.',
        });
        return;
      }

      /* Lie ce socket précis au côté "caller" de l'appel — voir callBindings. */
      this.callBindings.set(result.call.id, { callerSocketId: socket.id });
      this.firstSeen.set(result.call.id, Date.now());

      const room = `user:${body.calleeUserId}`;
      this.logger.log(`📞 call:initiate caller=${callerUserId} callee=${body.calleeUserId} sockets-in-room=${this.roomSize(room)}`);
      this.server.to(room).emit('call:incoming', {
        conversationId: body.conversationId,
        callerUserId,
        callerName:     callerInfo.name,
        callerAvatar:   callerInfo.avatar,
        callType:       body.callType ?? 'audio',
      });
      const t2 = performance.now();
      this.logger.verbose(
        `[Perf][call:initiate] reçu→startCall=${(t1 - t0).toFixed(1)}ms startCall→broadcast=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms`,
      );
    } catch (e) {
      this.logger.warn(`call:initiate refusé caller=${callerUserId} callee=${body.calleeUserId} : ${(e as Error).message}`);
      socket.emit('call:unavailable', {
        conversationId: body.conversationId,
        reason:  'denied',
        message: (e as Error).message,
      });
    }
  }

  /**
   * Appelé accepte → notifie l'appelant. Gère explicitement le cas
   * multi-appareils : si CE callId a déjà été accepté par un AUTRE
   * appareil du même callee (course gagnée ailleurs pendant qu'on
   * attendait le verrou DB — voir CallService.acceptCall), on ne
   * ré-émet JAMAIS call:accepted à l'appelant (déjà fait par le
   * gagnant) — seul cet appareil précis est informé qu'il a perdu.
   */
  @SubscribeMessage('call:accept')
  handleCallAccept(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallAcceptDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, () => this.doCallAccept(socket, body));
  }

  private async doCallAccept(socket: AuthenticatedSocket, body: CallAcceptDto): Promise<void> {
    const calleeUserId = socket.data.userId;
    const t0 = performance.now();

    /* IMPORTANT : un échec ici (Forbidden/NotFound/DB down) ne doit JAMAIS
       être traité comme une victoire par défaut. Le bug historique était de
       garder `alreadyAccepted = false` (sa valeur initiale) quand acceptCall
       levait — ce qui faisait passer CE socket dans la branche "gagnant" et
       émettait un second call:accepted au caller. On sort donc explicitement
       ici, sans jamais atteindre la logique gagnant/perdant plus bas.
       PARTIE 9.5 : acceptCallFast() localise ET verrouille l'appel en un
       seul aller-retour (callerUserId/calleeUserId déjà connus ici) — voir
       CallService.acceptCallFast pour le détail du gain mesuré. */
    let result: { call: { id: string }; alreadyAccepted: boolean } | null;
    try {
      result = await this.callService.acceptCallFast(calleeUserId, body.callerUserId);
    } catch (e) {
      this.logger.warn(`call:accept persistance échouée : ${(e as Error).message}`);
      socket.emit('call:accept-failed', { conversationId: body.conversationId });
      return;
    }
    const t1 = performance.now();

    if (!result) {
      this.logger.warn(`call:accept sans appel actif — callee=${calleeUserId} caller=${body.callerUserId}`);
      socket.emit('call:accept-failed', { conversationId: body.conversationId });
      return;
    }
    const callId = result.call.id;

    if (result.alreadyAccepted) {
      /* Cet appareil a perdu la course — un autre appareil du même
         utilisateur a déjà fait aboutir l'appel. Ne PAS re-notifier
         l'appelant (déjà fait), juste informer CET appareil précis. */
      this.logger.log(`ℹ️ call:accept déjà traité ailleurs — callee=${calleeUserId} caller=${body.callerUserId} socket=${socket.id}`);
      socket.emit('call:accept-superseded', { conversationId: body.conversationId });
      return;
    }

    /* Cet appareil a gagné — le lier au côté "callee" de l'appel (voir
       callBindings) et informer les AUTRES appareils du même callee
       (qui affichaient peut-être encore "appel entrant") de se fermer. */
    const binding = this.callBindings.get(callId);
    if (binding) binding.calleeSocketId = socket.id;
    else this.callBindings.set(callId, { callerSocketId: '', calleeSocketId: socket.id });

    this.server.to(`user:${calleeUserId}`).except(socket.id).emit('call:accepted-elsewhere', {
      conversationId: body.conversationId,
    });

    const room = `user:${body.callerUserId}`;
    this.logger.log(`✅ call:accept callee=${calleeUserId} caller=${body.callerUserId} sockets-in-room=${this.roomSize(room)}`);
    this.server.to(room).emit('call:accepted', {
      conversationId: body.conversationId,
      calleeUserId,
    });
    const t2 = performance.now();
    this.logger.verbose(
      `[Perf][call:accept] acceptCallFast=${(t1 - t0).toFixed(1)}ms broadcast=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms`,
    );
  }

  /**
   * Appelé refuse → notifie l'appelant.
   *
   * PARTIE 9.5 — raccrochage/refus quasi instantané : findActiveCallId()
   * est une LECTURE (autorisation — confirme qu'un appel actif existe bien
   * entre ces deux users, INDISPENSABLE avant de diffuser quoi que ce soit :
   * sans ce contrôle, n'importe quel client authentifié pourrait forcer un
   * call:rejected chez un utilisateur arbitraire). Diffuser peut donc se
   * faire dès que cette lecture confirme l'appel — la PERSISTANCE
   * (rejectCall : verrou + écriture historique + suppression de la ligne
   * active) est un aller-retour DB supplémentaire qui n'a, lui, aucune
   * raison de retarder la notification de l'appelant : elle continue en
   * arrière-plan, ses erreurs restent journalisées comme avant.
   */
  @SubscribeMessage('call:reject')
  handleCallReject(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallRejectDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, () => this.doCallReject(socket, body));
  }

  private async doCallReject(socket: AuthenticatedSocket, body: CallRejectDto): Promise<void> {
    const calleeUserId = socket.data.userId;
    const t0 = performance.now();

    const callId = await this.callService.findActiveCallId(body.callerUserId, calleeUserId);
    const t1 = performance.now();

    this.server.to(`user:${body.callerUserId}`).emit('call:rejected', {
      conversationId: body.conversationId,
    });
    const t2 = performance.now();
    this.logger.verbose(
      `[Perf][call:reject] findActiveCallId=${(t1 - t0).toFixed(1)}ms broadcast=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms`,
    );

    if (callId) {
      this.callBindings.delete(callId);
      this.callService.rejectCall(calleeUserId, callId).catch(e =>
        this.logger.warn(`call:reject persistance échouée : ${(e as Error).message}`));
    }
  }

  /**
   * Un participant raccroche → notifie l'autre.
   *
   * PARTIE 9.5 — même principe que handleCallReject ci-dessus : la lecture
   * d'autorisation (findActiveCallId) précède et gate la diffusion, la
   * persistance (endCall : historique + suppression) part en arrière-plan
   * APRÈS avoir notifié l'autre participant. Mesuré : ce réordonnancement
   * fait passer le délai perçu par le correspondant de ~530ms à ~95ms (voir
   * rapport partie 9.5) sans changer une seule règle de sécurité — le
   * correspondant n'apprend JAMAIS la fin d'un appel avant que le serveur
   * ait confirmé qu'il existait réellement et impliquait ces deux users.
   */
  @SubscribeMessage('call:end')
  handleCallEnd(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallEndDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, () => this.doCallEnd(socket, body));
  }

  private async doCallEnd(socket: AuthenticatedSocket, body: CallEndDto): Promise<void> {
    const userId = socket.data.userId;
    const t0 = performance.now();

    const callId = await this.callService.findActiveCallId(userId, body.targetUserId);
    const t1 = performance.now();

    this.server.to(`user:${body.targetUserId}`).emit('call:ended', {
      conversationId: body.conversationId,
    });
    const t2 = performance.now();
    this.logger.verbose(
      `[Perf][call:end] findActiveCallId=${(t1 - t0).toFixed(1)}ms broadcast=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms (persistance en arrière-plan, non comptée ici)`,
    );

    if (callId) {
      this.callBindings.delete(callId);
      this.callService.endCall(userId, callId).catch(e =>
        this.logger.warn(`call:end persistance échouée : ${(e as Error).message}`));
    }
  }

  /**
   * Vérifie qu'un appel actif existe bien entre ces deux users avant de
   * relayer un signal WebRTC — SANS ça, n'importe quel utilisateur
   * authentifié pouvait émettre call:offer/answer/ice-candidate vers un
   * targetUserId arbitraire et injecter de la signalisation chez un
   * utilisateur avec qui il n'a AUCUNE relation, en contournant entièrement
   * assertCanCall (contact/follow/commande) qui ne s'exécute que dans
   * call:initiate. call:accept/reject/end avaient déjà ce garde-fou via
   * findActiveCallId — il manquait ici. */
  private async assertActiveCallBetween(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB) return false;
    const callId = await this.callService.findActiveCallId(userA, userB);
    if (!callId) {
      this.logger.warn(`⛔ Signal WebRTC refusé — aucun appel actif entre ${userA} et ${userB}`);
      return false;
    }
    return true;
  }

  /** true si CETTE connexion n'a pas dépassé le débit de signalisation autorisé. */
  private checkSignalFlood(socket: AuthenticatedSocket): boolean {
    if (this.floodGuard.allow('signal', socket.id, SIGNAL_FLOOD_MAX, SIGNAL_FLOOD_WINDOW_MS)) return true;
    this.logger.warn(`⛔ Flood de signalisation détecté — socket=${socket.id} user=${socket.data?.userId}`);
    return false;
  }

  /** Offer SDP (appelant → appelé). */
  @SubscribeMessage('call:offer')
  async handleCallOffer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallOfferDto,
  ): Promise<void> {
    if (!this.checkSignalFlood(socket)) return;
    const fromUserId = socket.data.userId;
    if (!(await this.assertActiveCallBetween(fromUserId, body?.targetUserId))) return;

    const room = `user:${body.targetUserId}`;
    this.logger.log(`🔄 call:offer from=${fromUserId} to=${body.targetUserId} sockets-in-room=${this.roomSize(room)}`);
    this.server.to(room).emit('call:offer', {
      conversationId: body.conversationId,
      fromUserId,
      sdp:            body.sdp,
    });
  }

  /** Answer SDP (appelé → appelant). */
  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallAnswerDto,
  ): Promise<void> {
    if (!this.checkSignalFlood(socket)) return;
    const fromUserId = socket.data.userId;
    if (!(await this.assertActiveCallBetween(fromUserId, body?.targetUserId))) return;

    const room = `user:${body.targetUserId}`;
    this.logger.log(`🔄 call:answer from=${fromUserId} to=${body.targetUserId} sockets-in-room=${this.roomSize(room)}`);
    this.server.to(room).emit('call:answer', {
      conversationId: body.conversationId,
      fromUserId,
      sdp:            body.sdp,
    });
  }

  /** Candidat ICE (dans les deux sens). */
  @SubscribeMessage('call:ice-candidate')
  async handleCallIceCandidate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallIceCandidateDto,
  ): Promise<void> {
    if (!this.checkSignalFlood(socket)) return;
    const fromUserId = socket.data.userId;
    if (!(await this.assertActiveCallBetween(fromUserId, body?.targetUserId))) return;

    this.server.to(`user:${body.targetUserId}`).emit('call:ice-candidate', {
      conversationId: body.conversationId,
      fromUserId,
      candidate:      body.candidate,
    });
  }

  /** Appelé occupé (détecté côté client) → notifie l'appelant ET ferme la ligne
   *  d'appel : sinon elle restait "en sonnerie" ~35 s et chaque nouvelle
   *  tentative de l'appelant retombait sur « occupé » / « déjà en appel ». */
  @SubscribeMessage('call:busy')
  handleCallBusy(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallBusyDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, () => this.doCallBusy(socket, body));
  }

  private async doCallBusy(socket: AuthenticatedSocket, body: CallBusyDto): Promise<void> {
    const fromUserId = socket.data.userId;
    const callId = fromUserId && body?.callerUserId
      ? await this.callService.findActiveCallId(body.callerUserId, fromUserId)
      : null;
    if (!callId) {
      this.logger.warn(`⛔ call:busy ignoré — aucun appel actif entre ${fromUserId} et ${body?.callerUserId}`);
      return;
    }

    this.server.to(`user:${body.callerUserId}`).emit('call:busy', {
      conversationId: body.conversationId,
    });
    this.callBindings.delete(callId);
    this.callService.markBusy(fromUserId, callId).catch(e =>
      this.logger.warn(`call:busy persistance échouée : ${(e as Error).message}`));
  }

  /**
   * Signal de vie d'un client qui se croit en appel (toutes les 10 s). Sert à
   * détecter les appels fantômes (voir KEEPALIVE_DEAD_MS). Si le serveur n'a
   * AUCUN appel entre ces deux utilisateurs, on le dit au client (`call:ended`)
   * pour qu'il ferme lui aussi son état local — c'est ce qui débloque un
   * client resté « en appel » alors que la ligne a déjà été supprimée.
   */
  @SubscribeMessage('call:keepalive')
  handleCallKeepalive(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallKeepaliveDto,
  ): Promise<void> {
    return this.runSerial(socket.data.userId, async () => {
      const userId = socket.data.userId;
      if (!userId) return;
      let callId: string | null;
      try {
        callId = await this.callService.findActiveCallId(userId, body.targetUserId);
      } catch {
        return; // lecture impossible : on ne conclut rien
      }
      if (!callId) {
        socket.emit('call:ended', { conversationId: body.conversationId });
        return;
      }
      this.lastSeen.set(`${callId}:${userId}`, Date.now());
    });
  }
}
