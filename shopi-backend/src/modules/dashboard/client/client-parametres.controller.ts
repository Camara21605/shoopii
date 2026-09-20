/* ============================================================
 * src/modules/dashboard/client/client-parametres.controller.ts
 *
 * UN SEUL CONTROLLER — 14 sections paramètres client
 * Routes sous : /client/parametres
 *
 * ─── ROUTES ──────────────────────────────────────────────
 *  GET    /client/parametres              → tout en une fois
 *
 *  GET    /client/parametres/profil       → profil complet
 *  PATCH  /client/parametres/profil       → update profil
 *  PATCH  /client/parametres/profil/avatar → upload avatar URL
 *  PATCH  /client/parametres/coordonnees  → email / phone
 *
 *  (adresses et moyens de paiement : gérés par /location/addresses et /wallet/payment-methods)
 *
 *  GET    /client/parametres/points       → mes points
 *
 *  GET    /client/parametres/securite          → statut
 *  PATCH  /client/parametres/securite/password → mdp
 *  PATCH  /client/parametres/securite/2fa      → 2FA
 *  POST   /client/parametres/securite/codes-secours → génération
 *  GET    /client/parametres/securite/alertes   → préférences alertes sécurité
 *  PATCH  /client/parametres/securite/alertes   → une préférence (email uniquement)
 *
 *  GET    /client/parametres/sessions           → sessions actives
 *  PATCH  /client/parametres/sessions/:id/revoquer → révoquer une
 *  PATCH  /client/parametres/sessions/revoquer-toutes
 *
 *  GET    /client/parametres/activite           → journal
 *  GET    /client/parametres/activite/export
 *
 *  GET    /client/parametres/notifs             → préférences
 *  PATCH  /client/parametres/notifs
 *
 *  GET    /client/parametres/privacy            → confidentialité
 *  PATCH  /client/parametres/privacy
 *
 *  GET    /client/parametres/apparence
 *  PATCH  /client/parametres/apparence
 *
 *  GET    /client/parametres/langue
 *  PATCH  /client/parametres/langue
 *
 *  GET    /client/parametres/donnees/export?type=all|commandes|factures  → JSON à télécharger
 *  GET    /client/parametres/donnees/rapport
 *
 *  PATCH  /client/parametres/danger/desactiver   → { password } requis
 *  PATCH  /client/parametres/danger/reinitialiser
 *  DELETE /client/parametres/danger/supprimer     → { password } requis
 *
 *  (danger/revoquer retiré — "révoquer les accès tiers" n'existe pas
 *   comme fonctionnalité réelle, voir DangerService)
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';

import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard }         from '../../../common/guards/auth.guard';
import { RolesGuard }           from '../../../common/guards/roles.guard';
import { Roles, CurrentUser }   from '../../../common/decorators/roles.decorator';
import { User }                 from '../../../database/entities/user.entity';
import { UserRole }             from '../../../common/enums/user-role.enum';

/* Services */
import { ProfilService }     from './services/profil.service';
import { PointsService}      from './services/points.service';  
import {SecuriteService}    from './services/securite.service'; 
import {SessionsService}   from './services/sessions.service';
import {ActiviteService }   from './services/activite.service';
        
import {
  NotifsService,
  PrivacyService,
  ApparenceService,
  LangueService,
  DonneesService,
  DangerService,
} from './services/preferences.service';

/* DTOs */
import {
  UpdateProfilDto, UpdateCoordonneesDto, ConfirmEmailCodeDto,
  ChangePasswordDto, UpdateSecuriteDto,
  UpdateAlertSettingDto,
  UpdateNotifsDto, UpdatePrivacyDto,
  UpdateApparenceDto, UpdateLangueDto,
  DangerConfirmDto,
} from './dto/client-parametres.dto';

