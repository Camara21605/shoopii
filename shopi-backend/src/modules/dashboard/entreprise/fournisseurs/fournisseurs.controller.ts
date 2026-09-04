/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/fournisseurs/fournisseurs.controller.ts
 * RÔLE    : Endpoints de connexion à un fournisseur (entreprise
 *           Shopi vendant en gros) — recherche, connexion, liste,
 *           catalogue, déconnexion.
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { FournisseursService } from './fournisseurs.service';
import { ConnectSupplierDto }  from './dto/fournisseurs.dto';

import { JwtAuthGuard }       from 'src/common/guards/auth.guard';
import { RolesGuard }         from 'src/common/guards/roles.guard';
import { Roles, CurrentUser } from 'src/common/decorators/roles.decorator';
import { User }     from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { TeamPermissionGuard }    from 'src/modules/company-team/guards/team-permission.guard';
import { RequiresTeamPermission } from 'src/modules/company-team/decorators/requires-team-permission.decorator';

@ApiTags('🏭 Fournisseurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fournisseurs')
export class FournisseursController {

  constructor(private readonly fournisseursService: FournisseursService) {}

  // ── GET /fournisseurs/recherche ─────────────────────────────────
  // ⚠️ Déclarée avant les routes avec :id → 'recherche' ne doit pas être lu comme un UUID

  @Get('recherche')
  @Roles(UserRole.COMPANY)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('fournisseurs', 'view')
  @ApiOperation({ summary: 'Rechercher des entreprises Shopi vendant en gros, pour les connecter comme fournisseur' })
  @ApiQuery({ name: 'search', required: false })
  rechercher(
    @CurrentUser() user: User,
    @Query('search') search?: string,
  ) {
    return this.fournisseursService.rechercher(user, search);
  }

  // ── GET /fournisseurs ────────────────────────────────────────────

  @Get()
  @Roles(UserRole.COMPANY)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('fournisseurs', 'view')
  @ApiOperation({ summary: 'Liste des fournisseurs connectés' })
  mesFournisseurs(
    @CurrentUser() user: User,
  ) {
    return this.fournisseursService.mesFournisseurs(user);
  }

  // ── POST /fournisseurs ───────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('fournisseurs', 'connect')
  @ApiOperation({ summary: 'Connecter une entreprise Shopi comme fournisseur' })
  connecter(
    @CurrentUser() user: User,
    @Body() dto: ConnectSupplierDto,
  ) {
    return this.fournisseursService.connecter(user, dto.supplierCompanyId);
  }

  // ── GET /fournisseurs/:id/catalogue ──────────────────────────────

  @Get(':id/catalogue')
  @Roles(UserRole.COMPANY)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('fournisseurs', 'view')
  @ApiOperation({ summary: "Catalogue de vente en gros d'un fournisseur connecté" })
  @ApiParam({ name: 'id', description: "UUID de l'entreprise fournisseur" })
  catalogue(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fournisseursService.catalogue(user, id);
  }

  // ── DELETE /fournisseurs/:linkId ─────────────────────────────────

  @Delete(':linkId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('fournisseurs', 'disconnect')
  @ApiOperation({ summary: 'Déconnecter un fournisseur' })
  @ApiParam({ name: 'linkId', description: 'UUID de la connexion fournisseur' })
  deconnecter(
    @CurrentUser() user: User,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.fournisseursService.deconnecter(user, linkId);
  }
}
