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
 *  GET    /client/parametres/adresses     → liste adresses
 *  POST   /client/parametres/adresses     → créer
 *  PATCH  /client/parametres/adresses/:id → modifier
 *  PATCH  /client/parametres/adresses/:id/default → défaut
 *  DELETE /client/parametres/adresses/:id → supprimer
 *
 *  GET    /client/parametres/paiement     → liste moyens
 *  POST   /client/parametres/paiement     → ajouter
 *  PATCH  /client/parametres/paiement/:id/default → défaut
 *  DELETE /client/parametres/paiement/:id → supprimer
 *
 *  GET    /client/parametres/points       → mes points
 *
 *  GET    /client/parametres/securite          → statut
 *  PATCH  /client/parametres/securite/password → mdp
 *  PATCH  /client/parametres/securite/2fa      → 2FA
 *  PATCH  /client/parametres/securite/questions → questions
 *  POST   /client/parametres/securite/codes-secours → génération
 *
 *  GET    /client/parametres/sessions           → sessions actives
 *  PATCH  /client/parametres/sessions/:id/revoquer → révoquer une
 *  PATCH  /client/parametres/sessions/revoquer-toutes
 *
 *  GET    /client/parametres/activite           → journal
 *  GET    /client/parametres/activite/export
 *
 *  GET    /client/parametres/approbations       → appareils confiance
 *  DELETE /client/parametres/approbations/:id
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
 *  POST   /client/parametres/donnees/export
 *  POST   /client/parametres/donnees/commandes
 *  POST   /client/parametres/donnees/factures
 *  GET    /client/parametres/donnees/rapport
 *  POST   /client/parametres/donnees/portabilite
 *
 *  PATCH  /client/parametres/danger/desactiver
 *  PATCH  /client/parametres/danger/revoquer
 *  PATCH  /client/parametres/danger/reinitialiser
 *  DELETE /client/parametres/danger/supprimer
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }         from '../../../common/guards/auth.guard';
import { RolesGuard }           from '../../../common/guards/roles.guard';
import { Roles, CurrentUser }   from '../../../common/decorators/roles.decorator';
import { User }                 from '../../../database/entities/user.entity';
import { UserRole }             from '../../../common/enums/user-role.enum';

/* Services */
import { ProfilService }     from './services/profil.service';
import { AdressesService,} from './services/adresses.service';
import {PaiementService }   from './services/paiement.service';
import { PointsService}      from './services/points.service';  
import {SecuriteService}    from './services/securite.service'; 
import {SessionsService}   from './services/sessions.service';
import {ActiviteService }   from './services/activite.service';
        
import {
  ApprobationsService,
  NotifsService,
  PrivacyService,
  ApparenceService,
  LangueService,
  DonneesService,
  DangerService,
} from './services/preferences.service';

/* DTOs */
import {
  UpdateProfilDto, UpdateCoordonneesDto,
  CreateAdresseDto, UpdateAdresseDto,
  AddPaiementDto,
  ChangePasswordDto, UpdateSecuriteDto, UpdateQuestionsDto,
  UpdateNotifsDto, UpdatePrivacyDto,
  UpdateApparenceDto, UpdateLangueDto,
} from './dto/client-parametres.dto';

