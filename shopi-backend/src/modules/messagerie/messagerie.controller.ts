/* ============================================================
 * FICHIER : messagerie.controller.ts
 *
 * Base URL : /api/messagerie
 * Auth     : JWT obligatoire (JwtAuthGuard)
 *
 * ENDPOINTS :
 *   GET    /conversations                         → liste
 *   POST   /conversations                         → créer/récupérer
 *   GET    /conversations/:id/messages            → messages (paginé + replies)
 *   POST   /conversations/:id/messages            → envoyer
 *   PATCH  /conversations/:id/read               → marquer lu
 *   PATCH  /conversations/:id/archive            → archiver
 *   PATCH  /messages/:msgId                      → modifier un message
 *   DELETE /messages/:msgId                      → supprimer un message
 *   POST   /messages/:msgId/reactions            → toggle réaction emoji
 *   GET    /users/search?q=&type=                → rechercher utilisateurs
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }      from '../../common/guards/auth.guard';
import { UserRole }          from '../../common/enums/user-role.enum';
import { MessagerieService } from './messagerie.service';
import {
  SendMessageDto,
  StartConversationDto,
  EditMessageDto,
  DeleteMessageDto,
  ToggleReactionDto,
  ArchiveConversationDto,
} from './dto/messagerie.dto';

@Controller('messagerie')
@UseGuards(JwtAuthGuard)
export class MessagerieController {

  constructor(private readonly svc: MessagerieService) {}

  private ctx(req: Request): { userId: string; role: UserRole; ip: string } {
    const u  = (req as any).user;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress
            ?? 'unknown';
    return { userId: u.userId ?? u.id, role: u.role as UserRole, ip };
  }

  // ── Conversations ────────────────────────────────────────────

  @Get('conversations')
  getConversations(@Req() req: Request) {
    const { userId, role } = this.ctx(req);
    return this.svc.getConversations(userId, role);
  }

  @Post('conversations')
  startConversation(@Req() req: Request, @Body() dto: StartConversationDto) {
    const { userId, role, ip } = this.ctx(req);
    return this.svc.getOrCreateConversation(userId, role, dto, ip);
  }

  @Patch('conversations/:id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveConversation(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: ArchiveConversationDto,
  ): Promise<void> {
    const { userId, role } = this.ctx(req);
    return this.svc.archiveConversation(userId, role, convId, dto);
  }

  // ── Messages ────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  getMessages(
    @Req() req: Request,
    @Param('id') convId: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page  = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 30,
  ) {
    const { userId, role } = this.ctx(req);
    /* Utilise la version enrichie avec les messages cités inclus */
    return this.svc.getMessagesWithReplies(userId, role, convId, page, limit);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: SendMessageDto,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.sendMessage(userId, role, convId, dto);
  }

  @Patch('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(@Req() req: Request, @Param('id') convId: string): Promise<void> {
    const { userId, role } = this.ctx(req);
    return this.svc.markAsRead(userId, role, convId);
  }

  // ── Actions sur un message ──────────────────────────────────

  /**
   * PATCH /messagerie/messages/:msgId
   * Modifie le contenu d'un message (texte uniquement, délai 24h).
   */
  @Patch('messages/:msgId')
  editMessage(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: EditMessageDto,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.editMessage(userId, role, msgId, dto);
  }

  /**
   * DELETE /messagerie/messages/:msgId
   * Supprime un message (pour soi ou pour tout le monde).
   */
  @Delete('messages/:msgId')
  @HttpCode(HttpStatus.OK)
  deleteMessage(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: DeleteMessageDto,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.deleteMessage(userId, role, msgId, dto);
  }

  /**
   * POST /messagerie/messages/:msgId/reactions
   * Ajoute ou retire une réaction emoji (toggle).
   */
  @Post('messages/:msgId/reactions')
  @HttpCode(HttpStatus.OK)
  toggleReaction(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    const { userId, role } = this.ctx(req);
    return this.svc.toggleReaction(userId, role, msgId, dto);
  }

  // ── Recherche ────────────────────────────────────────────────

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
