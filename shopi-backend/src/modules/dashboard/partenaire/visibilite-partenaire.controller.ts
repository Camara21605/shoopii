/* ============================================================
 * FICHIER : visibilite-partenaire.controller.ts
 * RÔLE    : Ce que les autres voient du partenaire (voir VisibilitePartenaireService).
 *   GET /partenaire-recruteur              → entreprise, livreur, correspondant
 *   GET /dashboard/partenaire/classement   → partenaire
 * ============================================================ */

import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard }   from '../../../common/guards/roles.guard';
import { Roles }        from '../../../common/decorators/roles.decorator';
import { UserRole }     from '../../../common/enums/user-role.enum';

import { VisibilitePartenaireService } from './services/visibilite-partenaire.service';

@ApiTags('Partenaire recruteur')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY, UserRole.DELIVERY, UserRole.CORRESPONDENT)
@Controller('partenaire-recruteur')
export class PartenaireRecruteurController {
  constructor(private readonly svc: VisibilitePartenaireService) {}

  @ApiOperation({ summary: 'Partenaire qui a recruté l’acteur connecté (selon sa confidentialité)' })
  @Get()
  getPartenaireRecruteur(@Request() req: { user: { id: string; role: UserRole } }) {
    return this.svc.getPartenaireRecruteur(req.user.id, req.user.role);
  }
}

@ApiTags('Dashboard — Partenaire')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('dashboard/partenaire/classement')
export class PartenaireClassementController {
  constructor(private readonly svc: VisibilitePartenaireService) {}

  @ApiOperation({ summary: 'Classement des partenaires de la zone' })
  @Get()
  getClassement(@Request() req: { user: { id: string } }) {
    return this.svc.getClassement(req.user.id);
  }
}
