/**
 * ============================================================
 * FICHIER : src/modules/messagerie/services/broadcast.service.ts
 *
 * RÔLE : Couche d'abstraction entre MessagerieService (REST)
 *        et le Gateway Socket.IO.
 *
 * POURQUOI SÉPARER :
 *   MessagerieService dépend de TypeORM (BDD).
 *   Le Gateway dépend de Socket.IO.
 *   Les croiser crée une dépendance circulaire.
 *   → BroadcastService est injecté dans les DEUX.
 *     Il tient la référence du Server Socket.IO.
 *
 * PATTERN : Service Mediator (GoF).
 *
 * UTILISATION :
 *   MessagerieService.sendMessage() → broadcastService.newMessage()
 *   MessagerieGateway → broadcastService.setServer()
 * ============================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type {
  WsNewMessagePayload,
  WsMessageDeliveredPayload,
  WsMessageReadPayload,
  WsTypingBroadcast,
  WsPresencePayload,
  WsMessageEditedPayload,
  WsMessageDeletedPayload,
  WsReactionPayload,
} from '../interfaces/messaging.interfaces';

/** Nom de la room privée d'un utilisateur. */
const userRoom = (userId: string) => `user:${userId}`;

/** Nom de la room d'une conversation (indicateur typing). */
const convRoom = (convId: string) => `conv:${convId}`;

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private server: Server | null = null;

  // ─────────────────────────────────────────────────────────
  // ENREGISTREMENT DU SERVER
  // Appelé depuis MessagerieGateway.afterInit()
  // ─────────────────────────────────────────────────────────

  setServer(server: Server): void {
    this.server = server;
    this.logger.log('[Broadcast] Server Socket.IO enregistré.');
  }

  // ─────────────────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────────────────

  /**
   * Diffuse un nouveau message aux destinataires.
   * Si le destinataire est en ligne (a des sockets actifs dans sa room),
   * émet immédiatement `message_delivered` à l'expéditeur.
   *
   * @param recipientUserIds  Destinataires (hors expéditeur)
   * @param senderUserId      Expéditeur — reçoit l'accusé de livraison
   * @param payload           Données du message
   */
  async newMessage(
    recipientUserIds: string[],
    senderUserId:     string,
    payload:          WsNewMessagePayload,
  ): Promise<void> {
    if (!this.server) return;

    for (const uid of recipientUserIds) {
      this.server.to(userRoom(uid)).emit('new_message', payload);
      this.logger.debug(`[Broadcast] new_message → user:${uid} conv=${payload.conversationId}`);

      /*
       * Vérifie si le destinataire est actif dans sa room Socket.IO.
       * fetchSockets() retourne les sockets connectés dans la room.
       * Si > 0 → le message est immédiatement "livré".
       */
      try {
        const activeSockets = await this.server.in(userRoom(uid)).fetchSockets();
        if (activeSockets.length > 0) {
          this.server.to(userRoom(senderUserId)).emit('message_delivered', {
            conversationId: payload.conversationId,
            messageId:      payload.message.id,
            deliveredAt:    new Date().toISOString(),
          } satisfies WsMessageDeliveredPayload);
          this.logger.debug(`[Broadcast] message_delivered → sender:${senderUserId} msg=${payload.message.id}`);
        }
      } catch {
        /* fetchSockets peut échouer en multi-instance sans Redis Adapter — ignoré */
      }
    }
  }

  /**
   * Accusé de livraison — informe l'expéditeur que son message
   * est bien arrivé chez le destinataire.
   */
  messageDelivered(senderUserId: string, payload: WsMessageDeliveredPayload): void {
    if (!this.server) return;
    this.server.to(userRoom(senderUserId)).emit('message_delivered', payload);
  }

  /**
   * Accusé de lecture — informe l'expéditeur que son message a été lu.
   */
  messageRead(senderUserId: string, payload: WsMessageReadPayload): void {
    if (!this.server) return;
    this.server.to(userRoom(senderUserId)).emit('message_read', payload);
  }

  /**
   * Message modifié — informe tous les participants.
   */
  messageEdited(recipientUserIds: string[], payload: WsMessageEditedPayload): void {
    if (!this.server) return;
    recipientUserIds.forEach(uid => {
      this.server!.to(userRoom(uid)).emit('message_edited', payload);
    });
  }

  /**
   * Message supprimé — informe tous les participants.
   */
  messageDeleted(recipientUserIds: string[], payload: WsMessageDeletedPayload): void {
    if (!this.server) return;
    recipientUserIds.forEach(uid => {
      this.server!.to(userRoom(uid)).emit('message_deleted', payload);
    });
  }

  /**
   * Réaction — informe tous les participants.
   */
  reactionUpdated(recipientUserIds: string[], payload: WsReactionPayload): void {
    if (!this.server) return;
    recipientUserIds.forEach(uid => {
      this.server!.to(userRoom(uid)).emit('reaction_updated', payload);
    });
  }

  // ─────────────────────────────────────────────────────────
  // INDICATEURS D'ACTIVITÉ
  // ─────────────────────────────────────────────────────────

  /**
   * Diffuse l'indicateur d'activité (frappe, enregistrement, upload)
   * à tous les membres d'une conversation sauf l'expéditeur.
   *
   * Utilise la room conv:{convId} pour éviter de connaître
   * les userId des membres ici.
   */
  typing(
    conversationId: string,
    excludeSocketId: string,
    payload: WsTypingBroadcast,
  ): void {
    if (!this.server) return;

    this.server
      .to(convRoom(conversationId))
      .except(excludeSocketId)
      .emit('typing', payload);
  }

  // ─────────────────────────────────────────────────────────
  // PRÉSENCE
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie le changement de présence (online/offline)
   * à tous les utilisateurs qui ont une conversation avec userId.
   *
   * @param contactUserIds  Liste des userId à notifier
   */
  presenceChanged(contactUserIds: string[], payload: WsPresencePayload): void {
    if (!this.server) return;
    contactUserIds.forEach(uid => {
      this.server!.to(userRoom(uid)).emit('presence', payload);
    });
  }
}
