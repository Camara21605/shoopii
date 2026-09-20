/* ============================================================
 * FICHIER : src/modules/call/call-push.controller.ts
 *
 * ROUTE : POST /calls/push-reject   { token }
 *
 * « Refuser » touché depuis la NOTIFICATION d'un appel entrant, application
 * fermée. Le service worker n'a ni session ni cookie : la seule preuve est le
 * jeton signé embarqué dans le push (voir CallPushService.signRejectToken),
 * lié à UN appel et UN destinataire, valable ~45 s.
 *
 * Route publique (pas de JWT) — c'est le jeton qui autorise. Sans cookie, le
 * middleware CSRF ne s'applique pas. Limitée en débit par IP.
 * ============================================================ */

import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';

import { Public } from '../../common/decorators/public.decorator';
import { CallGateway }     from './call.gateway';
import { CallPushService } from './call-push.service';

class PushRejectDto {
  @IsString()
  @MaxLength(600)
  token: string;
}

@Controller('calls')
export class CallPushController {

  constructor(
    private readonly callPush: CallPushService,
    private readonly gateway:  CallGateway,
  ) {}

  @Post('push-reject')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async pushReject(@Body() dto: PushRejectDto): Promise<void> {
    const proof = this.callPush.verifyRejectToken(dto.token);
    /* Réponse identique que le jeton soit faux, expiré ou l'appel déjà terminé :
     * on ne renseigne pas un tiers sur l'existence d'un appel. */
    if (!proof) return;
    await this.gateway.rejectFromPush(proof.calleeUserId, proof.callId);
  }
}
