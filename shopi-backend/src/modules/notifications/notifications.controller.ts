/* ============================================================
 * FICHIER : src/modules/notifications/notifications.controller.ts
 *
 * RÔLE : API REST complète du centre de notifications.
 *
 * SÉCURITÉ :
 *   JwtAuthGuard sur toutes les routes (token JWT requis).
 *   L'acteur est extrait du payload JWT (sub + role + actorId).
 *
 * ENDPOINTS :
 *   GET    /notifications              → liste paginée
 *   GET    /notifications/unread-count → badge
 *   PATCH  /notifications/read-all     → tout marquer lu
 *   GET    /notifications/preferences  → lire préférences
 *   PATCH  /notifications/preferences  → modifier préférences
 *   POST   /notifications/push-token   → enregistrer token
 *   PATCH  /notifications/:id/read     → marquer 1 notif lue
 *   DELETE /notifications/:id          → supprimer 1 notif
 *
 * RÉSOLUTION ACTEUR :
 *   Le JWT contient : sub (userId), role, actorId (profil UUID).
 *   L'actorType est déduit du role via ROLE_TO_ACTOR_TYPE.
 * ============================================================ */

import {
  Controller, Get, Patch, Delete, Post,
  Body, Param, Query, UseGuards,
  HttpCode, HttpStatus, ParseUUIDPipe,
  Request, ForbiddenException, UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard }            from 'src/common/guards/auth.guard';
import { NotificationService }     from './services/notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { UpdatePreferencesDto }    from './dto/update-preferences.dto';
import { RegisterPushTokenDto }    from './dto/register-push-token.dto';
import { NotificationActorType }   from 'src/database/entities/notification/notification.entitiy';
import { ROLE_TO_ACTOR_TYPE }      from './utils/actor-type.util';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {

  constructor(
    private readonly service: NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // HELPER : résoudre l'acteur depuis le JWT
  // ─────────────────────────────────────────────────────────

  private resolveActor(req: any): { actorType: NotificationActorType; actorId: string } {
    const user = req.user;

    const actorType = ROLE_TO_ACTOR_TYPE[user.role];
    if (!actorType) {
      throw new ForbiddenException(`Rôle non supporté pour les notifications : ${user.role}`);
    }

    // actorId = profil UUID (injecté par JwtStrategy depuis le token)
    // user.id = UUID users table (fallback pour anciens tokens sans actorId)
    const actorId = (user.actorId ?? user.id) as string | undefined;
    if (!actorId) {
      throw new UnauthorizedException('Impossible de déterminer l\'acteur depuis le token JWT');
    }

    return { actorType, actorId };
  }

  // ─────────────────────────────────────────────────────────
  // LISTE DES NOTIFICATIONS
  // ─────────────────────────────────────────────────────────

  /**
   * GET /notifications
   *
   * Retourne la liste paginée des notifications de l'acteur connecté.
   * Supports : cursor, unreadOnly, type, search.
   */
  @Get()
  async getNotifications(
    @Request() req: any,
    @Query()   query: ListNotificationsQueryDto,
  ) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.getList(actorType, actorId, query);
  }

  // ─────────────────────────────────────────────────────────
  // BADGE NON LU
  // ─────────────────────────────────────────────────────────

  /**
   * GET /notifications/unread-count
   *
   * Retourne uniquement le compteur de notifications non lues.
   * Endpoint léger pour la topbar (pas de chargement des notifications).
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const { actorType, actorId } = this.resolveActor(req);
    const count = await this.service.getUnreadCount(actorType, actorId);
    return { unreadCount: count };
  }

  // ─────────────────────────────────────────────────────────
  // MARQUER COMME LU
  // ─────────────────────────────────────────────────────────

  /**
   * PATCH /notifications/read-all
   *
   * Marque toutes les notifications comme lues.
   * Remet le compteur à 0 et émet notif:unread_count via socket.
   *
   * ⚠️ Doit être AVANT /:id/read pour éviter le conflit de route.
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Request() req: any) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.markAllAsRead(actorType, actorId);
  }

  /**
   * PATCH /notifications/:id/read
   *
   * Marque une notification spécifique comme lue.
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const { actorType, actorId } = this.resolveActor(req);
    await this.service.markAsRead(id, actorType, actorId);
  }

  // ─────────────────────────────────────────────────────────
  // SUPPRIMER
  // ─────────────────────────────────────────────────────────

  /**
   * DELETE /notifications/:id
   *
   * Supprime définitivement une notification.
   * Les DeliveryLogs associés sont supprimés par CASCADE.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const { actorType, actorId } = this.resolveActor(req);
    await this.service.deleteOne(id, actorType, actorId);
  }

  // ─────────────────────────────────────────────────────────
  // PRÉFÉRENCES
  // ─────────────────────────────────────────────────────────

  /**
   * GET /notifications/preferences
   *
   * Retourne les préférences complètes de l'acteur connecté.
   */
  @Get('preferences')
  async getPreferences(@Request() req: any) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.getPreferences(actorType, actorId);
  }

  /**
   * PATCH /notifications/preferences
   *
   * Met à jour partiellement les préférences.
   * Merge profond : seuls les champs envoyés sont modifiés.
   */
  @Patch('preferences')
  async updatePreferences(
    @Request() req: any,
    @Body()    dto: UpdatePreferencesDto,
  ) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.updatePreferences(actorType, actorId, dto);
  }

  // ─────────────────────────────────────────────────────────
  // TOKEN PUSH
  // ─────────────────────────────────────────────────────────

  /**
   * POST /notifications/push-token
   *
   * Enregistre ou met à jour un token push mobile (FCM/APNs).
   * Appelé par l'app mobile au démarrage.
   */
  @Post('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerPushToken(
    @Request() req: any,
    @Body()    dto: RegisterPushTokenDto,
  ): Promise<void> {
    const { actorType, actorId } = this.resolveActor(req);
    await this.service.registerPushToken(actorType, actorId, dto);
  }
}
