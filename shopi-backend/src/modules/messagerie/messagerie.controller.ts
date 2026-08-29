/* ============================================================
 * FICHIER : messagerie.controller.ts
 *
 * Base URL : /api/messagerie
 * Auth     : JWT obligatoire (JwtAuthGuard)
 *
 * ENDPOINTS :
 *   GET    /conversations                         → liste (pagination cursor : ?cursor=&limit=)
 *   POST   /conversations                         → créer/récupérer
 *   GET    /conversations/:id/messages            → messages (pagination cursor : ?cursor=&limit= + replies)
 *   GET    /conversations/:id/messages/search?q=  → recherche plein texte dans la conversation
 *   POST   /conversations/:id/messages            → envoyer
 *   PATCH  /conversations/:id/read               → marquer lu
 *   PATCH  /conversations/:id/archive            → archiver
 *   PATCH  /conversations/:id/pin                → épingler / désépingler
 *   PATCH  /conversations/:id/mute               → couper / réactiver les notifications
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
  PinConversationDto,
  MuteConversationDto,
} from './dto/messagerie.dto';

@Controller('messagerie')
@UseGuards(JwtAuthGuard)
export class MessagerieController {

  constructor(private readonly svc: MessagerieService) {}

  private ctx(req: Request): { userId: string; actorId?: string; role: UserRole; ip: string } {
    const u  = (req as any).user;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress
            ?? 'unknown';
    return { userId: u.userId ?? u.id, actorId: u.actorId as string | undefined, role: u.role as UserRole, ip };
  }

  // ── Conversations ────────────────────────────────────────────

  @Get('conversations')
  getConversations(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.getConversations(userId, role, actorId, cursor, limit);
  }

  @Get('conversations/archived')
  getArchivedConversations(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.getArchivedConversations(userId, role, actorId, cursor, limit);
  }

  @Post('conversations')
  startConversation(@Req() req: Request, @Body() dto: StartConversationDto) {
    const { userId, actorId, role, ip } = this.ctx(req);
    return this.svc.getOrCreateConversation(userId, role, dto, ip, actorId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@Req() req: Request, @Param('id') convId: string): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.deleteConversation(userId, role, convId, actorId);
  }

  @Patch('conversations/:id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveConversation(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: ArchiveConversationDto,
  ): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.archiveConversation(userId, role, convId, dto, actorId);
  }

  @Patch('conversations/:id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  pinConversation(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: PinConversationDto,
  ): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.pinConversation(userId, role, convId, dto, actorId);
  }

  @Patch('conversations/:id/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  muteConversation(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: MuteConversationDto,
  ): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.muteConversation(userId, role, convId, dto, actorId);
  }

  // ── Messages ────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  getMessages(
    @Req() req: Request,
    @Param('id') convId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 30,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.getMessagesWithReplies(userId, role, convId, cursor, limit, actorId);
  }

  /* Recherche plein texte dans une conversation — texte des messages ET
   * noms de documents partagés. Alimente le bouton 🔍 du ChatHeader. */
  @Get('conversations/:id/messages/search')
  searchMessages(
    @Req() req: Request,
    @Param('id') convId: string,
    @Query('q') q = '',
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.searchMessages(userId, role, convId, q, actorId);
  }

  /* Liste des commandes partagées entre les deux participants de cette
   * conversation — alimente le picker "🛒 Partager une commande". */
  @Get('conversations/:id/commandes')
  getShareableCommandes(
    @Req() req: Request,
    @Param('id') convId: string,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.getShareableCommandes(userId, role, convId, actorId);
  }

  /* Catalogue public de la boutique participant à cette conversation —
   * alimente le picker "📦 Partager un produit". */
  @Get('conversations/:id/produits')
  getShareableProduits(
    @Req() req: Request,
    @Param('id') convId: string,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.getShareableProduits(userId, role, convId, actorId);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Req() req: Request,
    @Param('id') convId: string,
    @Body() dto: SendMessageDto,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.sendMessage(userId, role, convId, dto, actorId);
  }

  @Patch('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(@Req() req: Request, @Param('id') convId: string): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.markAsRead(userId, role, convId, actorId);
  }

  @Patch('conversations/:id/unread')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsUnread(@Req() req: Request, @Param('id') convId: string): Promise<void> {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.markAsUnread(userId, role, convId, actorId);
  }

  // ── Actions sur un message ──────────────────────────────────

  @Patch('messages/:msgId')
  editMessage(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: EditMessageDto,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.editMessage(userId, role, msgId, dto, actorId);
  }

  @Delete('messages/:msgId')
  @HttpCode(HttpStatus.OK)
  deleteMessage(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: DeleteMessageDto,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.deleteMessage(userId, role, msgId, dto, actorId);
  }

  @Post('messages/:msgId/reactions')
  @HttpCode(HttpStatus.OK)
  toggleReaction(
    @Req() req: Request,
    @Param('msgId') msgId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.toggleReaction(userId, role, msgId, dto, actorId);
  }

  // ── Recherche ────────────────────────────────────────────────

  @Get('users/search')
  searchUsers(
    @Req() req: Request,
    @Query('q')    q    = '',
    @Query('type') type?: string,
  ) {
    const { userId, actorId, role } = this.ctx(req);
    return this.svc.searchUsers(userId, role, q, type, actorId);
  }
}
