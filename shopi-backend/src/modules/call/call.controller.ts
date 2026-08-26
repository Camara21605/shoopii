/* ============================================================
 * FICHIER : src/modules/call/call.controller.ts
 * ============================================================ */

import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CallService }  from './call.service';
import { StartCallDto, CallIdDto, CallHistoryQueryDto } from './dto/call.dto';
import type { User } from 'src/database/entities/user.entity';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallController {
  constructor(private readonly callService: CallService) {}

  @Post('start')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async start(@Req() req: Request, @Body() dto: StartCallDto) {
    const user = req.user as User & { actorId?: string };
    return this.callService.startCall(user.id, dto, user.actorId);
  }

  @Post('accept')
  async accept(@Req() req: Request, @Body() dto: CallIdDto) {
    const user = req.user as User;
    return this.callService.acceptCall(user.id, dto.callId);
  }

  @Post('reject')
  async reject(@Req() req: Request, @Body() dto: CallIdDto) {
    const user = req.user as User;
    await this.callService.rejectCall(user.id, dto.callId);
    return { success: true };
  }

  @Post('end')
  async end(@Req() req: Request, @Body() dto: CallIdDto) {
    const user = req.user as User;
    await this.callService.endCall(user.id, dto.callId);
    return { success: true };
  }

  @Get('history')
  async history(@Req() req: Request, @Query() query: CallHistoryQueryDto) {
    const user = req.user as User;
    // page/limit déjà des nombres validés/bornés par CallHistoryQueryDto (partie 9).
    return this.callService.getHistory(user.id, query.page ?? 1, query.limit ?? 20);
  }

  /**
   * Utilisé par les pages de profil pour afficher un badge "En appel".
   * assertCanCall (mêmes règles contact/follow/commande que pour appeler
   * réellement) évite qu'un utilisateur authentifié puisse sonder le statut
   * d'appel de n'importe qui d'autre sur la plateforme sans lien avec lui —
   * fuite d'info mineure mais réelle (harcèlement/surveillance facilités).
   */
  @Get('busy/:userId')
  async busy(@Req() req: Request, @Param('userId') userId: string) {
    const user = req.user as User & { actorId?: string };
    await this.callService.assertCanCall(user.id, userId, user.actorId);
    return { busy: await this.callService.isUserBusy(userId) };
  }

  /**
   * Identifiants TURN/STUN pour RTCPeerConnection — la clé/le secret Metered
   * restent côté serveur, jamais exposés au bundle frontend. Authentification
   * + statut de compte déjà vérifiés par JwtAuthGuard (JwtStrategy rejette
   * les comptes bannis/suspendus à CHAQUE requête, pas seulement au login).
   * Rate-limit dédié : cet endpoint peut être appelé plus souvent que
   * `start` (relance d'ICE côté client à chaque tentative de reprise réseau
   * — voir partie 5 — pour éviter d'utiliser des identifiants TURN périmés),
   * donc une limite plus généreuse mais toujours bornée.
   */
  @Get('ice-servers')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async iceServers() {
    return { iceServers: await this.callService.getIceServers() };
  }

  /**
   * PARTIE 5 — resynchronisation après reconnexion Socket.IO.
   *
   * Si la coupure réseau du socket dépasse le ping-timeout Socket.IO, le
   * serveur a déjà raccroché l'appel via CallGateway.handleDisconnect avant
   * même que le client ait fini sa propre reprise ICE côté WebRTC — sans ce
   * point de contrôle, le client restait bloqué en "Reconnexion…" jusqu'à
   * l'expiration de son délai local (20s), sans jamais savoir que le
   * serveur avait déjà tranché. Pas de vérification de permission
   * supplémentaire nécessaire : ne révèle qu'un appel impliquant
   * l'appelant lui-même (findActiveCallId filtre sur user.id).
   */
  @Get('active-with/:userId')
  async activeWith(@Req() req: Request, @Param('userId') userId: string) {
    const user = req.user as User;
    const callId = await this.callService.findActiveCallId(user.id, userId);
    return { callId };
  }
}
