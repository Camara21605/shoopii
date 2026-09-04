/* ============================================================
 * FICHIER : src/modules/public/public-broadcast.service.ts
 *
 * RÔLE : Pont entre les services REST publics et PublicGateway
 *        (Socket.IO), même pattern que NotificationBroadcastService
 *        (voir notifications/services/notification-broadcast.service.ts) —
 *        évite une dépendance circulaire service ↔ gateway.
 *
 * POURQUOI UN GATEWAY SÉPARÉ DE /notifications :
 *   /notifications exige un JWT valide à la connexion (voir
 *   NotificationGateway.handleConnection) — inutilisable pour la page
 *   boutique publique, consultée par des visiteurs non connectés.
 *   PublicGateway (namespace /public) n'exige aucune authentification :
 *   n'importe quel visiteur peut rejoindre la room `boutique:{companyId}`
 *   de la fiche qu'il consulte pour recevoir ses mises à jour en direct
 *   (horaires modifiés par le propriétaire, etc.) sans avoir à recharger
 *   la page.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class PublicBroadcastService {

  private server: Server | null = null;

  private readonly logger = new Logger(PublicBroadcastService.name);

  /** Appelé par PublicGateway.afterInit(). */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('🔌 PublicBroadcastService: server Socket.IO enregistré');
  }

  /**
   * Émet un événement à tous les visiteurs actuellement sur la fiche
   * publique de cette entreprise (room `boutique:{companyId}`).
   * Silencieux si personne n'écoute (0 socket dans la room) ou si le
   * gateway n'est pas encore initialisé — jamais bloquant pour l'appelant.
   */
  emitToBoutique(companyId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn('emitToBoutique: server Socket.IO non encore initialisé');
      return;
    }
    this.server.to(`boutique:${companyId}`).emit(event, payload);
  }

  /**
   * Émet un événement à TOUS les visiteurs connectés au namespace /public,
   * peu importe la room — pour les surfaces qui agrègent plusieurs
   * entreprises à la fois (ex: Home) et ne peuvent donc pas être ciblées
   * par une seule room `boutique:{companyId}` comme emitToBoutique().
   */
  emitGlobal(event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn('emitGlobal: server Socket.IO non encore initialisé');
      return;
    }
    this.server.emit(event, payload);
  }
}
