/* ============================================================
 * FICHIER : correspondant-parametres.controller.ts
 *
 * Controller unique qui orchestre les 11 services des paramètres.
 * Chaque service gère exactement 1 section des paramètres.
 *
 * Base URL : /api/correspondant/parametres
 *
 * Endpoints :
 *   GET    /                          → ProfilService.getParametres()
 *   PATCH  /profil                    → ProfilService.updateProfil()
 *   POST   /profil/photo              → ProfilService.uploadPhoto()
 *   PATCH  /depot                     → DepotService.updateDepot()
 *   PATCH  /zone                      → ZoneService.updateZone()
 *   PUT    /zone/horaires             → ZoneService.updateHoraires()
 *   GET    /entites/codes             → EntitesService.getCodes()
 *   POST   /entites/codes/:type       → EntitesService.regenererCode()
 *   PATCH  /entites                   → EntitesService.updateEntites()
 *   PATCH  /colis                     → ColisService.updateColis()
 *   PATCH  /paiement                  → PaiementService.updatePaiement()
 *   GET    /documents                 → DocumentsService.getDocuments()
 *   POST   /documents/:type           → DocumentsService.uploadDocument()
 *   DELETE /documents/:type           → DocumentsService.deleteDocument()
 *   POST   /documents/photos-depot    → DocumentsService.uploadPhotosDepot()
 *   PATCH  /securite                  → SecuriteService.updateSecurite()
 *   POST   /securite/password         → SecuriteService.changePassword()
 *   PATCH  /notifications             → NotificationsService.updateNotifications()
 *   PATCH  /confidentialite           → ConfidentialiteService.updateConfidentialite()
 *   POST   /danger/suspendre          → DangerService.suspendreCompte()
 *   POST   /danger/desactiver         → DangerService.desactiverCompte()
 *   DELETE /danger/supprimer          → DangerService.supprimerCompte()
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Put, Delete,
  Param, Body, Req, UseGuards,
  UseInterceptors, UploadedFile, UploadedFiles,
  HttpCode, HttpStatus, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { JwtAuthGuard }  from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles }      from '../../../common/decorators/roles.decorator';
import { UserRole }   from '../../../common/enums/user-role.enum';

/* ── Import des 11 services ── */
import { ProfilService }          from './services/profil.service';
import { DepotService }           from './services/depot.service';
import { ZoneService }            from './services/zone.service';
import { EntitesService }         from './services/entites.service';
import { ColisService }           from './services/colis.service';
import { PaiementService }        from './services/paiement.service';
import { DocumentsService }       from './services/documents.service';
import { SecuriteService }        from './services/securite.service';
import { NotificationsService }   from './services/notifications.service';
import { ConfidentialiteService } from './services/confidentialite.service';
import { DangerService }          from './services/danger.service';

/* ── Import des DTOs ── */
import {
  UpdateProfilDto,
  UpdateDepotDto,
  UpdateZoneDto,
  UpdateHorairesDto,
  UpdateEntitesDto,
  UpdateColisDto,
  UpdatePaiementDto,
  UpdateSecuriteDto,
  ChangePasswordDto,
  UpdateNotificationsDto,
  UpdateConfidentialiteDto,
} from './dto/correspondant-parametres.dto';

/* ── Validateurs de fichiers ── */

/** Images (photo de profil, photos dépôt) — max 5 MB */
const IMAGE_VALIDATORS = [
  new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
  new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
];

/** Documents officiels (images + PDF) — max 10 MB */
const DOC_VALIDATORS = [
  new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
  new FileTypeValidator({ fileType: /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/ }),
];

// ─────────────────────────────────────────────────────────────

