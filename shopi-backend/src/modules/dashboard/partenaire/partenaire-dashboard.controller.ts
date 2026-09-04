/* ============================================================
 * FICHIER : partenaire-dashboard.controller.ts
 * RÔLE    : Routes dashboard partenaire — données réelles
 * ============================================================ */

import {
  Controller, Get, Post, Body, Param, Request,
  UseGuards, InternalServerErrorException, HttpException, Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';

import { JwtAuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard }   from '../../../common/guards/roles.guard';
import { Roles }        from '../../../common/decorators/roles.decorator';
import { UserRole }     from '../../../common/enums/user-role.enum';

import { PartenaireDashboardService } from './partenaire-dashboard.service';

/* BUG CORRIGÉ — aucun décorateur class-validator sur ce DTO : malgré le
 * ValidationPipe global (whitelist + forbidNonWhitelisted), ces deux champs
 * n'étaient jamais vérifiés en type/format. `type` invalide ou absent
 * retombait silencieusement sur 'ent' (COMPANY) dans
 * PartenaireDashboardService.generateCode() au lieu d'être rejeté — un
 * partenaire pouvait ainsi générer un code pour le mauvais type d'acteur
 * sans erreur explicite si le frontend envoyait une valeur inattendue. */
class GenerateCodeDto {
  @IsIn(['ent', 'lvr', 'cor', 'cli'])
  type!: string;

  @IsOptional()
  @IsEmail()
  targetEmail?: string;
}

class SubmitSignalementDto {
  cible!: string;
  type!: string;
  motif!: string;
  motifLabel!: string;
  gravite!: string;
  raison!: string;
}

@ApiTags('Dashboard — Partenaire')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('dashboard/partenaire')
export class PartenaireDashboardController {

  private readonly logger = new Logger(PartenaireDashboardController.name);

  constructor(private readonly svc: PartenaireDashboardService) {}

  @ApiOperation({ summary: 'Vue d\'ensemble partenaire' })
  @Get('overview')
  async getOverview(@Request() req: any) {
    try {
      return await this.svc.getOverview(req.user.id);
    } catch (err) {
      this.logger.error('getOverview failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur chargement overview');
    }
  }

  @ApiOperation({ summary: 'Liste des codes de création' })
  @Get('codes')
  async getCodes(@Request() req: any) {
    try {
      return await this.svc.getCodes(req.user.id);
    } catch (err) {
      this.logger.error('getCodes failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur chargement codes');
    }
  }

  @ApiOperation({ summary: 'Générer un nouveau code de création' })
  @Post('codes')
  async generateCode(@Request() req: any, @Body() dto: GenerateCodeDto) {
    try {
      return await this.svc.generateCode(req.user.id, dto);
    } catch (err) {
      this.logger.error('generateCode failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur génération code');
    }
  }

  @ApiOperation({ summary: 'Liste des acteurs recrutés' })
  @Get('acteurs')
  async getActeurs(@Request() req: any) {
    try {
      return await this.svc.getActeurs(req.user.id);
    } catch (err) {
      this.logger.error('getActeurs failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur chargement acteurs');
    }
  }

  /* Terminé — fiche détail derrière le bouton "Gérer" (ActeursPage.tsx).
   * BUG CORRIGÉ (pattern présent partout dans ce fichier) — err instanceof
   * HttpException doit être relancée telle quelle : sinon le 404 "Entreprise
   * introuvable" / 400 "type invalide" levés par le service se
   * transformaient systématiquement en 500 générique via le catch global. */
  @ApiOperation({ summary: "Fiche détail d'un acteur recruté" })
  @Get('acteurs/:type/:id')
  async getActeurDetail(@Request() req: any, @Param('type') type: string, @Param('id') id: string) {
    try {
      return await this.svc.getActeurDetail(req.user.id, type, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('getActeurDetail failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException("Erreur chargement de la fiche acteur");
    }
  }

  @ApiOperation({ summary: 'Commissions et solde' })
  @Get('commissions')
  async getCommissions(@Request() req: any) {
    try {
      return await this.svc.getCommissions(req.user.id);
    } catch (err) {
      this.logger.error('getCommissions failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur chargement commissions');
    }
  }

  @ApiOperation({ summary: 'Liste des signalements soumis' })
  @Get('signalements')
  async getSignalements(@Request() req: any) {
    try {
      return await this.svc.getSignalements(req.user.id);
    } catch (err) {
      this.logger.error('getSignalements failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur chargement signalements');
    }
  }

  @ApiOperation({ summary: 'Soumettre un signalement' })
  @Post('signalements')
  async submitSignalement(@Request() req: any, @Body() dto: SubmitSignalementDto) {
    try {
      return await this.svc.submitSignalement(req.user.id, dto);
    } catch (err) {
      this.logger.error('submitSignalement failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur soumission signalement');
    }
  }
}