@Controller('client/parametres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientParametresController {

  constructor(
    private readonly profilService:       ProfilService,
    private readonly adressesService:     AdressesService,
    private readonly paiementService:     PaiementService,
    private readonly pointsService:       PointsService,
    private readonly securiteService:     SecuriteService,
    private readonly sessionsService:     SessionsService,
    private readonly activiteService:     ActiviteService,
    private readonly approbationsService: ApprobationsService,
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
    const [profil, adresses, paiement, points, securite,
           notifs, privacy, apparence, langue] = await Promise.all([
      this.profilService.get(user),
      this.adressesService.getAll(user),
      this.paiementService.getAll(user),
      this.pointsService.get(user),
      this.securiteService.getStatut(user),
      this.notifsService.get(user),
      this.privacyService.get(user),
      this.apparenceService.get(user),
      this.langueService.get(user),
    ]);
    return { profil, adresses, paiement, points, securite, ...notifs, ...privacy, apparence, langue };
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

  /* ══════════════════════════════════════════════════════════
   * SECTION 2 — Adresses de livraison
   ══════════════════════════════════════════════════════════ */
  @Get('adresses')
  getAdresses(@CurrentUser() user: User) {
    return this.adressesService.getAll(user);
  }

  @Post('adresses')
  @HttpCode(HttpStatus.CREATED)
  createAdresse(@Body() dto: CreateAdresseDto, @CurrentUser() user: User) {
    return this.adressesService.create(user, dto);
  }

  @Patch('adresses/:id')
  updateAdresse(@Param('id') id: string, @Body() dto: UpdateAdresseDto, @CurrentUser() user: User) {
    return this.adressesService.update(user, id, dto);
  }

  @Patch('adresses/:id/default')
  @HttpCode(HttpStatus.OK)
  setDefaultAdresse(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adressesService.setDefault(user, id);
  }

  @Delete('adresses/:id')
  @HttpCode(HttpStatus.OK)
  deleteAdresse(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adressesService.remove(user, id);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 3 — Moyens de paiement
   ══════════════════════════════════════════════════════════ */
  @Get('paiement')
  getPaiement(@CurrentUser() user: User) {
    return this.paiementService.getAll(user);
  }

  @Post('paiement')
  @HttpCode(HttpStatus.CREATED)
  addPaiement(@Body() dto: AddPaiementDto, @CurrentUser() user: User) {
    return this.paiementService.add(user, dto);
  }

  @Patch('paiement/:id/default')
  @HttpCode(HttpStatus.OK)
  setDefaultPaiement(@Param('id') id: string, @CurrentUser() user: User) {
    return this.paiementService.setDefault(user, id);
  }

  @Delete('paiement/:id')
  @HttpCode(HttpStatus.OK)
  deletePaiement(@Param('id') id: string, @CurrentUser() user: User) {
    return this.paiementService.remove(user, id);
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

  @Patch('securite/questions')
  @HttpCode(HttpStatus.OK)
  updateQuestions(@Body() dto: UpdateQuestionsDto, @CurrentUser() user: User) {
    return this.securiteService.updateQuestions(user, dto);
  }

  @Post('securite/codes-secours')
  @HttpCode(HttpStatus.CREATED)
  genererCodesSecours(@CurrentUser() user: User) {
    return this.securiteService.genererCodesSecours(user);
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
  getActivite(@CurrentUser() user: User) {
    return this.activiteService.get(user);
  }

  @Get('activite/export')
  exportActivite(@CurrentUser() user: User) {
    return this.activiteService.export(user);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 8 — Appareils de confiance
   ══════════════════════════════════════════════════════════ */
  @Get('approbations')
  getApprobations(@CurrentUser() user: User) {
    return this.approbationsService.getAll(user);
  }

  @Delete('approbations/:id')
  @HttpCode(HttpStatus.OK)
  removeAppareil(@Param('id') id: string, @CurrentUser() user: User) {
    return this.approbationsService.remove(user, id);
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
  @Post('donnees/export')
  @HttpCode(HttpStatus.OK)
  exportDonnees(@CurrentUser() user: User) {
    return this.donneesService.exportAll(user);
  }

  @Post('donnees/commandes')
  @HttpCode(HttpStatus.OK)
  exportCommandes(@CurrentUser() user: User) {
    return this.donneesService.exportCommandes(user);
  }

  @Post('donnees/factures')
  @HttpCode(HttpStatus.OK)
  exportFactures(@CurrentUser() user: User) {
    return this.donneesService.exportFactures(user);
  }

  @Get('donnees/rapport')
  getRapportConfidentialite(@CurrentUser() user: User) {
    return this.donneesService.rapportConfidentialite(user);
  }

  @Post('donnees/portabilite')
  @HttpCode(HttpStatus.OK)
  demanderPortabilite(@CurrentUser() user: User) {
    return this.donneesService.demanderPortabilite(user);
  }

  /* ══════════════════════════════════════════════════════════
   * SECTION 14 — Zone de danger
   ══════════════════════════════════════════════════════════ */
  @Patch('danger/desactiver')
  @HttpCode(HttpStatus.OK)
  desactiver(@CurrentUser() user: User) {
    return this.dangerService.desactiverCompte(user);
  }

  @Patch('danger/revoquer')
  @HttpCode(HttpStatus.OK)
  revoquer(@CurrentUser() user: User) {
    return this.dangerService.revoquerAccesTiers(user);
  }

  @Patch('danger/reinitialiser')
  @HttpCode(HttpStatus.OK)
  reinitialiser(@CurrentUser() user: User) {
    return this.dangerService.reinitialiserPreferences(user);
  }

  @Delete('danger/supprimer')
  @HttpCode(HttpStatus.OK)
  supprimer(@CurrentUser() user: User) {
    return this.dangerService.supprimerCompte(user);
  }
}