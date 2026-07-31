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
    const user = req.user as User;
    return this.callService.startCall(user.id, dto);
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
    const page  = query.page  ? parseInt(query.page)  : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;
    return this.callService.getHistory(user.id, page, limit);
  }

  /** Utilisé par les pages de profil pour afficher un badge "En appel". */
  @Get('busy/:userId')
  async busy(@Param('userId') userId: string) {
    return { busy: await this.callService.isUserBusy(userId) };
  }

  /** Identifiants TURN/STUN pour RTCPeerConnection — la clé API Metered reste côté serveur. */
  @Get('ice-servers')
  async iceServers() {
    return { iceServers: await this.callService.getIceServers() };
  }
}
