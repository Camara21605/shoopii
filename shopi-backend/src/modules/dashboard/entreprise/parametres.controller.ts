/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/parametres.controller.ts
 *
 * RÔLE : Controller unique qui regroupe TOUS les endpoints
 *        des paramètres entreprise.
 *
 * ROUTE BASE : /dashboard/entreprise/parametres
 *
 * CHAQUE SECTION A SES ENDPOINTS PROPRES :
 *   Section 1+2  — GET/PATCH boutique, contact, logo, cover
 *   Section 3    — GET/PUT/PATCH horaires
 *   Section 4    — PATCH catalogue
 *   Section 5    — PATCH livraison
 *   Section 6    — PATCH paiement
 *   Section 7    — GET/PATCH commissions
 *   Section 8    — GET/POST/DELETE documents
 *   Section 9    — PATCH password, PATCH 2fa
 *   Section 10   — GET/PATCH notifications
 *   Section 11   — GET/PATCH confidentialite
 *   Section 12   — PATCH pause, desactiver, DELETE supprimer
 *
 * SÉCURITÉ : Toutes les routes nécessitent un JWT valide.
 * L'userId est extrait du token via @Req() req.user.id
 * ============================================================ */

import {
  Controller, Get, Patch, Post, Delete,
  Body, Param, UseGuards, Req,
  UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }      from 'src/common/guards/auth.guard';

/* ── Imports des 12 services ── */
import { BoutiqueParametresService }    from './services/boutique-parametres.service';
import { HorairesParametresService }    from './services/horaires-parametres.service';
import { CatalogueParametresService }   from './services/catalogue-parametres.service';
import { LivraisonParametresService }   from './services/livraison-parametres.service';
import { PaiementParametresService }    from './services/paiement-parametres.service';
import { CommissionsParametresService, UpdatePlanDto } from './services/commissions-parametres.service';
import { DocumentsParametresService }   from './services/documents-parametres.service';
import { SecuriteParametresService }    from './services/securite-parametres.service';
import { NotifsParametresService }      from './services/notifs-parametres.service';
import { PrivacyParametresService }     from './services/privacy-parametres.service';
import { DangerParametresService, DangerConfirmDto } from './services/danger-parametres.service';

/* ── Imports des DTOs ── */
import { UpdateBoutiqueDto, UpdateContactDto } from './dto/update-boutique.dto';
import { UpdateHorairesDto, HoraireJourDto }   from './dto/update-horaires.dto';
import { UpdateCatalogueDto }   from './dto/update-catalogue.dto';
import { UpdateLivraisonDto }   from './dto/update-livraison.dto';
import { UpdatePaiementDto }    from './dto/update-paiement.dto';
import { UpdateDocumentsDto }   from './dto/update-documents.dto';
import { UpdateTwoFaDto, UpdatePasswordDto } from './dto/update-securite.dto';
import { UpdateNotifsDto }      from './dto/update-notifs.dto';
import { UpdatePrivacyDto }     from './dto/update-privacy.dto';
import { JourSemaine }          from 'src/database/entities/entreprise.table/company-horaire.entity';

/* ── Limites upload ── */
const MAX_IMAGE_SIZE = 5  * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE   = 10 * 1024 * 1024; // 10 MB

@UseGuards(JwtAuthGuard)
@Controller('dashboard/entreprise/parametres')
export class ParametresController {

