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
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Server } from 'socket.io';

import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';
import { CallService } from './call.service';
import { CallStatus, CallType } from 'src/database/entities/call/call.entity';
import {
  CallInitiateDto, CallAcceptDto, CallRejectDto, CallEndDto, CallBusyDto,
  CallOfferDto, CallAnswerDto, CallIceCandidateDto,
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
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayDisconnect {
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
      const callIdsToEnd: string[] = [];

      for (const call of activeCalls) {
        const binding    = this.callBindings.get(call.id);
        const isCaller    = call.callerId === userId;
        const boundSocket = isCaller ? binding?.callerSocketId : binding?.calleeSocketId;

        if (boundSocket) {
          if (boundSocket === socket.id) callIdsToEnd.push(call.id);
          // sinon : un AUTRE appareil du même utilisateur porte cet appel — ignorer.
        } else if (isCaller) {
          // Personne n'a encore de binding ET c'est le caller qui part —
          // aucun autre appareil ne peut porter SON côté de cet appel.
          callIdsToEnd.push(call.id);
        } else if (call.status === CallStatus.CONNECTED) {
          // Callee déjà connecté mais binding inconnu (ex. redémarrage
          // serveur) — comportement conservateur historique.
          callIdsToEnd.push(call.id);
        }
        // Dernier cas restant : callee en RINGING sans binding connu →
        // volontairement IGNORÉ, une autre session peut encore répondre.
      }

      if (callIdsToEnd.length === 0) return;

      const toNotify = await this.callService.endAllCallsForUser(userId, callIdsToEnd);
      for (const { otherUserId, conversationId } of toNotify) {
        this.logger.log(`📞 Appel coupé (déconnexion) user=${userId} socket=${socket.id} → notifié=${otherUserId}`);
        this.server.to(`user:${otherUserId}`).emit('call:ended', { conversationId });
      }
      for (const callId of callIdsToEnd) this.callBindings.delete(callId);
    } catch (e) {
      // Une panne ici ne doit jamais faire planter le process — le pire
      // cas est un appel qui reste "actif" un peu plus longtemps.
      this.logger.error(`❌ Erreur nettoyage appels à la déconnexion user=${userId}`, e as Error);
    }
  }

  private roomSize(room: string): number {
    return (this.server as unknown as { adapter: { rooms: Map<string, Set<string>> } })
      .adapter.rooms.get(room)?.size ?? 0;
  }

  /** Appelant démarre un appel → vérifie permission/occupé/rate-limit, puis notifie l'appelé. */
  @SubscribeMessage('call:initiate')
  async handleCallInitiate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallInitiateDto,
  ): Promise<void> {
    const callerUserId = socket.data.userId;
    this.logger.log(`📞 call:initiate REÇU caller=${callerUserId} callee=${body.calleeUserId}`);

    try {
      const result = await this.callService.startCall(callerUserId, {
        calleeUserId:   body.calleeUserId,
        callType:       (body.callType ?? 'audio') as CallType,
        conversationId: body.conversationId,
      });

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

      const room = `user:${body.calleeUserId}`;
      this.logger.log(`📞 call:initiate caller=${callerUserId} callee=${body.calleeUserId} sockets-in-room=${this.roomSize(room)}`);
      this.server.to(room).emit('call:incoming', {
        conversationId: body.conversationId,
        callerUserId,
        callerName:     body.callerName,
        callerAvatar:   body.callerAvatar,
        callType:       body.callType ?? 'audio',
      });
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
  async handleCallAccept(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallAcceptDto,
  ): Promise<void> {
    const calleeUserId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(body.callerUserId, calleeUserId);
    if (!callId) {
      this.logger.warn(`call:accept sans appel actif — callee=${calleeUserId} caller=${body.callerUserId}`);
      socket.emit('call:accept-failed', { conversationId: body.conversationId });
      return;
    }

    /* IMPORTANT : un échec ici (Forbidden/NotFound/DB down) ne doit JAMAIS
       être traité comme une victoire par défaut. Le bug historique était de
       garder `alreadyAccepted = false` (sa valeur initiale) quand acceptCall
       levait — ce qui faisait passer CE socket dans la branche "gagnant" et
       émettait un second call:accepted au caller. On sort donc explicitement
       ici, sans jamais atteindre la logique gagnant/perdant plus bas. */
    let result: { call: unknown; alreadyAccepted: boolean };
    try {
      result = await this.callService.acceptCall(calleeUserId, callId);
    } catch (e) {
      this.logger.warn(`call:accept persistance échouée : ${(e as Error).message}`);
      socket.emit('call:accept-failed', { conversationId: body.conversationId });
      return;
    }

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
    if (callId) {
      const binding = this.callBindings.get(callId);
      if (binding) binding.calleeSocketId = socket.id;
      else this.callBindings.set(callId, { callerSocketId: '', calleeSocketId: socket.id });
    }
    this.server.to(`user:${calleeUserId}`).except(socket.id).emit('call:accepted-elsewhere', {
      conversationId: body.conversationId,
    });

    const room = `user:${body.callerUserId}`;
    this.logger.log(`✅ call:accept callee=${calleeUserId} caller=${body.callerUserId} sockets-in-room=${this.roomSize(room)}`);
    this.server.to(room).emit('call:accepted', {
      conversationId: body.conversationId,
      calleeUserId,
    });
  }

  /** Appelé refuse → notifie l'appelant. */
  @SubscribeMessage('call:reject')
  async handleCallReject(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallRejectDto,
  ): Promise<void> {
    const calleeUserId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(body.callerUserId, calleeUserId);
    if (callId) {
      await this.callService.rejectCall(calleeUserId, callId).catch(e =>
        this.logger.warn(`call:reject persistance échouée : ${(e as Error).message}`));
      this.callBindings.delete(callId);
    }

    this.server.to(`user:${body.callerUserId}`).emit('call:rejected', {
      conversationId: body.conversationId,
    });
  }

  /** Un participant raccroche → notifie l'autre. */
  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallEndDto,
  ): Promise<void> {
    const userId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(userId, body.targetUserId);
    if (callId) {
      await this.callService.endCall(userId, callId).catch(e =>
        this.logger.warn(`call:end persistance échouée : ${(e as Error).message}`));
      this.callBindings.delete(callId);
    }

    this.server.to(`user:${body.targetUserId}`).emit('call:ended', {
      conversationId: body.conversationId,
    });
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

  /** Appelé occupé (détecté côté client) → notifie l'appelant.
   *  NOTE : depuis l'ajout du busy-check serveur dans call:initiate,
   *  ce handler ne devrait plus être atteint en pratique (le serveur
   *  répond déjà 'busy' avant même que ça sonne) — conservé pour les
   *  cas limites (deux appels initiés en même temps). */
  @SubscribeMessage('call:busy')
  async handleCallBusy(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallBusyDto,
  ): Promise<void> {
    const fromUserId = socket.data.userId;
    if (!(await this.assertActiveCallBetween(fromUserId, body?.callerUserId))) return;

    this.server.to(`user:${body.callerUserId}`).emit('call:busy', {
      conversationId: body.conversationId,
    });
  }
}
