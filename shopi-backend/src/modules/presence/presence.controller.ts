/* ============================================================
 * FICHIER : src/modules/presence/presence.controller.ts
 *
 * ROUTES
 *   POST /presence/device-ping   { token }        public — jeton signé du téléphone
 *   GET  /presence/device-credentials             connecté — jeton à confier au téléphone
 *   POST /presence/probe         { userIds[] }    connecté — état + vérification silencieuse
 *   GET  /presence/users?ids=a,b                  public — état (visiteurs)
 *   GET  /presence/actor/:type/:id                public — état du propriétaire d'un profil
 *                                                 (boutique, livreur, point relais, client) ;
 *                                                 connecté : + vérification silencieuse
 *
 * États : online (dans l'appli) · reachable (appli fermée, internet actif) ·
 * offline (pas de réseau). Voir PresenceDeviceService.
 * ============================================================ */

import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { PresenceDeviceService } from './presence-device.service';

class DevicePingDto {
  @IsString()
  @MaxLength(600)
  token: string;
}

class ProbeDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  userIds: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly svc: PresenceDeviceService) {}

  /** Toujours 204, jeton valide ou non : rien à apprendre en essayant. */
  @Post('device-ping')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async devicePing(@Body() dto: DevicePingDto): Promise<void> {
    await this.svc.devicePing(dto.token);
  }

  @Get('device-credentials')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  credentials(@Req() req: Request) {
    return this.svc.credentials((req.user as { id: string }).id);
  }

  @Post('probe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  probe(@Req() req: Request, @Body() dto: ProbeDto) {
    return this.svc.probe((req.user as { id: string }).id, dto.userIds);
  }

  @Get('users')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  users(@Query('ids') ids?: string) {
    const list = Array.from(new Set((ids ?? '').split(',').map(s => s.trim()).filter(s => UUID_RE.test(s)))).slice(0, 50);
    if (!list.length) throw new BadRequestException('Identifiants requis.');
    return this.svc.view(list);
  }

  @Get('actor/:type/:id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async actor(@Req() req: Request, @Param('type') type: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!['client', 'company', 'delivery', 'correspondent', 'partner'].includes(type)) throw new BadRequestException('Type de profil inconnu.');
    const viewer: { id?: string } | undefined = req.user;
    const me = viewer?.id ?? null;
    const v = await this.svc.actorView(type, id, me);
    if (!v) throw new NotFoundException('Profil introuvable.');
    return v;
  }
}
