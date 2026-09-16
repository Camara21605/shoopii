/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/avis/livreur-avis.controller.ts
 *
 * ROUTES :
 *   GET  /dashboard/livreur/avis              → liste paginée + stats
 *   POST /dashboard/livreur/avis/:id/reponse  → répondre à un avis
 *
 * SÉCURITÉ : JwtAuthGuard + RolesGuard (UserRole.DELIVERY uniquement)
 * ============================================================ */

import {
  Controller, Get, Post, Param, Body,
  UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { LivreurAvisService } from './livreur-avis.service';
import { RepondreAvisDto }    from './dto/repondre-avis.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY)
@Controller('dashboard/livreur/avis')
export class LivreurAvisController {

  constructor(private readonly avisService: LivreurAvisService) {}

  @Get()
  getAvis(@Req() req: any) {
    return this.avisService.getAvis(req.user.id);
  }

  @Post(':id/reponse')
  repondre(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) avisId: string,
    @Body() dto: RepondreAvisDto,
  ) {
    return this.avisService.repondre(req.user.id, avisId, dto.reponse);
  }
}
