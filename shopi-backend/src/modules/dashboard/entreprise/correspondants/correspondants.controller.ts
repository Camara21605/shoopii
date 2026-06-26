/* ============================================================
 * FICHIER : src/modules/correspondants/correspondants.controller.ts
 *
 * RÔLE    : Controller UNIQUE pour toutes les routes correspondants.
 *           Délègue à CorrespondantsService et InvitationService.
 *
 * ─── ROUTES EXPOSÉES ─────────────────────────────────────────
 *
 *  DONNÉES ET STATS :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ GET  /correspondants/stats            → 4 KPI cards      │
 *  │ GET  /correspondants/zones            → barres couverture │
 *  │ GET  /correspondants/activite-recente → panneau latéral  │
 *  │ GET  /correspondants                  → grille / liste   │
 *  │ GET  /correspondants/:id              → ModalProfil      │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  ACTIONS :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ PATCH /correspondants/:id              → modifier profil │
 *  │ PATCH /correspondants/:id/suspendre    → ModalSuspendre  │
 *  │ PATCH /correspondants/:id/reactiver    → réactivation    │
 *  │ PATCH /correspondants/:id/valider      → pending → actif │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  INVITATIONS ET CONTACT :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ POST /correspondants/inviter          → ModalInviter     │
 *  │ POST /correspondants/:id/contacter    → ModalContacter   │
 *  └──────────────────────────────────────────────────────────┘
 *
 * ─── SÉCURITÉ ────────────────────────────────────────────────
 *
 *  Toutes les routes : JwtAuthGuard + RolesGuard
 *
 *  COMPANY    → ses propres correspondants seulement
 *  ADMIN      → tous les correspondants
 *  SUPER_ADMIN→ tous les correspondants
 *
 * ─── ORDRE DES ROUTES ────────────────────────────────────────
 *
 *  ⚠️ IMPORTANT : Les routes nommées (stats, zones, inviter…)
 *  DOIVENT être déclarées AVANT la route paramétrée /:id
 *  sinon Express interprète "stats" comme un UUID et répond 400.
 *
 * ============================================================ */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }  from 'src/common/guards/auth.guard';
import { RolesGuard }    from 'src/common/guards/roles.guard';
import { Roles }         from 'src/common/decorators/roles.decorator';
import { UserRole }      from 'src/common/enums/user-role.enum';

import { CorrespondantsService } from './services/correspondants.service';
import { InvitationService }     from './services/invitation.service';
import {
  FilterCorrespondantsDto,
  UpdateCorrespondantDto,
  InviterCorrespondantDto,
  ContacterCorrespondantDto,
  SuspendreDto,
} from './dto/correspondant.dto';

