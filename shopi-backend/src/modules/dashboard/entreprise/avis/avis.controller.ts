/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/avis/avis.controller.ts
 *
 * ROUTES :
 *   GET  /dashboard/entreprise/avis              → liste paginée + stats
 *   POST /dashboard/entreprise/avis/:id/reponse  → répondre à un avis
 *
 * SÉCURITÉ : JwtAuthGuard + RolesGuard (UserRole.COMPANY uniquement)
 * ============================================================ */

import {
  Controller, Get, Post, Param, Body,
  UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { AvisService } from './avis.service';
import { RepondreAvisDto } from './dto/repondre-avis.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise/avis')
export class AvisController {

  constructor(private readonly avisService: AvisService) {}

  @Get()
  getAvis(@Req() req: any) {
    return this.avisService.getAvis(req.user.actorId ?? req.user.id);
  }

  @Post(':id/reponse')
  repondre(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) avisId: string,
    @Body() dto: RepondreAvisDto,
  ) {
    return this.avisService.repondre(req.user.actorId ?? req.user.id, avisId, dto.reponse);
  }
}
