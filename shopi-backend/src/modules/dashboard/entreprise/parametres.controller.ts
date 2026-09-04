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
 * L'userId est extrait du token via @Req() req.user.actorId ?? req.user.id
 * ============================================================ */

import {
  Controller, Get, Patch, Post, Delete,
  Body, Param, UseGuards, Req,
  UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard }      from 'src/common/guards/auth.guard';
import { RolesGuard }        from 'src/common/guards/roles.guard';
import { Roles }             from 'src/common/decorators/roles.decorator';
import { UserRole }          from 'src/common/enums/user-role.enum';
import { TeamPermissionGuard }    from 'src/modules/company-team/guards/team-permission.guard';
import { RequiresTeamPermission } from 'src/modules/company-team/decorators/requires-team-permission.decorator';

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
import { UpdateTwoFaDto, UpdatePasswordDto } from './dto/update-securite.dto';
import { UpdateNotifsDto }      from './dto/update-notifs.dto';
import { UpdatePrivacyDto }     from './dto/update-privacy.dto';
import { JourSemaine }          from 'src/database/entities/entreprise.table/company-horaire.entity';

/* ── Limites upload ── */
const MAX_IMAGE_SIZE = 5  * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE   = 10 * 1024 * 1024; // 10 MB

/* FIX C1 — Ajout RolesGuard + restriction COMPANY uniquement.
 * Sans ce correctif, tout utilisateur JWT (CLIENT, LIVREUR…)
 * pouvait appeler tous les endpoints paramètres. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
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
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get()
  getAll(@Req() req: any) {
    return this.boutiqueService.getParametres(req.user.actorId ?? req.user.id);
  }

  /** Identique à getAll() mais gardée par boutique.view au lieu de
   * settings.view — dédiée à BoutiquePreviewPage.tsx ("Voir ma boutique"),
   * un groupe de permission distinct de Paramètres. Un collaborateur avec
   * boutique.view mais sans settings.view restait bloqué sur un chargement
   * infini (getAll() renvoyait 403, la page n'avait pas d'état d'erreur). */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('boutique', 'view')
  @Get('apercu')
  getApercuBoutique(@Req() req: any) {
    return this.boutiqueService.getParametres(req.user.actorId ?? req.user.id);
  }

  /** Mettre à jour Boutique & Identité */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('boutique')
  updateBoutique(@Req() req: any, @Body() dto: UpdateBoutiqueDto) {
    return this.boutiqueService.updateBoutique(req.user.actorId ?? req.user.id, dto);
  }

  /** Mettre à jour Contact & Localisation */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('contact')
  updateContact(@Req() req: any, @Body() dto: UpdateContactDto) {
    return this.boutiqueService.updateContact(req.user.actorId ?? req.user.id, dto);
  }

  /** Uploader le logo (multipart/form-data, champ "file") */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
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
    return this.boutiqueService.uploadLogo(req.user.actorId ?? req.user.id, file);
  }

  /** Uploader l'image de couverture */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
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
    return this.boutiqueService.uploadCover(req.user.actorId ?? req.user.id, file);
  }

  /** Supprimer le logo */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Delete('logo')
  deleteLogo(@Req() req: any) {
    return this.boutiqueService.deleteLogo(req.user.actorId ?? req.user.id);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 3 — HORAIRES
   * ════════════════════════════════════════════════════════ */

  /** Lire les 7 horaires triés lundi→dimanche */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('horaires')
  getHoraires(@Req() req: any) {
    return this.horairesService.getHoraires(req.user.actorId ?? req.user.id);
  }

  /** Remplacer les horaires de tous les jours d'un coup */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('horaires')
  updateHoraires(@Req() req: any, @Body() dto: UpdateHorairesDto) {
    return this.horairesService.updateHoraires(req.user.actorId ?? req.user.id, dto);
  }

  /** Modifier un seul jour → PATCH /parametres/horaires/lundi */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('horaires/:jour')
  updateJour(
    @Req() req: any,
    @Param('jour') jour: JourSemaine,
    @Body() dto: HoraireJourDto,
  ) {
    return this.horairesService.updateJour(req.user.actorId ?? req.user.id, jour, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 4 — CATALOGUE & RÈGLES DE PUBLICATION
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('catalogue')
  updateCatalogue(@Req() req: any, @Body() dto: UpdateCatalogueDto) {
    return this.catalogueService.updateCatalogue(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 5 — LIVRAISON
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('livraison')
  updateLivraison(@Req() req: any, @Body() dto: UpdateLivraisonDto) {
    return this.livraisonService.updateLivraison(req.user.actorId ?? req.user.id, dto);
  }

  /** Zones de livraison réellement attribuées à l'entreprise (via son
   * admin assigné) — remplace l'ancienne liste statique geo-guinee.ts. */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('livraison/zones-disponibles')
  getZonesDisponibles(@Req() req: any) {
    return this.livraisonService.getZonesDisponibles(req.user.actorId ?? req.user.id);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 6 — PAIEMENT & FACTURATION
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('paiement')
  updatePaiement(@Req() req: any, @Body() dto: UpdatePaiementDto) {
    return this.paiementService.updatePaiement(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 7 — COMMISSIONS SHOPI
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('commissions')
  getCommissions(@Req() req: any) {
    return this.commissionsService.getCommissions(req.user.actorId ?? req.user.id);
  }

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('commissions')
  updatePlan(@Req() req: any, @Body() dto: UpdatePlanDto) {
    return this.commissionsService.updatePlan(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 8 — DOCUMENTS & VÉRIFICATION
   * ════════════════════════════════════════════════════════ */

  /** Statut de tous les documents */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('documents')
  getDocuments(@Req() req: any) {
    return this.documentsService.getDocuments(req.user.actorId ?? req.user.id);
  }

  /**
   * Uploader un document → POST /parametres/documents/cni
   * Types : cni | rccm | bancaire | photo | nif
   */
  /* FIX I5 — Ajout FileTypeValidator sur les documents légaux.
   * Avant : n'importe quel fichier (exe, script…) était accepté.
   * Après : seuls PDF et images JPEG/PNG/WebP sont autorisés. */
  /* SÉCURITÉ — ThrottlerGuard absent de cette route jusqu'ici (seules les
   * routes déjà identifiées comme sensibles ailleurs dans l'app — auth,
   * contact, support — en étaient dotées). Documents légaux = upload
   * lourd (jusqu'à 10 MB) + coût Cloudinary : un JWT compromis pouvait
   * marteler cette route sans limite. Même mécanisme que
   * ContactController (voir contact.controller.ts). */
  @UseGuards(TeamPermissionGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @RequiresTeamPermission('settings', 'edit')
  @Post('documents/:type')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: any,
    @Param('type') type: any,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MAX_DOC_SIZE }),
        new FileTypeValidator({ fileType: /application\/pdf|image\/(jpeg|png|webp)/ }),
      ],
    }))
    file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(req.user.actorId ?? req.user.id, type, file);
  }

  /** Supprimer un document → DELETE /parametres/documents/cni */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Delete('documents/:type')
  deleteDocument(@Req() req: any, @Param('type') type: any) {
    return this.documentsService.deleteDocument(req.user.actorId ?? req.user.id, type);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 9 — SÉCURITÉ
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('securite')
  getSecurite(@Req() req: any) {
    return this.securiteService.getSecurite(req.user.actorId ?? req.user.id);
  }

  /* BUG CORRIGÉ — ce handler passait actorId (= Company.id, jamais égal à
   * User.id) à un service qui interroge userRepo par cet id : le
   * changement de mot de passe échouait donc systématiquement en
   * "Utilisateur introuvable", propriétaire compris. Contrairement aux
   * autres routes de ce contrôleur, le mot de passe n'est PAS une
   * ressource scopée à l'entreprise — c'est l'identifiant de connexion de
   * LA PERSONNE qui appelle (propriétaire ou collaborateur), donc on
   * utilise toujours req.user.id (jamais actorId), même pour un
   * collaborateur : il modifie SON propre mot de passe, pas celui du
   * propriétaire. */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('securite/password')
  updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    return this.securiteService.updatePassword(req.user.id, dto);
  }

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('securite/2fa')
  updateTwoFa(@Req() req: any, @Body() dto: UpdateTwoFaDto) {
    return this.securiteService.updateTwoFa(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 10 — NOTIFICATIONS
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('notifications')
  getNotifs(@Req() req: any) {
    return this.notifsService.getNotifs(req.user.actorId ?? req.user.id);
  }

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('notifications')
  updateNotifs(@Req() req: any, @Body() dto: UpdateNotifsDto) {
    return this.notifsService.updateNotifs(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 11 — CONFIDENTIALITÉ
   * ════════════════════════════════════════════════════════ */

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'view')
  @Get('confidentialite')
  getPrivacy(@Req() req: any) {
    return this.privacyService.getPrivacy(req.user.actorId ?? req.user.id);
  }

  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('confidentialite')
  updatePrivacy(@Req() req: any, @Body() dto: UpdatePrivacyDto) {
    return this.privacyService.updatePrivacy(req.user.actorId ?? req.user.id, dto);
  }

  /* ════════════════════════════════════════════════════════
   * SECTION 12 — ZONE SENSIBLE
   * ════════════════════════════════════════════════════════ */

  /** Mettre en pause — mot de passe requis. Pas d'action "danger" dédiée
   * dans TeamPermissions.settings ({view, edit} seulement) — gaté avec
   * settings.edit comme le reste de la section, ce qui est large pour une
   * action de cette gravité mais correspond au découpage actuel du schéma
   * de permissions (voir aussi : ces 3 routes danger/* ne sont pas encore
   * appelées par DangerSection.tsx aujourd'hui, boutons non câblés). */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('danger/pause')
  pauseBoutique(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.pauseBoutique(req.user.actorId ?? req.user.id, dto);
  }

  /** Désactiver 30 jours — mot de passe requis */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Patch('danger/desactiver')
  desactiverCompte(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.desactiverCompte(req.user.actorId ?? req.user.id, dto);
  }

  /** Supprimer définitivement — mot de passe requis */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('settings', 'edit')
  @Delete('danger/supprimer')
  supprimerBoutique(@Req() req: any, @Body() dto: DangerConfirmDto) {
    return this.dangerService.supprimerBoutique(req.user.actorId ?? req.user.id, dto);
  }
}