@Controller('correspondants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CorrespondantsController {

  constructor(
    private readonly correspondantsService: CorrespondantsService,
    private readonly invitationService:     InvitationService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // STATS — GET /correspondants/stats
  //
  // ⚠️ Déclarée AVANT /:id pour éviter le conflit de routing.
  //
  // Retourne les 4 KPI cards de CorrespondantsPage.tsx :
  //   { total, actifs, thisMonth, villes, enAttente }
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Get('stats')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getStats(@Req() req: any) {
    return this.correspondantsService.getStats(req.user);
  }

  // ════════════════════════════════════════════════════════════
  // ZONES — GET /correspondants/zones
  //
  // Retourne les barres de progression "Couverture par zone"
  // du panneau latéral de CorrespondantsPage.tsx.
  //
  // Ex: [{ zone: "Conakry Centre", orders: 42, pct: 52, color: "var(--blue)" }]
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Get('zones')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getZones(@Req() req: any) {
    return this.correspondantsService.getZoneStats(req.user);
  }

  // ════════════════════════════════════════════════════════════
  // ACTIVITÉ RÉCENTE — GET /correspondants/activite-recente
  //
  // Retourne les 5 correspondants les plus récemment actifs.
  // Alimente le panneau latéral "Activité récente".
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Get('activite-recente')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getActiviteRecente(@Req() req: any) {
    return this.correspondantsService.getRecentActivity(req.user);
  }

  // ════════════════════════════════════════════════════════════
  // INVITER — POST /correspondants/inviter
  //
  // ⚠️ Déclarée AVANT /:id pour éviter le conflit de routing.
  //
  // Génère un code d'invitation format XXXX-XXX-XXX
  // et envoie l'email au futur correspondant.
  //
  // Correspond au bouton "Envoyer l'invitation" dans
  // l'étape 2 de ModalInviter dans CorrespondantsPage.tsx.
  //
  // Corps : InviterCorrespondantDto
  //   { fullName, email, type, ville?, quartier?, message? }
  //
  // Retourne : { code, email, fullName, expiresAt, codeId }
  //   → affiché dans l'étape 3 de ModalInviter pour copier le code
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Post('inviter')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY, UserRole.DELIVERY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async inviter(
    @Body() dto: InviterCorrespondantDto,
    @Req()  req: any,
  ) {
    return this.invitationService.inviter(dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // LIST — GET /correspondants
  //
  // Liste tous les correspondants avec filtres optionnels.
  // Alimente la grille (vue grille) et le tableau (vue liste)
  // de CorrespondantsPage.tsx.
  //
  // Query params :
  //   ?type=relais      → filtre type (boutons toolbar)
  //   ?status=active    → filtre statut (dropdown)
  //   ?search=kaloum    → recherche nom/ville/email
  //   ?page=1&limit=20  → pagination
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Get()
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(
    @Query() dto: FilterCorrespondantsDto,
    @Req()   req: any,
  ) {
    return this.correspondantsService.findAll(dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // GET ONE — GET /correspondants/:id
  //
  // Retourne le profil complet d'un correspondant.
  // Alimente ModalProfil (KPIs, note, infos détaillées).
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Get(':id')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.correspondantsService.findOne(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // UPDATE — PATCH /correspondants/:id
  //
  // Modifie les informations du correspondant.
  // (fullName, phone, zone, address, type)
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Patch(':id')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: UpdateCorrespondantDto,
    @Req()                      req: any,
  ) {
    return this.correspondantsService.update(id, dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // SUSPENDRE — PATCH /correspondants/:id/suspendre
  //
  // Passe le status → SUSPENDED.
  // Correspond au bouton "Confirmer" de ModalSuspendre.
  //
  // Corps optionnel : { raison?: string }
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Patch(':id/suspendre')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async suspendre(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: SuspendreDto,
    @Req()                      req: any,
  ) {
    return this.correspondantsService.suspendre(id, req.user, dto.raison);
  }

  // ════════════════════════════════════════════════════════════
  // RÉACTIVER — PATCH /correspondants/:id/reactiver
  //
  // Passe le status SUSPENDED → ACTIVE.
  // Accessible depuis le dashboard admin.
  //
  // Rôles : ADMIN, SUPER_ADMIN (entreprise peut aussi réactiver)
  // ════════════════════════════════════════════════════════════

  @Patch(':id/reactiver')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async reactiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.correspondantsService.reactiver(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // VALIDER — PATCH /correspondants/:id/valider
  //
  // Passe le status PENDING → ACTIVE.
  // Correspond au bouton "Valider les en attente" (action rapide).
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Patch(':id/valider')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async valider(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.correspondantsService.valider(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // CONTACTER — POST /correspondants/:id/contacter
  //
  // Envoie un email au correspondant.
  // Correspond au bouton "Envoyer" de ModalContacter.
  //
  // Corps : { sujet, message }
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════════

  @Post(':id/contacter')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async contacter(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: ContacterCorrespondantDto,
    @Req()                      req: any,
  ) {
    return this.invitationService.contacter(id, dto, req.user);
  }
}