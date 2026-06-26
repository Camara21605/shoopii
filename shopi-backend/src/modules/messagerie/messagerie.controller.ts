/* ============================================================
 * FICHIER : src/modules/messagerie/messagerie.controller.ts
 *
 * Base URL : /api/messagerie
 * Auth     : JWT obligatoire (JwtAuthGuard)
 * ============================================================ */

import {
  Body, Controller, Get, Param, ParseIntPipe,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }     from '../../common/guards/auth.guard';
import { UserRole }         from '../../common/enums/user-role.enum';
import { MessagerieService } from './messagerie.service';
import { SendMessageDto, StartConversationDto } from './dto/messagerie.dto';

@Controller('messagerie')
@UseGuards(JwtAuthGuard)
export class MessagerieController {

  constructor(private readonly svc: MessagerieService) {}

  private ctx(req: Request): { userId: string; role: UserRole } {
    const u = (req as any).user;
    return { userId: u.userId ?? u.id, role: u.role as UserRole };
  }

  /* ── GET /messagerie/conversations ── */
  @Get('conversations')
  getConversations(@Req() req: Request) {
    const { userId, role } = this.ctx(req);
    return this.svc.getConversations(userId, role);
  }

  /* ── POST /messagerie/conversations ── */
  @Post('conversations')
  startConversation(@Req() req: Request, @Body() dto: StartConversationDto) {
    const { userId, role } = this.ctx(req);
    return this.svc.getOrCreateConversation(userId, role, dto);
  }

  /* ── GET /messagerie/conversations/:id/messages ── */
  @Get('conversations/:id/messages')
  getMessages(
    @Req() req: Request,
    @Param('id') convId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page  = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 30,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.getMessages(userId, role, convId, page, limit);
  }

  /* ── POST /messagerie/conversations/:id/messages ── */
  @Post('conversations/:id/messages')
  sendMessage(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: SendMessageDto,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.sendMessage(userId, role, convId, dto);
  }

  /* ── PATCH /messagerie/conversations/:id/read ── */
  @Patch('conversations/:id/read')
  markAsRead(@Req() req: Request, @Param('id') convId: string) {
    const { userId, role } = this.ctx(req);
    return this.svc.markAsRead(userId, role, convId);
  }

  /* ── GET /messagerie/users/search?q=&type= ── */
  @Get('users/search')
  searchUsers(
    @Req() req: Request,
    @Query('q')    q    = '',
    @Query('type') type?: string,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.searchUsers(userId, role, q, type);
  }
}
