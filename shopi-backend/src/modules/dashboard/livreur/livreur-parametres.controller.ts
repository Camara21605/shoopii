/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-parametres.controller.ts
 *
 * ROUTE BASE : /dashboard/livreur/parametres
 * Toutes les routes sont protégées par AuthGuard (JWT).
 * L'userId est extrait automatiquement de req.user.id
 *
 * SECTIONS :
 *   1+2  Profil + Documents   → ProfilLivreurService
 *   3    Zones + Horaires     → ZoneLivreurService
 *   4    Vitesses             → VitessesLivreurService
 *   5    Véhicule             → VehiculeLivreurService
 *   6    Paiement             → PaiementLivreurService
 *   7    Sécurité             → SecuriteLivreurService
 *   8+9  Notifs + Privacy     → NotifsLivreurService
 *   10   Zone sensible        → DangerLivreurService
 * ============================================================ */

import {
  Controller, Get, Patch, Post, Delete,
  Body, Param, Req, UseGuards,
  UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }       from 'src/common/guards/auth.guard';

import { ProfilLivreurService }   from './services/profil-livreur.service';
import { ZoneLivreurService }     from './services/zone-livreur.service';
import { VitessesLivreurService } from './services/vitesses-livreur.service';
import { VehiculeLivreurService } from './services/vehicule-livreur.service';
import { PaiementLivreurService } from './services/paiement-livreur.service';
import { SecuriteLivreurService } from './services/securite-livreur.service';
import { NotifsLivreurService }   from './services/notifs-livreur.service';
import { DangerLivreurService }   from './services/danger-livreur.service';

import {
  UpdateLivreurProfilDto, UpdateZonesDto, UpdateHorairesLivreurDto,
  HoraireJourDto, UpdateVitessesDto, UpdateVehiculeDto,
  UpdatePaiementLivreurDto, UpdateLivreurPasswordDto, UpdateLivreurTwoFaDto,
  UpdateLivreurNotifsDto, UpdateLivreurPrivacyDto, LivreurDangerConfirmDto,
} from './dto/livreur-parametres.dto';
import { JourSemaine } from 'src/database/entities/livreur.table/livreur-horaire.entity';

const MB5  = 5  * 1024 * 1024;
const MB10 = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('dashboard/livreur/parametres')
export class LivreurParametresController {

