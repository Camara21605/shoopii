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
  Request, ForbiddenException, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard }            from 'src/common/guards/auth.guard';
import { NotificationService }     from './services/notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { UpdatePreferencesDto }    from './dto/update-preferences.dto';
import { RegisterPushTokenDto, RemovePushTokenDto } from './dto/register-push-token.dto';
import { WebPushService }          from './services/web-push.service';
import { MarkReadByTypesDto }      from './dto/mark-read-by-types.dto';
import { NotificationActorType }   from 'src/database/entities/notification/notification.entitiy';
import { ROLE_TO_ACTOR_TYPE }      from './utils/actor-type.util';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {

  constructor(
    private readonly service: NotificationService,
    private readonly webPush: WebPushService,
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
  // WEB PUSH — déclarées AVANT les routes `:id` (sinon `push-token`
  // serait pris pour un identifiant et rejeté par ParseUUIDPipe).
  // ─────────────────────────────────────────────────────────

  /**
   * GET /notifications/push/public-key
   * Clé VAPID PUBLIQUE nécessaire au navigateur pour s'abonner (non secrète).
   * `enabled: false` = push non configuré côté serveur : le client n'affiche
   * simplement pas l'option.
   */
  @Get('push/public-key')
  getPushPublicKey() {
    return { enabled: this.webPush.isEnabled(), publicKey: this.webPush.getPublicKey() };
  }

  /**
   * DELETE /notifications/push-token
   * Retire cet appareil du compte (déconnexion / notifications désactivées).
   */
  @Delete('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePushToken(
    @Request() req: any,
    @Body()    dto: RemovePushTokenDto,
  ): Promise<void> {
    const { actorType, actorId } = this.resolveActor(req);
    await this.service.removePushToken(actorType, actorId, { deviceId: dto.deviceId, token: dto.token });
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

  /**
   * GET /notifications/unread-by-type
   *
   * Compte les notifications non lues, groupées par NotificationType.
   * Alimente les badges "par onglet" des sidebars (dashboard entreprise,
   * etc.) — chaque dashboard mappe localement les types pertinents vers
   * ses propres onglets (voir sidebar-badges.ts côté frontend).
   */
  @Get('unread-by-type')
  async getUnreadCountByType(@Request() req: any) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.getUnreadCountByType(actorType, actorId);
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
   * PATCH /notifications/read-by-types
   *
   * Marque lues toutes les notifications non lues d'un ou plusieurs
   * NotificationType — utilisé quand l'utilisateur visite un onglet
   * précis de sa sidebar (voir NotificationService.markAsReadByTypes).
   *
   * ⚠️ Doit être AVANT /:id/read pour éviter le conflit de route.
   */
  @Patch('read-by-types')
  @HttpCode(HttpStatus.OK)
  async markAsReadByTypes(
    @Request() req: any,
    @Body()    dto: MarkReadByTypesDto,
  ) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.markAsReadByTypes(actorType, actorId, dto.types);
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

  /**
   * DELETE /notifications
   *
   * Supprime définitivement TOUTES les notifications de l'acteur connecté.
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteAllNotifications(@Request() req: any) {
    const { actorType, actorId } = this.resolveActor(req);
    return this.service.deleteAll(actorType, actorId);
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

    /* Appareils web : on ne stocke qu'un abonnement Web Push VALIDE, vers un
     * vrai service push de navigateur (liste blanche, https) — le serveur
     * enverra des requêtes vers cette adresse, elle ne doit jamais être
     * choisie librement par le client (SSRF). Le JSON est re-sérialisé pour
     * ne conserver que les champs attendus. */
    if (dto.platform === 'web') {
      const sub = this.webPush.parseSubscription(dto.token);
      if (!sub) throw new BadRequestException('Abonnement de notification invalide.');
      dto = { ...dto, token: JSON.stringify(sub) };
    }

    await this.service.registerPushToken(actorType, actorId, dto);
  }
}
