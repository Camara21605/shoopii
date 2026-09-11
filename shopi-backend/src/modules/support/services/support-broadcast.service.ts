/* ============================================================
 * FICHIER : src/modules/support/services/support-broadcast.service.ts
 *
 * RÔLE : Couche d'abstraction entre ConversationService (REST) et
 *        SupportGateway (Socket.IO) — même pattern que
 *        messagerie/services/broadcast.service.ts.
 *
 * POURQUOI SÉPARER :
 *   ConversationService dépend de TypeORM (BDD).
 *   Le Gateway dépend de Socket.IO.
 *   Les croiser crée une dépendance circulaire.
 *   → SupportBroadcastService est injecté dans les DEUX.
 *     Il tient la référence du Server Socket.IO.
 *
 * ROOM : ticket:{ticketId} — rejointe par tous ceux qui consultent
 *        activement le fil d'un ticket (client OU agent), via
 *        SupportGateway.join_ticket. Voir "la communication doit être
 *        instantanée" — avant ce service, seule la notification-bell
 *        (BroadcastService générique par utilisateur) existait ; rien
 *        ne mettait à jour en direct un fil déjà ouvert à l'écran.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

const ticketRoom = (ticketId: string) => `ticket:${ticketId}`;

export interface WsSupportMessagePayload {
  ticketId:  string;
  message: {
    id:         string;
    ticketId:   string;
    content:    string;
    senderType: string;
    senderId:   string;
    senderName: string;
    isInternal: boolean;
    createdAt:  string;
  };
}

export interface WsSupportTicketUpdatedPayload {
  ticketId: string;
  status?:   string;
  priority?: string;
  agentId?:  string | null;
}

@Injectable()
export class SupportBroadcastService {
  private readonly logger = new Logger(SupportBroadcastService.name);
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
    this.logger.log('[SupportBroadcast] Server Socket.IO enregistré.');
  }

  /** Diffuse un nouveau message à tous ceux qui consultent ce ticket. */
  emitNewMessage(payload: WsSupportMessagePayload): void {
    if (!this.server) return;
    this.server.to(ticketRoom(payload.ticketId)).emit('support:new_message', payload);
    this.logger.debug(`[SupportBroadcast] support:new_message → ${ticketRoom(payload.ticketId)}`);
  }

  /** Diffuse un changement (statut/priorité/assignation) en direct. */
  emitTicketUpdated(payload: WsSupportTicketUpdatedPayload): void {
    if (!this.server) return;
    this.server.to(ticketRoom(payload.ticketId)).emit('support:ticket_updated', payload);
  }
}
