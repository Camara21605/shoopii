/* ============================================================
 * FICHIER : src/modules/messagerie/messagerie-push-actions.controller.ts
 *
 * ROUTES (publiques — c'est le jeton signé qui autorise) :
 *   POST /messagerie/push-reply  { token, text }  → répond depuis la notification
 *   POST /messagerie/push-read   { token }        → marque la conversation lue
 *
 * Boutons de la notification Android d'un message, utilisés SANS ouvrir
 * l'application : le téléphone n'a alors ni session ni jeton de connexion.
 * La seule preuve est le jeton signé reçu avec la notification
 * (push-action-token.util.ts) : une conversation, un destinataire, 3 jours,
 * texte seulement. Mêmes contrôles que l'envoi normal (accès à la
 * conversation, blocage…) puisqu'on passe par MessagerieService.
 * Réponse identique que le jeton soit faux ou expiré (rien à apprendre).
 * ============================================================ */

import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { verifyPushAction } from '../../common/utils/push-action-token.util';
import { MessageContentType } from 'src/database/entities/messaging/message.entity';
import { MessagerieService } from './messagerie.service';

class PushReadDto {
  @IsString()
  @MaxLength(1000)
  token: string;
}

class PushReplyDto extends PushReadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}

const ROLES = new Set<string>([UserRole.CLIENT, UserRole.COMPANY, UserRole.DELIVERY, UserRole.CORRESPONDENT]);

@Controller('messagerie')
export class MessageriePushActionsController {

  constructor(
    private readonly svc:    MessagerieService,
    private readonly config: ConfigService,
  ) {}

  private claims(token: string) {
    const c = verifyPushAction(token, this.config.get<string>('JWT_SECRET') ?? '');
    if (!c || !ROLES.has(c.t)) throw new ForbiddenException('Action expirée. Ouvrez l’application.');
    return c;
  }

  @Post('push-reply')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reply(@Body() dto: PushReplyDto): Promise<void> {
    const c = this.claims(dto.token);
    const text = dto.text.trim();
    if (!text) return;
    await this.svc.sendMessage(c.u, c.t as UserRole, c.c, { content: text, contentType: MessageContentType.TEXT }, c.i);
    // Répondre = avoir lu la conversation (comme sur WhatsApp).
    await this.svc.markAsRead(c.u, c.t as UserRole, c.c, c.i).catch(() => undefined);
  }

  @Post('push-read')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async read(@Body() dto: PushReadDto): Promise<void> {
    const c = this.claims(dto.token);
    await this.svc.markAsRead(c.u, c.t as UserRole, c.c, c.i);
  }
}