  constructor(
    private readonly boutiqueService:     BoutiqueParametresService,
    private readonly horairesService:     HorairesParametresService,
    private readonly catalogueService:    CatalogueParametresService,
    private readonly livraisonService:    LivraisonParametresService,
    private readonly paiementService:     PaiementParametresService,
    private readonly commissionsService:  CommissionsParametresService,
    private readonly documentsService:    DocumentsParametresService,
    private readonly securiteService:     SecuriteParametresService,
    private readonly notifsService:       NotifsParametresService,
    private readonly privacyService:      PrivacyParametresService,
    private readonly dangerService:       DangerParametresService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * SECTION 1+2 — BOUTIQUE & IDENTITÉ / CONTACT
   * ════════════════════════════════════════════════════════ */

  /** Charger toutes les données paramètres d'un coup */
  @Get()
  getAll(@Req() req: any) {
    return this.boutiqueService.getParametres(req.user.id);
  }

  /** Mettre à jour Boutique & Identité */
  @Patch('boutique')
  updateBoutique(@Req() req: any, @Body() dto: UpdateBoutiqueDto) {
    return this.boutiqueService.updateBoutique(req.user.id, dto);
  }

  /** Mettre à jour Contact & Localisation */
  @Patch('contact')
  updateContact(@Req() req: any, @Body() dto: UpdateContactDto) {
    return this.boutiqueService.updateContact(req.user.id, dto);
  }

  /** Uploader le logo (multipart/form-data, champ "file") */
  @Post('logo')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @Req() req: any,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
      ],
    }))
    file: Express.Multer.File,
  ) {
    return this.boutiqueService.uploadLogo(req.user.id, file);
  }

  /** Uploader l'image de couverture */
  @Post('cover')
  @UseInterceptors(FileInterceptor('file'))
  uploadCover(
    @Req() req: any,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
      ],
    }))
    file: Express.Multer.File,
  ) {
    return this.boutiqueService.uploadCover(req.user.id, file);
  }

  /** Supprimer le logo */
  @Delete('logo')
  deleteLogo(@Req() req: any) {
    return this.boutiqueService.deleteLogo(req.user.id);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 3 — HORAIRES
   * ════════════════════════════════════════════════════════ */

  /** Lire les 7 horaires triés lundi→dimanche */
  @Get('horaires')
  getHoraires(@Req() req: any) {
    return this.horairesService.getHoraires(req.user.id);
  }

  /** Remplacer les horaires de tous les jours d'un coup */
  @Patch('horaires')
  updateHoraires(@Req() req: any, @Body() dto: UpdateHorairesDto) {
    return this.horairesService.updateHoraires(req.user.id, dto);
  }

  /** Modifier un seul jour → PATCH /parametres/horaires/lundi */
  @Patch('horaires/:jour')
  updateJour(
    @Req() req: any,
    @Param('jour') jour: JourSemaine,
    @Body() dto: HoraireJourDto,
  ) {
    return this.horairesService.updateJour(req.user.id, jour, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 4 — CATALOGUE & RÈGLES DE PUBLICATION
   * ════════════════════════════════════════════════════════ */

  @Patch('catalogue')
  updateCatalogue(@Req() req: any, @Body() dto: UpdateCatalogueDto) {
    return this.catalogueService.updateCatalogue(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 5 — LIVRAISON
   * ════════════════════════════════════════════════════════ */

  @Patch('livraison')
  updateLivraison(@Req() req: any, @Body() dto: UpdateLivraisonDto) {
    return this.livraisonService.updateLivraison(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 6 — PAIEMENT & FACTURATION
   * ════════════════════════════════════════════════════════ */

  @Patch('paiement')
  updatePaiement(@Req() req: any, @Body() dto: UpdatePaiementDto) {
    return this.paiementService.updatePaiement(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 7 — COMMISSIONS SHOPI
   * ════════════════════════════════════════════════════════ */

  @Get('commissions')
  getCommissions(@Req() req: any) {
    return this.commissionsService.getCommissions(req.user.id);
  }

  @Patch('commissions')
  updatePlan(@Req() req: any, @Body() dto: UpdatePlanDto) {
    return this.commissionsService.updatePlan(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 8 — DOCUMENTS & VÉRIFICATION
   * ════════════════════════════════════════════════════════ */

  /** Statut de tous les documents */
  @Get('documents')
  getDocuments(@Req() req: any) {
    return this.documentsService.getDocuments(req.user.id);
  }

  /**
   * Uploader un document → POST /parametres/documents/cni
   * Types : cni | rccm | bancaire | photo | nif
   */
  @Post('documents/:type')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: any,
    @Param('type') type: any,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MAX_DOC_SIZE }),
      ],
    }))
    file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(req.user.id, type, file);
  }

  /** Supprimer un document → DELETE /parametres/documents/cni */
  @Delete('documents/:type')
  deleteDocument(@Req() req: any, @Param('type') type: any) {
    return this.documentsService.deleteDocument(req.user.id, type);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 9 — SÉCURITÉ
   * ════════════════════════════════════════════════════════ */

  @Get('securite')
  getSecurite(@Req() req: any) {
    return this.securiteService.getSecurite(req.user.id);
  }

  @Patch('securite/password')
  updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    return this.securiteService.updatePassword(req.user.id, dto);
  }

  @Patch('securite/2fa')
  updateTwoFa(@Req() req: any, @Body() dto: UpdateTwoFaDto) {
    return this.securiteService.updateTwoFa(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 10 — NOTIFICATIONS
   * ════════════════════════════════════════════════════════ */

  @Get('notifications')
  getNotifs(@Req() req: any) {
    return this.notifsService.getNotifs(req.user.id);
  }

  @Patch('notifications')
  updateNotifs(@Req() req: any, @Body() dto: UpdateNotifsDto) {
    return this.notifsService.updateNotifs(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 11 — CONFIDENTIALITÉ
   * ════════════════════════════════════════════════════════ */

  @Get('confidentialite')
  getPrivacy(@Req() req: any) {
    return this.privacyService.getPrivacy(req.user.id);
  }

  @Patch('confidentialite')
  updatePrivacy(@Req() req: any, @Body() dto: UpdatePrivacyDto) {
    return this.privacyService.updatePrivacy(req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 12 — ZONE SENSIBLE
   * ════════════════════════════════════════════════════════ */

  /** Mettre en pause — mot de passe requis */
  @Patch('danger/pause')
  pauseBoutique(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.pauseBoutique(req.user.id, dto);
  }

  /** Désactiver 30 jours — mot de passe requis */
  @Patch('danger/desactiver')
  desactiverCompte(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.desactiverCompte(req.user.id, dto);
  }

  /** Supprimer définitivement — mot de passe requis */
  @Delete('danger/supprimer')
  supprimerBoutique(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.supprimerBoutique(req.user.id, dto);
  }
}