@Controller('correspondant/parametres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRESPONDENT)
export class CorrespondantParametresController {

  constructor(
    /* ── 11 services injectés ── */
    private readonly profilService:          ProfilService,
    private readonly depotService:           DepotService,
    private readonly zoneService:            ZoneService,
    private readonly entitesService:         EntitesService,
    private readonly colisService:           ColisService,
    private readonly paiementService:        PaiementService,
    private readonly documentsService:       DocumentsService,
    private readonly securiteService:        SecuriteService,
    private readonly notificationsService:   NotificationsService,
    private readonly confidentialiteService: ConfidentialiteService,
    private readonly dangerService:          DangerService,
  ) {}

  /** Extrait userId depuis le token JWT décodé par AuthGuard */
  private uid(req: Request): string {
    return (req as any).user?.userId ?? (req as any).user?.id;
  }

  // ═══════════════════════════════════════════════════════════
  // GET GLOBAL — toutes les sections en une requête
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /correspondant/parametres
   * Retourne User + Correspondent + Horaires fusionnés.
   * Appelé au chargement de la page ParametresPage.tsx.
   */
  @Get()
  getParametres(@Req() req: Request) {
    return this.profilService.getParametres(this.uid(req));
  }

  // ═══════════════════════════════════════════════════════════
  // §1 — PROFIL & IDENTITÉ → ProfilService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/profil
   * firstName/lastName/email/phone → User
   * bio/langues/typeCorrespondant  → Correspondent
   */
  @Patch('profil')
  updateProfil(@Req() req: Request, @Body() dto: UpdateProfilDto) {
    return this.profilService.updateProfil(this.uid(req), dto);
  }

  /**
   * POST /correspondant/parametres/profil/photo
   * Upload → User.profilePicture (JPG/PNG/WebP — max 5 MB)
   */
  @Post('profil/photo')
  @UseInterceptors(FileInterceptor('photo'))
  uploadPhoto(
    @Req() req: Request,
    @UploadedFile(new ParseFilePipe({ validators: IMAGE_VALIDATORS }))
    file: Express.Multer.File,
  ) {
    return this.profilService.uploadPhoto(this.uid(req), file);
  }

  // ═══════════════════════════════════════════════════════════
  // §2 — POINT DE DÉPÔT → DepotService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/depot
   * Met à jour tous les champs depotXxx + depotAccessOptions.
   */
  @Patch('depot')
  updateDepot(@Req() req: Request, @Body() dto: UpdateDepotDto) {
    return this.depotService.updateDepot(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §3 — ZONE & HORAIRES → ZoneService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/zone
   * Met à jour zonesActives (JSON) et zoneAutoRules (JSON).
   */
  @Patch('zone')
  updateZone(@Req() req: Request, @Body() dto: UpdateZoneDto) {
    return this.zoneService.updateZone(this.uid(req), dto);
  }

  /**
   * PUT /correspondant/parametres/zone/horaires
   * Remplace entièrement le planning hebdomadaire (7 jours).
   * PUT (pas PATCH) car c'est un remplacement complet.
   */
  @Put('zone/horaires')
  updateHoraires(@Req() req: Request, @Body() dto: UpdateHorairesDto) {
    return this.zoneService.updateHoraires(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §4 — ENTITÉS PARTENAIRES → EntitesService
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /correspondant/parametres/entites/codes
   * Retourne les codes actuels avec usages et expiry.
   */
  @Get('entites/codes')
  getCodes(@Req() req: Request) {
    return this.entitesService.getCodes(this.uid(req));
  }

  /**
   * POST /correspondant/parametres/entites/codes/boutique
   * POST /correspondant/parametres/entites/codes/livreur
   * Régénère le code d'invitation pour le type spécifié.
   */
  @Post('entites/codes/:type')
  @HttpCode(HttpStatus.OK)
  regenererCode(
    @Req() req: Request,
    @Param('type') type: 'boutique' | 'livreur',
  ) {
    return this.entitesService.regenererCode(this.uid(req), type);
  }

  /**
   * PATCH /correspondant/parametres/entites
   * Met à jour colabSettings (JSON boolean map).
   */
  @Patch('entites')
  updateEntites(@Req() req: Request, @Body() dto: UpdateEntitesDto) {
    return this.entitesService.updateEntites(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §5 — GESTION DES COLIS → ColisService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/colis
   * Met à jour règles dépôt, types acceptés et règles incidents.
   */
  @Patch('colis')
  updateColis(@Req() req: Request, @Body() dto: UpdateColisDto) {
    return this.colisService.updateColis(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §6 — PAIEMENT → PaiementService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/paiement
   * Met à jour méthodes de paiement, fréquence et seuil virement.
   */
  @Patch('paiement')
  updatePaiement(@Req() req: Request, @Body() dto: UpdatePaiementDto) {
    return this.paiementService.updatePaiement(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §7 — DOCUMENTS → DocumentsService
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /correspondant/parametres/documents
   * Retourne le statut détaillé de chaque document.
   */
  @Get('documents')
  getDocuments(@Req() req: Request) {
    return this.documentsService.getDocuments(this.uid(req));
  }

  /**
   * POST /correspondant/parametres/documents/:type
   * type = cni | bail | assurance | casier | registre
   * Upload document officiel (images + PDF — max 10 MB).
   */
  @Post('documents/:type')
  @UseInterceptors(FileInterceptor('document'))
  uploadDocument(
    @Req() req: Request,
    @Param('type') type: string,
    @UploadedFile(new ParseFilePipe({ validators: DOC_VALIDATORS }))
    file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(this.uid(req), type as any, file);
  }

  /**
   * DELETE /correspondant/parametres/documents/:type
   * Supprime un document officiel (Cloudinary + champ en base).
   */
  @Delete('documents/:type')
  @HttpCode(HttpStatus.OK)
  deleteDocument(@Req() req: Request, @Param('type') type: string) {
    return this.documentsService.deleteDocument(this.uid(req), type as any);
  }

  /**
   * POST /correspondant/parametres/documents/photos-depot
   * Upload multiple de photos du dépôt (max 5 fichiers — 5 MB chacun).
   */
  @Post('documents/photos-depot')
  @UseInterceptors(FilesInterceptor('photos', 5))
  uploadPhotosDepot(@Req() req: Request, @UploadedFiles() files: Express.Multer.File[]) {
    return this.documentsService.uploadPhotosDepot(this.uid(req), files);
  }

  // ═══════════════════════════════════════════════════════════
  // §8 — SÉCURITÉ → SecuriteService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/securite
   * Active/désactive la 2FA et définit la méthode.
   */
  @Patch('securite')
  updateSecurite(@Req() req: Request, @Body() dto: UpdateSecuriteDto) {
    return this.securiteService.updateSecurite(this.uid(req), dto);
  }

  /**
   * POST /correspondant/parametres/securite/password
   * Vérifie l'ancien mot de passe (User.password) puis met à jour.
   */
  @Post('securite/password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.securiteService.changePassword(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §9 — NOTIFICATIONS → NotificationsService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/notifications
   * Remplace le JSON notifSettings complet.
   */
  @Patch('notifications')
  updateNotifications(@Req() req: Request, @Body() dto: UpdateNotificationsDto) {
    return this.notificationsService.updateNotifications(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §10 — CONFIDENTIALITÉ → ConfidentialiteService
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /correspondant/parametres/confidentialite
   * Remplace le JSON privacySettings complet.
   */
  @Patch('confidentialite')
  updateConfidentialite(@Req() req: Request, @Body() dto: UpdateConfidentialiteDto) {
    return this.confidentialiteService.updateConfidentialite(this.uid(req), dto);
  }

  // ═══════════════════════════════════════════════════════════
  // §11 — ZONE SENSIBLE → DangerService
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /correspondant/parametres/danger/suspendre
   * Suspend l'activité (status = SUSPENDED).
   */
  @Post('danger/suspendre')
  @HttpCode(HttpStatus.OK)
  suspendreCompte(@Req() req: Request) {
    return this.dangerService.suspendreCompte(this.uid(req));
  }

  /**
   * POST /correspondant/parametres/danger/desactiver
   * Désactive pour 30 jours (status = DISABLED).
   */
  @Post('danger/desactiver')
  @HttpCode(HttpStatus.OK)
  desactiverCompte(@Req() req: Request) {
    return this.dangerService.desactiverCompte(this.uid(req));
  }

  /**
   * DELETE /correspondant/parametres/danger/supprimer
   * Initie la suppression (status = DELETED, purge dans 30j).
   */
  @Delete('danger/supprimer')
  @HttpCode(HttpStatus.OK)
  supprimerCompte(@Req() req: Request) {
    return this.dangerService.supprimerCompte(this.uid(req));
  }
}