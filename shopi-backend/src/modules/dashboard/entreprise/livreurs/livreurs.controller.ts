/* ============================================================
 * FICHIER : src/modules/livreurs/livreurs.controller.ts
 *
 * RÔLE    : Controller UNIQUE pour toutes les routes livreurs.
 *
 * ─── ROUTES EXPOSÉES (12 routes) ─────────────────────────────
 *
 *  ⚠️ Routes nommées AVANT /:id pour éviter les conflits Express
 *
 *  DONNÉES ET STATS :
 *  GET  /livreurs/stats              → 4 KPI cards
 *  GET  /livreurs/zones              → barres couverture
 *  GET  /livreurs/activite-recente   → panneau activité
 *  POST /livreurs/inviter            → ModalInviter étape 3
 *  GET  /livreurs                    → grille + liste
 *  GET  /livreurs/:id                → ModalProfil
 *
 *  ACTIONS :
 *  PATCH /livreurs/:id               → modifier profil
 *  PATCH /livreurs/:id/suspendre     → ModalSuspendre
 *  PATCH /livreurs/:id/reactiver     → réactivation
 *  PATCH /livreurs/:id/valider       → pending → actif
 *  POST  /livreurs/:id/contacter     → ModalContacter
 *
 * ─── SÉCURITÉ ────────────────────────────────────────────────
 *
 *  COMPANY    → ses propres livreurs uniquement
 *  ADMIN      → tous les livreurs
 *  SUPER_ADMIN→ tous les livreurs
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

import { LivreursService }          from './services/livreurs.service';
import { InvitationLivreurService } from './services/invitation-livreur.service';
import {
  FilterLivreursDto,
  UpdateLivreurDto,
  InviterLivreurDto,
  ContacterLivreurDto,
  SuspendreDto,
} from './dto/livreur.dto';

@Controller('livreurs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LivreursController {

  constructor(
    private readonly livreursService:     LivreursService,
    private readonly invitationService:   InvitationLivreurService,
  ) {}

  // ════════════════════════════════════════════════════════
  // STATS — GET /livreurs/stats
  // 4 KPI cards : actifs, disponibles, en course, livr. auj.
  // ════════════════════════════════════════════════════════

  @Get('stats')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getStats(@Req() req: any) {
    return this.livreursService.getStats(req.user);
  }

  // ════════════════════════════════════════════════════════
  // ZONES — GET /livreurs/zones
  // Barres "Couverture par zone" du panneau latéral
  // ════════════════════════════════════════════════════════

  @Get('zones')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getZones(@Req() req: any) {
    return this.livreursService.getZoneStats(req.user);
  }

  // ════════════════════════════════════════════════════════
  // ACTIVITÉ RÉCENTE — GET /livreurs/activite-recente
  // Panneau latéral "Activité récente"
  // ════════════════════════════════════════════════════════

  @Get('activite-recente')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getActiviteRecente(@Req() req: any) {
    return this.livreursService.getRecentActivity(req.user);
  }

  // ════════════════════════════════════════════════════════
  // INVITER — POST /livreurs/inviter
  //
  // ⚠️ Déclaré AVANT /:id pour éviter le conflit de routing.
  //
  // Génère un code XXXX-XXXX-XX + envoie l'email.
  // Retourne { code, email, fullName, expiresAt, codeId }
  // affiché dans l'étape 3 de ModalInviter.
  //
  // Rôles : COMPANY, ADMIN, SUPER_ADMIN
  // ════════════════════════════════════════════════════════

  @Post('inviter')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async inviter(
    @Body() dto: InviterLivreurDto,
    @Req()  req: any,
  ) {
    return this.invitationService.inviter(dto, req.user);
  }

  // ════════════════════════════════════════════════════════
  // LIST — GET /livreurs
  //
  // Alimente la grille et la liste de LivreursPage.tsx.
  //
  // Query params :
  //   ?availability=available    → filtre dispo (boutons toolbar)
  //   ?status=active             → filtre statut (select)
  //   ?search=mamadou            → recherche nom/zone/email
  //   ?page=1&limit=20
  // ════════════════════════════════════════════════════════

  @Get()
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(
    @Query() dto: FilterLivreursDto,
    @Req()   req: any,
  ) {
    return this.livreursService.findAll(dto, req.user);
  }

  // ════════════════════════════════════════════════════════
  // GET ONE — GET /livreurs/:id
  // Profil complet pour ModalProfil
  // ════════════════════════════════════════════════════════

  @Get(':id')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.livreursService.findOne(id, req.user);
  }

  // ════════════════════════════════════════════════════════
  // UPDATE — PATCH /livreurs/:id
  // Modification du profil (zone, vehicule, disponibilité…)
  // ════════════════════════════════════════════════════════

  @Patch(':id')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: UpdateLivreurDto,
    @Req()                      req: any,
  ) {
    return this.livreursService.update(id, dto, req.user);
  }

  // ════════════════════════════════════════════════════════
  // SUSPENDRE — PATCH /livreurs/:id/suspendre
  // Bouton "Confirmer" dans ModalSuspendre
  // ════════════════════════════════════════════════════════

  @Patch(':id/suspendre')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async suspendre(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: SuspendreDto,
    @Req()                      req: any,
  ) {
    return this.livreursService.suspendre(id, req.user, dto.raison);
  }

  // ════════════════════════════════════════════════════════
  // RÉACTIVER — PATCH /livreurs/:id/reactiver
  // ════════════════════════════════════════════════════════

  @Patch(':id/reactiver')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async reactiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.livreursService.reactiver(id, req.user);
  }

  // ════════════════════════════════════════════════════════
  // VALIDER — PATCH /livreurs/:id/valider
  // Bouton "Valider les en attente" dans les actions rapides
  // ════════════════════════════════════════════════════════

  @Patch(':id/valider')
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async valider(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.livreursService.valider(id, req.user);
  }

  // ════════════════════════════════════════════════════════
  // CONTACTER — POST /livreurs/:id/contacter
  // Bouton "Envoyer" dans ModalContacter
  // ════════════════════════════════════════════════════════

  @Post(':id/contacter')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async contacter(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: ContacterLivreurDto,
    @Req()                      req: any,
  ) {
    return this.invitationService.contacter(id, dto, req.user);
  }
}