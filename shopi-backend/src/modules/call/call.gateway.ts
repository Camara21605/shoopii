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
import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';
import { CallService } from './call.service';
import { CallType } from 'src/database/entities/call/call.entity';

@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(CallGateway.name);

  constructor(private readonly callService: CallService) {}

  /**
   * Nettoie tout appel actif dont ce socket faisait partie — sans ça, un
   * onglet fermé/un crash/une coupure réseau EN PLEIN APPEL laissait la
   * ligne `calls` orpheline pour toujours, et `isUserBusy()` bloquait
   * ensuite CHAQUE tentative d'appel future de cet utilisateur ("Vous
   * êtes déjà en appel") — plus aucun moyen de rappeler sans intervention
   * manuelle en base. Voir CallService.endAllCallsForUser pour la limite
   * connue (multi-onglets) et le raisonnement complet.
   */
  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (!userId) return;

    try {
      const toNotify = await this.callService.endAllCallsForUser(userId);
      for (const { otherUserId, conversationId } of toNotify) {
        this.logger.log(`📞 Appel coupé (déconnexion) user=${userId} → notifié=${otherUserId}`);
        this.server.to(`user:${otherUserId}`).emit('call:ended', { conversationId });
      }
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
    @MessageBody() body: {
      conversationId: string;
      calleeUserId:   string;
      callerName:     string;
      callerAvatar?:  string;
      callType?:      'audio' | 'video';
    },
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

  /** Appelé accepte → notifie l'appelant. */
  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callerUserId: string },
  ): Promise<void> {
    const calleeUserId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(body.callerUserId, calleeUserId);
    if (callId) {
      await this.callService.acceptCall(calleeUserId, callId).catch(e =>
        this.logger.warn(`call:accept persistance échouée : ${(e as Error).message}`));
    }

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
    @MessageBody() body: { conversationId: string; callerUserId: string },
  ): Promise<void> {
    const calleeUserId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(body.callerUserId, calleeUserId);
    if (callId) {
      await this.callService.rejectCall(calleeUserId, callId).catch(e =>
        this.logger.warn(`call:reject persistance échouée : ${(e as Error).message}`));
    }

    this.server.to(`user:${body.callerUserId}`).emit('call:rejected', {
      conversationId: body.conversationId,
    });
  }

  /** Un participant raccroche → notifie l'autre. */
  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; targetUserId: string },
  ): Promise<void> {
    const userId = socket.data.userId;

    const callId = await this.callService.findActiveCallId(userId, body.targetUserId);
    if (callId) {
      await this.callService.endCall(userId, callId).catch(e =>
        this.logger.warn(`call:end persistance échouée : ${(e as Error).message}`));
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

  /** Offer SDP (appelant → appelé). */
  @SubscribeMessage('call:offer')
  async handleCallOffer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: {
      conversationId: string;
      targetUserId:   string;
      sdp:            RTCSessionDescriptionInit;
    },
  ): Promise<void> {
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
    @MessageBody() body: {
      conversationId: string;
      targetUserId:   string;
      sdp:            RTCSessionDescriptionInit;
    },
  ): Promise<void> {
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
    @MessageBody() body: {
      conversationId: string;
      targetUserId:   string;
      candidate:      RTCIceCandidateInit;
    },
  ): Promise<void> {
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
    @MessageBody() body: { conversationId: string; callerUserId: string },
  ): Promise<void> {
    const fromUserId = socket.data.userId;
    if (!(await this.assertActiveCallBetween(fromUserId, body?.callerUserId))) return;

    this.server.to(`user:${body.callerUserId}`).emit('call:busy', {
      conversationId: body.conversationId,
    });
  }
}
