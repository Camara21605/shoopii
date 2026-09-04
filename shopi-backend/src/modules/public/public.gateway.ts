/* ============================================================
 * FICHIER : src/modules/public/public.gateway.ts
 *
 * RÔLE : Gateway Socket.IO pour les pages publiques (fiche boutique).
 *
 * NAMESPACE : /public — AUCUNE authentification requise (contrairement
 *   à /notifications) : un visiteur anonyme sur /boutique/:id doit
 *   pouvoir recevoir les mises à jour en direct de CETTE fiche précise.
 *
 * ROOMS :
 *   boutique:{companyId}   → tous les visiteurs actuellement sur cette fiche
 *
 * ÉVÉNEMENTS CLIENT → SERVEUR :
 *   boutique:join   { companyId }  → rejoindre la room de cette fiche
 *   boutique:leave  { companyId }  → quitter (avant de changer de fiche
 *                                     sans démonter le socket, ex. SPA)
 *
 * ÉVÉNEMENTS SERVEUR → CLIENT :
 *   boutique:horaires_updated  { horaires: [...] }  (voir HorairesParametresService)
 *
 * SÉCURITÉ : ce socket ne fait que DIFFUSER en lecture seule des données
 *   déjà publiques (mêmes infos que GET /public/boutiques/:id) — aucune
 *   action, aucune donnée sensible, pas de vérification nécessaire au-delà
 *   d'un rate-limit implicite (connexion Socket.IO standard).
 * ============================================================ */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

import { PublicBroadcastService } from './public-broadcast.service';

@WebSocketGateway({
  namespace: '/public',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class PublicGateway implements OnGatewayInit {

  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(PublicGateway.name);

  constructor(private readonly broadcast: PublicBroadcastService) {}

  afterInit(server: Server): void {
    this.broadcast.setServer(server);
    this.logger.log('🌐 Gateway /public initialisée');
  }

  @SubscribeMessage('boutique:join')
  handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody()    body:   { companyId?: string },
  ): void {
    if (!body?.companyId) return;
    socket.join(`boutique:${body.companyId}`);
  }

  @SubscribeMessage('boutique:leave')
  handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody()    body:   { companyId?: string },
  ): void {
    if (!body?.companyId) return;
    socket.leave(`boutique:${body.companyId}`);
  }
}
