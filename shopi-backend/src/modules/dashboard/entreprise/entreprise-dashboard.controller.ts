// ============================================================
// FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.controller.ts
// RÔLE     : Controller principal de l'espace entreprise.
//            Gère les routes de stats et d'aperçu général
//            de la boutique de l'entreprise connectée.
//
// ROUTES :
//   GET  /dashboard/entreprise/stats        → stats globales boutique
//   GET  /dashboard/entreprise/overview     → aperçu rapide (commandes, produits, revenus)
//   GET  /dashboard/entreprise/profil       → profil entreprise complet
//   PUT  /dashboard/entreprise/profil       → mise à jour du profil
//   GET  /dashboard/entreprise/notifications → notifications de l'entreprise
// ============================================================

import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard }      from '../../../common/guards/auth.guard';
import { RolesGuard }        from '../../../common/guards/roles.guard';
import { Roles }             from '../../../common/decorators/roles.decorator';
import { UserRole }          from '../../../common/enums/user-role.enum';
import { PlatformSettings }  from '../../../database/entities/platform-settings.entity';

@ApiTags('Dashboard Entreprise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise')
export class EntrepriseDashboardController {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly platformSettingsRepo: Repository<PlatformSettings>,
  ) {}

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/stats
  // Retourne les métriques clés de la boutique :
  //   - nombre de produits actifs
  //   - commandes du jour / du mois
  //   - revenu total / du mois
  //   - taux de livraison réussie
  // ──────────────────────────────────────────────────────────
//   @ApiOperation({ summary: 'Stats globales de la boutique entreprise' })
//   @ApiResponse({ status: 200, description: 'Métriques retournées avec succès' })
//   @Get('stats')
//   async getStats(@Request() req: any) {
//     return this.entrepriseService.getStats(req.user.id);
//   }

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/overview
  // Aperçu rapide pour la page d'accueil du dashboard :
  //   - dernières commandes (5)
  //   - produits en rupture de stock
  //   - revenu de la semaine (graphe)
  //   - alertes (commandes en attente, avis clients)
  // ──────────────────────────────────────────────────────────
//   @ApiOperation({ summary: 'Aperçu rapide du dashboard entreprise' })
//   @ApiResponse({ status: 200, description: 'Aperçu retourné avec succès' })
//   @Get('overview')
//   async getOverview(@Request() req: any) {
//     return this.entrepriseService.getOverview(req.user.id);
//   }

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/profil
  // Retourne le profil complet de l'entreprise connectée :
  //   - infos légales (nom, RCCM, NIF, adresse)
  //   - logo, bannière
  //   - abonnement actif
  // ──────────────────────────────────────────────────────────
//   @ApiOperation({ summary: 'Profil complet de l\'entreprise connectée' })
//   @ApiResponse({ status: 200, description: 'Profil retourné avec succès' })
//   @Get('profil')
//   async getProfil(@Request() req: any) {
//     return this.entrepriseService.getProfil(req.user.id);
//   }

//   // ──────────────────────────────────────────────────────────
//   // PUT /dashboard/entreprise/profil
//   // Met à jour les informations du profil entreprise
//   // ──────────────────────────────────────────────────────────
//   @ApiOperation({ summary: 'Mise à jour du profil entreprise' })
//   @ApiResponse({ status: 200, description: 'Profil mis à jour avec succès' })
//   @HttpCode(HttpStatus.OK)
//   @Put('profil')
//   async updateProfil(
//     @Request() req: any,
//     @Body() dto: UpdateEntrepriseProfilDto,
//   ) {
//     return this.entrepriseService.updateProfil(req.user.id, dto);
//   }

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/commission-rate
  // Retourne le taux de commission actuel de la plateforme.
  // Utilisé par AjouterPage pour l'aperçu du revenu net.
  // ──────────────────────────────────────────────────────────
  @Get('commission-rate')
  async getCommissionRate() {
    let settings = await this.platformSettingsRepo.findOne({ where: { id: 1 } });

    /* Initialise la ligne avec les valeurs par défaut si elle n'existe pas encore */
    if (!settings) {
      settings = this.platformSettingsRepo.create({ id: 1 });
      settings = await this.platformSettingsRepo.save(settings);
    }

    const percentage = Number(settings.platformCommission);
    return {
      percentage,             // ex: 6  (affiché en %)
      rate: percentage / 100, // ex: 0.06 (utilisé pour les calculs)
    };
  }
}