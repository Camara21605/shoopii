/* ============================================================
 * FICHIER  : src/modules/contact/controllers/contact.controller.ts
 * ROLE     : Routes HTTP du module Contact.
 *
 * ROUTES :
 *   POST /contact                   → soumettre un message (public, rate-limited)
 *   GET  /contact/admin             → liste admin avec pagination/filtre
 *   PATCH /contact/admin/:id/read   → marquer un message comme lu
 *   POST /contact/admin/:id/escalate→ convertir en ticket support
 *
 * SECURITE :
 *   - POST /contact : ThrottlerGuard (3 req / heure par IP)
 *   - Routes admin : JwtAuthGuard + RolesGuard (SUPER_ADMIN | ADMIN)
 *
 * DESIGN :
 *   - ContactService          → soumission, liste, markRead
 *   - ContactEscalationService → escalade Contact → Ticket
 *     Les deux injectés séparément (SRP — chaque service fait une chose).
 * ============================================================ */

import {
  Controller, Post, Get, Patch, Body, Query, Param, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard }             from '../../../common/guards/auth.guard';
import { RolesGuard }               from '../../../common/guards/roles.guard';
import { Roles }                    from '../../../common/decorators/roles.decorator';
import { UserRole }                 from '../../../common/enums/user-role.enum';

import { ContactService }           from '../services/contact.service';
import { ContactEscalationService } from '../services/contact-escalation.service';
import { CreateContactMessageDto }  from '../dto/contact.dto';

@Controller('contact')
export class ContactController {
  constructor(
    private readonly svc:         ContactService,
    private readonly escalateSvc: ContactEscalationService,
  ) {}

  /* ── Formulaire de contact public ───────────────────────────
   * Rate-limited : 3 soumissions maximum par heure par IP.
   * userId extrait du JWT si l'utilisateur est connecté.
   * ────────────────────────────────────────────────────────── */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  submit(@Req() req: any, @Body() dto: CreateContactMessageDto) {
    const userId = req.user?.id ?? null;
    const ip     = req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? null;
    return this.svc.submit(dto, userId, ip);
  }

  /* ── Liste admin ─────────────────────────────────────────── */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll(
    @Query('page',  new ParseIntPipe({ optional: true })) page?:  number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(page, limit, status);
  }

  /* ── Marquer comme lu ────────────────────────────────────── */
  @Patch('admin/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  markRead(@Param('id') id: string) {
    return this.svc.markRead(id);
  }

  /* ── Escalade Contact → Ticket support ──────────────────────
   * Idempotent : si déjà escaladé, renvoie le ticket existant.
   * Retourne : { ticketId: string, reference: string }
   * ────────────────────────────────────────────────────────── */
  @Post('admin/:id/escalate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  escalate(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    return this.escalateSvc.escalate(id, user.id, user.name ?? user.email ?? 'Agent');
  }
}