@Controller('client/parametres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientParametresController {

  constructor(
    private readonly profilService:       ProfilService,
    private readonly pointsService:       PointsService,
    private readonly securiteService:     SecuriteService,
    private readonly sessionsService:     SessionsService,
    private readonly activiteService:     ActiviteService,
    private readonly notifsService:       NotifsService,
    private readonly privacyService:      PrivacyService,
    private readonly apparenceService:    ApparenceService,
    private readonly langueService:       LangueService,
    private readonly donneesService:      DonneesService,
    private readonly dangerService:       DangerService,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * GET /client/parametres — tout en une fois
   ══════════════════════════════════════════════════════════ */
  @Get()
  async getAll(@CurrentUser() user: User) {
    const [profil, points, securite,
           notifs, privacy, apparence, langue] = await Promise.all([
      this.profilService.get(user),
      this.pointsService.get(user),
      this.securiteService.getStatut(user),
      this.notifsService.get(user),
      this.privacyService.get(user),
      this.apparenceService.get(user),
      this.langueService.get(user),
    ]);
    return { profil, points, securite, ...notifs, ...privacy, apparence, langue };
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 1 — Profil personnel & Coordonnées
   ══════════════════════════════════════════════════════════ */
  @Get('profil')
  getProfil(@CurrentUser() user: User) {
    return this.profilService.get(user);
  }

  @Patch('profil')
  updateProfil(@Body() dto: UpdateProfilDto, @CurrentUser() user: User) {
    return this.profilService.updateProfil(user, dto);
  }

  @Patch('profil/avatar')
  @HttpCode(HttpStatus.OK)
  updateAvatar(@Body('url') url: string, @CurrentUser() user: User) {
    return this.profilService.updateAvatar(user, url);
  }

  @Patch('coordonnees')
  updateCoordonnees(@Body() dto: UpdateCoordonneesDto, @CurrentUser() user: User) {
    return this.profilService.updateCoordonnees(user, dto);
  }

  /* Vérification de l'e-mail depuis les paramètres : envoi puis confirmation du code à 6 chiffres.
   * Limites de débit : 5 envois / 15 min (en plus du plafond métier de 3), 10 essais / 15 min. */
  @Post('coordonnees/email/code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  sendEmailCode(@CurrentUser() user: User) {
    return this.profilService.sendEmailCode(user);
  }

  @Post('coordonnees/email/verifier')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  confirmEmailCode(@Body() dto: ConfirmEmailCodeDto, @CurrentUser() user: User) {
    return this.profilService.confirmEmailCode(user, dto.code);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 4 — Points Shopi
   ══════════════════════════════════════════════════════════ */
  @Get('points')
  getPoints(@CurrentUser() user: User) {
    return this.pointsService.get(user);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 5 — Sécurité
   ══════════════════════════════════════════════════════════ */
  @Get('securite')
  getSecurite(@CurrentUser() user: User) {
    return this.securiteService.getStatut(user);
  }

  @Patch('securite/password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: User) {
    return this.securiteService.changePassword(user, dto);
  }

  @Patch('securite/2fa')
  @HttpCode(HttpStatus.OK)
  update2fa(@Body() dto: UpdateSecuriteDto, @CurrentUser() user: User) {
    return this.securiteService.update2fa(user, dto);
  }

  @Post('securite/codes-secours')
  @HttpCode(HttpStatus.CREATED)
  genererCodesSecours(@CurrentUser() user: User) {
    return this.securiteService.genererCodesSecours(user);
  }

  @Get('securite/alertes')
  getAlertSettings(@CurrentUser() user: User) {
    return this.securiteService.getAlertSettings(user);
  }

  @Patch('securite/alertes')
  @HttpCode(HttpStatus.OK)
  updateAlertSetting(@Body() dto: UpdateAlertSettingDto, @CurrentUser() user: User) {
    return this.securiteService.updateAlertSetting(user, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 6 — Sessions (appareils connectés)
   ══════════════════════════════════════════════════════════ */
  @Get('sessions')
  getSessions(@CurrentUser() user: User) {
    return this.sessionsService.getAll(user);
  }

  @Patch('sessions/:id/revoquer')
  @HttpCode(HttpStatus.OK)
  revoquerSession(@Param('id') id: string, @CurrentUser() user: User) {
    return this.sessionsService.revoquer(user, id);
  }

  @Patch('sessions/revoquer-toutes')
  @HttpCode(HttpStatus.OK)
  revoquerToutes(@CurrentUser() user: User) {
    return this.sessionsService.revoquerToutes(user);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 7 — Journal d'activité
   ══════════════════════════════════════════════════════════ */
  @Get('activite')
  getActivite(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.activiteService.get(user, Number(limit) || 50);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 9 — Notifications
   ══════════════════════════════════════════════════════════ */
  @Get('notifs')
  getNotifs(@CurrentUser() user: User) {
    return this.notifsService.get(user);
  }

  @Patch('notifs')
  updateNotifs(@Body() dto: UpdateNotifsDto, @CurrentUser() user: User) {
    return this.notifsService.update(user, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 10 — Confidentialité
   ══════════════════════════════════════════════════════════ */
  @Get('privacy')
  getPrivacy(@CurrentUser() user: User) {
    return this.privacyService.get(user);
  }

  @Patch('privacy')
  updatePrivacy(@Body() dto: UpdatePrivacyDto, @CurrentUser() user: User) {
    return this.privacyService.update(user, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 11 — Apparence
   ══════════════════════════════════════════════════════════ */
  @Get('apparence')
  getApparence(@CurrentUser() user: User) {
    return this.apparenceService.get(user);
  }

  @Patch('apparence')
  updateApparence(@Body() dto: UpdateApparenceDto, @CurrentUser() user: User) {
    return this.apparenceService.update(user, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 12 — Langue & région
   ══════════════════════════════════════════════════════════ */
  @Get('langue')
  getLangue(@CurrentUser() user: User) {
    return this.langueService.get(user);
  }

  @Patch('langue')
  updateLangue(@Body() dto: UpdateLangueDto, @CurrentUser() user: User) {
    return this.langueService.update(user, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 13 — Mes données (RGPD)
   ══════════════════════════════════════════════════════════ */
  /* Export RÉEL des données du client (JSON), généré à la demande : 5 par heure. */
  @Get('donnees/export')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  exportDonnees(@CurrentUser() user: User, @Query('type') type?: string) {
    return this.donneesService.exportData(user, type);
  }

  @Get('donnees/rapport')
  getRapportConfidentialite(@CurrentUser() user: User) {
    return this.donneesService.rapportConfidentialite(user);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 14 — Zone de danger
   ══════════════════════════════════════════════════════════ */
  @Patch('danger/desactiver')
  @HttpCode(HttpStatus.OK)
  desactiver(@Body() dto: DangerConfirmDto, @CurrentUser() user: User) {
    return this.dangerService.desactiverCompte(user, dto.password);
  }

  @Patch('danger/reinitialiser')
  @HttpCode(HttpStatus.OK)
  reinitialiser(@CurrentUser() user: User) {
    return this.dangerService.reinitialiserPreferences(user);
  }

  @Delete('danger/supprimer')
  @HttpCode(HttpStatus.OK)
  supprimer(@Body() dto: DangerConfirmDto, @CurrentUser() user: User) {
    return this.dangerService.supprimerCompte(user, dto.password);
  }
}