  constructor(
    private readonly profilService:   ProfilLivreurService,
    private readonly zoneService:     ZoneLivreurService,
    private readonly vitessesService: VitessesLivreurService,
    private readonly vehiculeService: VehiculeLivreurService,
    private readonly paiementService: PaiementLivreurService,
    private readonly securiteService: SecuriteLivreurService,
    private readonly notifsService:   NotifsLivreurService,
    private readonly dangerService:   DangerLivreurService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * GET GLOBAL — toutes les données en 1 appel
   * ════════════════════════════════════════════════════════ */
  @Get()
  getAll(@Req() req: any) {
    return this.profilService.getParametres(req.user.id);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 1 — PROFIL PERSONNEL
   * ════════════════════════════════════════════════════════ */

  @Patch('profil')
  updateProfil(@Req() req: any, @Body() dto: UpdateLivreurProfilDto) {
    return this.profilService.updateProfil(req.user.id, dto);
  }

  /** Upload photo de profil : POST /parametres/photo (champ "file") */
  @Post('photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Req() req: any,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MB5 }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
      ],
    }))
    file: Express.Multer.File,
  ) {
    return this.profilService.uploadPhoto(req.user.id, file);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 2 — DOCUMENTS & VÉRIFICATION
   * ════════════════════════════════════════════════════════ */

  @Get('documents')
  getDocuments(@Req() req: any) {
    return this.profilService.getDocuments(req.user.id);
  }

  /**
   * Upload un document : POST /parametres/documents/cni
   * Types acceptés : cni | permis | assurance | casier
   */
  @Post('documents/:type')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: any,
    @Param('type') type: any,
    @UploadedFile(new ParseFilePipe({
      validators: [new MaxFileSizeValidator({ maxSize: MB10 })],
    }))
    file: Express.Multer.File,
  ) {
    return this.profilService.uploadDocument(req.user.id, type, file);
  }

  @Delete('documents/:type')
  deleteDocument(@Req() req: any, @Param('type') type: any) {
    return this.profilService.deleteDocument(req.user.id, type);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 3 — ZONES & HORAIRES
   * ════════════════════════════════════════════════════════ */

  @Patch('zone')
  updateZones(@Req() req: any, @Body() dto: UpdateZonesDto) {
    return this.zoneService.updateZones(req.user.id, dto);
  }

  @Get('horaires')
  getHoraires(@Req() req: any) {
    return this.zoneService.getHoraires(req.user.id);
  }

  @Patch('horaires')
  updateHoraires(@Req() req: any, @Body() dto: UpdateHorairesLivreurDto) {
    return this.zoneService.updateHoraires(req.user.id, dto);
  }

  /** Modifier un seul jour : PATCH /parametres/horaires/lundi */
  @Patch('horaires/:jour')
  updateJour(
    @Req() req: any,
    @Param('jour') jour: JourSemaine,
    @Body() dto: HoraireJourDto,
  ) {
    return this.zoneService.updateJour(req.user.id, jour, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 4 — VITESSES & TARIFICATION
   * ════════════════════════════════════════════════════════ */

  @Get('vitesses')
  getVitesses(@Req() req: any) {
    return this.vitessesService.getVitesses(req.user.id);
  }

  @Patch('vitesses')
  updateVitesses(@Req() req: any, @Body() dto: UpdateVitessesDto) {
    return this.vitessesService.updateVitesses(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 5 — VÉHICULE
   * ════════════════════════════════════════════════════════ */

  @Patch('vehicule')
  updateVehicule(@Req() req: any, @Body() dto: UpdateVehiculeDto) {
    return this.vehiculeService.updateVehicule(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 6 — PAIEMENT
   * ════════════════════════════════════════════════════════ */

  @Get('paiement')
  getPaiement(@Req() req: any) {
    return this.paiementService.getPaiement(req.user.id);
  }

  @Patch('paiement')
  updatePaiement(@Req() req: any, @Body() dto: UpdatePaiementLivreurDto) {
    return this.paiementService.updatePaiement(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 7 — SÉCURITÉ
   * ════════════════════════════════════════════════════════ */

  @Get('securite')
  getSecurite(@Req() req: any) {
    return this.securiteService.getSecurite(req.user.id);
  }

  @Patch('securite/password')
  updatePassword(@Req() req: any, @Body() dto: UpdateLivreurPasswordDto) {
    return this.securiteService.updatePassword(req.user.id, dto);
  }

  @Patch('securite/2fa')
  updateTwoFa(@Req() req: any, @Body() dto: UpdateLivreurTwoFaDto) {
    return this.securiteService.updateTwoFa(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 8 — NOTIFICATIONS
   * ════════════════════════════════════════════════════════ */

  @Get('notifications')
  getNotifs(@Req() req: any) {
    return this.notifsService.getNotifs(req.user.id);
  }

  @Patch('notifications')
  updateNotifs(@Req() req: any, @Body() dto: UpdateLivreurNotifsDto) {
    return this.notifsService.updateNotifs(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 9 — CONFIDENTIALITÉ
   * ════════════════════════════════════════════════════════ */

  @Get('confidentialite')
  getPrivacy(@Req() req: any) {
    return this.notifsService.getPrivacy(req.user.id);
  }

  @Patch('confidentialite')
  updatePrivacy(@Req() req: any, @Body() dto: UpdateLivreurPrivacyDto) {
    return this.notifsService.updatePrivacy(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 10 — ZONE SENSIBLE
   * ════════════════════════════════════════════════════════ */

  @Patch('danger/pause')
  pauseCompte(@Req() req: any, @Body() dto: LivreurDangerConfirmDto) {
    return this.dangerService.pauseCompte(req.user.id, dto);
  }

  @Patch('danger/desactiver')
  desactiverCompte(@Req() req: any, @Body() dto: LivreurDangerConfirmDto) {
    return this.dangerService.desactiverCompte(req.user.id, dto);
  }

  @Delete('danger/supprimer')
  supprimerCompte(@Req() req: any, @Body() dto: LivreurDangerConfirmDto) {
    return this.dangerService.supprimerCompte(req.user.id, dto);
  }
}