/* ============================================================
 * FICHIER : src/modules/notifications/notifications-admin.controller.ts
 *
 * RÔLE : API analytics notifications — réservée admin/super_admin.
 *
 * PRÉFIXE : /admin/notifications
 *
 * ENDPOINTS :
 *   GET /admin/notifications/stats?days=30        → KPIs globaux
 *   GET /admin/notifications/delivery-rates?days=30 → taux par canal
 *   GET /admin/notifications/dlq                  → état file morte
 *
 * SÉCURITÉ :
 *   JwtAuthGuard + vérification role inline.
 *   ForbiddenException si role ∉ {admin, super_admin}.
 * ============================================================ */

import {
  Controller, Get, Query, UseGuards,
  Request, ForbiddenException,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard }           from 'src/common/guards/auth.guard';
import { NotificationStatsService } from './services/notification-stats.service';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

@UseGuards(JwtAuthGuard)
@Controller('admin/notifications')
export class NotificationsAdminController {

  constructor(
    private readonly statsService: NotificationStatsService,
  ) {}

  // ── Guard rôle inline ─────────────────────────────────────

  private assertAdmin(req: { user: { role: string } }): void {
    if (!ADMIN_ROLES.has(req.user.role)) {
      throw new ForbiddenException('Accès réservé aux administrateurs.');
    }
  }

  // ─────────────────────────────────────────────────────────
  // GET /admin/notifications/stats
  // ─────────────────────────────────────────────────────────

  /**
   * KPIs globaux du système de notifications.
   *
   * @param days — Fenêtre glissante en jours (défaut: 30, max: 365)
   * @returns { period, totalCreated, totalUnread, unreadRate, byType[] }
   */
  @Get('stats')
  async getStats(
    @Request() req,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    this.assertAdmin(req);
    const clamped = Math.min(Math.max(days, 1), 365);
    return this.statsService.getGlobalStats(clamped);
  }

  // ─────────────────────────────────────────────────────────
  // GET /admin/notifications/delivery-rates
  // ─────────────────────────────────────────────────────────

  /**
   * Taux de livraison par canal (IN_APP, PUSH, EMAIL, SMS).
   *
   * @param days — Fenêtre glissante (défaut: 30)
   * @returns { period, overall, byChannel[] }
   */
  @Get('delivery-rates')
  async getDeliveryRates(
    @Request() req,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    this.assertAdmin(req);
    const clamped = Math.min(Math.max(days, 1), 365);
    return this.statsService.getDeliveryRates(clamped);
  }

  // ─────────────────────────────────────────────────────────
  // GET /admin/notifications/dlq
  // ─────────────────────────────────────────────────────────

  /**
   * État de la file morte (Dead Letter Queue).
   *
   * @returns { pendingRetries, permanentFailures, topErrors[] }
   */
  @Get('dlq')
  async getDlq(@Request() req) {
    this.assertAdmin(req);
    return this.statsService.getDlqStats();
  }
}
