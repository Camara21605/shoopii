// ============================================================
// FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.controller.ts
// RÔLE     : Endpoints du dashboard entreprise — toutes les
//            données renvoyées sont scopées à CETTE entreprise
//            (req.user.id), jamais aux autres boutiques.
//
// ROUTES :
//   GET  /dashboard/entreprise/overview        → KPIs, CA, top produits, alertes
//   GET  /dashboard/entreprise/analytics       → CA, top produits, perf catégories
//   GET  /dashboard/entreprise/finances        → solde, transactions, virements
//   GET  /dashboard/entreprise/commission-rate → taux de commission plateforme
// ============================================================

import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
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
import { Company, CompanyPlan } from '../../../database/entities/profiles/entreprise-profile.entity';
import { CompanySetting }    from '../../company-settings/company-settings.entity';
import { CommissionCalculatorService } from '../../commission/services/commission-calculator.service';
import { EntrepriseDashboardService } from './entreprise-dashboard.service';
import { TeamPermissionGuard }        from '../../company-team/guards/team-permission.guard';
import { RequiresTeamPermission }     from '../../company-team/decorators/requires-team-permission.decorator';

@ApiTags('Dashboard Entreprise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise')
export class EntrepriseDashboardController {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly platformSettingsRepo: Repository<PlatformSettings>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(CompanySetting)
    private readonly companySettingRepo: Repository<CompanySetting>,

    private readonly commissionCalculator: CommissionCalculatorService,
    private readonly dashboardService: EntrepriseDashboardService,
  ) {}

  /** Vue d'ensemble : KPIs, CA mensuel, top produits, alertes stock, activité */
  @ApiOperation({ summary: "Vue d'ensemble réelle du dashboard entreprise" })
  @ApiResponse({ status: 200, description: 'Aperçu retourné avec succès' })
  @Get('overview')
  async getOverview(@Request() req: any) {
    /* actorId (pas req.user.id) — déjà résolu au login vers le bon
     * Company.id pour le propriétaire COMME pour un collaborateur (voir
     * AuthService.findProfileId). Avec req.user.id, cette page restait
     * toujours vide pour tout collaborateur (resolveCompany() cherchait
     * Company.userId = req.user.id, qui n'existe que pour le propriétaire). */
    return this.dashboardService.getOverview(req.user.actorId);
  }

  /** Analytics : CA, top produits, performances par catégorie (données réelles uniquement) —
   *  groupe de permissions Statistiques : un collaborateur sans statistics.view reçoit un
   *  403 plutôt que d'accéder aux données de performance de la boutique. */
  @ApiOperation({ summary: 'Analytics réelles du dashboard entreprise' })
  @ApiResponse({ status: 200, description: 'Analytics retournées avec succès' })
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('statistics', 'view')
  @Get('analytics')
  async getAnalytics(@Request() req: any) {
    return this.dashboardService.getAnalytics(req.user.actorId);
  }

  /** Finances : solde wallet, revenus/dépenses, transactions, virements —
   *  première catégorie de permissions réellement appliquée (Paiements +
   *  Portefeuille) : un collaborateur sans payments.view reçoit un 403
   *  plutôt que d'accéder aux données financières de la boutique quelles
   *  que soient ses permissions configurées (voir TeamPermissionGuard). */
  @ApiOperation({ summary: 'Finances réelles du dashboard entreprise' })
  @ApiResponse({ status: 200, description: 'Finances retournées avec succès' })
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('payments', 'view')
  @Get('finances')
  async getFinances(@Request() req: any) {
    return this.dashboardService.getFinances(req.user.actorId);
  }

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/commission-rate?montant=<prix>
  // Retourne le taux/montant de commission EFFECTIF de cette entreprise.
  // Utilisé par AjouterPage et ProduitsPage pour l'aperçu du revenu net.
  //
  // BUG CORRIGÉ — lisait `PlatformSettings.platformCommission`, une
  // colonne volontairement exclue du mécanisme CommissionRule (voir
  // PlatformSettingsService.COMMISSION_FIELDS) et donc susceptible de
  // diverger du taux réellement appliqué par le CommissionEngine à la
  // confirmation du paiement (`tauxCommissionProduit`), et ignorait à la
  // fois le plan de la boutique ET un éventuel override CompanySetting
  // (fixe/progressif) du Centre de Gestion des Commissions — deux boutiques
  // avec des configurations différentes voyaient le même aperçu.
  //
  // Appelle désormais resoudreCommissionProduit() — LA MÊME fonction pure
  // utilisée par le CommissionEngine à la confirmation du paiement — pour
  // qu'un aperçu ne puisse plus diverger du montant réellement prélevé.
  // ──────────────────────────────────────────────────────────
  @Get('commission-rate')
  async getCommissionRate(@Request() req: any, @Query('montant') montantQuery?: string) {
    let settings = await this.platformSettingsRepo.findOne({ where: { id: 1 } });

    /* Initialise la ligne avec les valeurs par défaut si elle n'existe pas encore */
    if (!settings) {
      settings = this.platformSettingsRepo.create({ id: 1 });
      settings = await this.platformSettingsRepo.save(settings);
    }

    const [company, companySettings] = await Promise.all([
      this.companyRepo.findOne({ where: { id: req.user.actorId }, select: ['plan'] }),
      this.companySettingRepo.findOne({ where: { id: 1 } }),
    ]);

    const base = Number(settings.tauxCommissionProduit ?? 6) / 100;
    const multPro  = Number(settings.planMultiplierPro     ?? 0.75);
    const multPrem = Number(settings.planMultiplierPremium ?? 0.5);
    const planMultiplier = {
      [CompanyPlan.STANDARD]: 1,
      [CompanyPlan.PRO]:      multPro,
      [CompanyPlan.PREMIUM]:  multPrem,
    }[company?.plan ?? CompanyPlan.STANDARD];

    /* Un montant précis (prix du produit en cours de création) permet de
     * résoudre EXACTEMENT le mode 'fixed'/'progressive' de CompanySetting —
     * sans montant, ces deux modes ne peuvent pas être représentés par un
     * taux unique valable pour n'importe quel prix, donc on retombe sur le
     * taux de base × plan (comportement précédent, correct en mode
     * 'percentage' ou en l'absence de CompanySetting, qui est le cas le
     * plus courant). */
    const montant = montantQuery != null ? Number(montantQuery) : undefined;
    if (montant != null && Number.isFinite(montant) && montant > 0) {
      const { commissionProduitBrute, tauxEffectifProduit } = this.commissionCalculator.resoudreCommissionProduit(
        montant, base, planMultiplier, companySettings ?? null,
      );
      return {
        percentage:       tauxEffectifProduit * 100,
        rate:             tauxEffectifProduit,
        commissionAmount: commissionProduitBrute,
        revenuNet:        montant - commissionProduitBrute,
      };
    }

    const rate       = base * planMultiplier;
    const percentage = rate * 100;

    return {
      percentage, // ex: 4.5 (affiché en %)
      rate,       // ex: 0.045 (utilisé pour les calculs)
    };
  }
}
