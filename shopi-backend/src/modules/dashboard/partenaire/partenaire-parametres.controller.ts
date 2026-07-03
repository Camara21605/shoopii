/* ============================================================
 * FICHIER : partenaire-parametres.controller.ts
 *
 * RÔLE : Controller de tous les paramètres du dashboard partenaire.
 *
 * Base route : /dashboard/partenaire/parametres
 *
 * Sécurité :
 *   @UseGuards(JwtAuthGuard) → JWT obligatoire sur toutes les routes
 *   userId extrait depuis req.user (injecté par JwtAuthGuard)
 *
 * Organisation des routes (en parallèle avec les sections frontend) :
 *
 *   GET    /me                  → photo + nom (léger, topbar)
 *   GET    /                    → données complètes
 *   PATCH  /profil              → profil + nom partenaire
 *   POST   /photo               → upload Cloudinary (multipart)
 *   PATCH  /zone                → localisation + zone d'activité
 *   GET    /securite            → statut 2FA
 *   PATCH  /securite/password   → changement mot de passe
 *   PATCH  /securite/2fa        → activer/désactiver 2FA
 *   GET    /notifications
 *   PATCH  /notifications
 *   GET    /confidentialite
 *   PATCH  /confidentialite
 *   GET    /preferences
 *   PATCH  /preferences
 *   PATCH  /danger/pause        → mise en pause (confirm password)
 *   PATCH  /danger/desactiver   → désactivation 30j (confirm password)
 *   DELETE /danger/supprimer    → suppression définitive (confirm password)
 * ============================================================ */

import {
  Controller, Get, Patch, Post, Delete,
  Body, Req, Param, UploadedFile,
  UseGuards, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor }     from '@nestjs/platform-express';
import { memoryStorage }       from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request }        from 'express';

import { JwtAuthGuard }        from 'src/common/guards/auth.guard';

import { ProfilPartenaireService }   from './services/profil-partenaire.service';
import { SecuritePartenaireService } from './services/securite-partenaire.service';
import { NotifsPartenaireService }   from './services/notifs-partenaire.service';
import { DangerPartenaireService }   from './services/danger-partenaire.service';

import {
  UpdatePartenaireProfilDto,
  UpdatePartenaireZoneDto,
  UpdatePartenairePasswordDto,
  UpdatePartenaireTwoFaDto,
  UpdatePartenaireNotifsDto,
  UpdatePartenairePrivacyDto,
  UpdatePartenairePreferencesDto,
  PartenaireDangerConfirmDto,
} from './dto/partenaire-parametres.dto';

/* ── Multer en mémoire (pas de fichier disque) ── */
const MULTER_OPTS = { storage: memoryStorage() };

/* ── Helper userId ── */
function userId(req: Request): string {
  return (req as any).user?.userId ?? (req as any).user?.id ?? (req as any).user?.sub;
}

/* ═══════════════════════════════════════════════════════════ */

@ApiTags('Partenaire — Paramètres')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/partenaire/parametres')
export class PartenaireParametresController {

  constructor(
    private readonly profilService:   ProfilPartenaireService,
    private readonly securiteService: SecuritePartenaireService,
    private readonly notifsService:   NotifsPartenaireService,
    private readonly dangerService:   DangerPartenaireService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PROFIL
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Infos légères pour la topbar (photo + nom)' })
  @Get('me')
  getAvatarInfo(@Req() req: Request) {
    return this.profilService.getAvatarInfo(userId(req));
  }

  @ApiOperation({ summary: 'Données complètes pour toutes les sections paramètres' })
  @Get()
  getParametres(@Req() req: Request) {
    return this.profilService.getParametres(userId(req));
  }

  @ApiOperation({ summary: 'Modifier les informations personnelles et nom partenaire' })
  @Patch('profil')
  updateProfil(@Req() req: Request, @Body() dto: UpdatePartenaireProfilDto) {
    return this.profilService.updateProfil(userId(req), dto);
  }

  @ApiOperation({ summary: 'Téléverser la photo de profil (multipart/form-data)' })
  @Post('photo')
  @UseInterceptors(FileInterceptor('file', MULTER_OPTS))
  uploadPhoto(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    return this.profilService.uploadPhoto(userId(req), file);
  }

  /* ──────────────────────────────────────────────────────────
   * LOCALISATION & ZONE
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Mettre à jour la zone d\'activité et la localisation' })
  @Patch('zone')
  updateZone(@Req() req: Request, @Body() dto: UpdatePartenaireZoneDto) {
    return this.profilService.updateZone(userId(req), dto);
  }

  /* ──────────────────────────────────────────────────────────
   * SÉCURITÉ
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Statut 2FA et sécurité du compte' })
  @Get('securite')
  getSecurite(@Req() req: Request) {
    return this.securiteService.getSecurite(userId(req));
  }

  @ApiOperation({ summary: 'Changer le mot de passe' })
  @Patch('securite/password')
  updatePassword(@Req() req: Request, @Body() dto: UpdatePartenairePasswordDto) {
    return this.securiteService.updatePassword(userId(req), dto);
  }

  @ApiOperation({ summary: 'Activer / désactiver la double authentification' })
  @Patch('securite/2fa')
  updateTwoFa(@Req() req: Request, @Body() dto: UpdatePartenaireTwoFaDto) {
    return this.securiteService.updateTwoFa(userId(req), dto);
  }

  /* ──────────────────────────────────────────────────────────
   * NOTIFICATIONS
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Préférences de notifications actuelles' })
  @Get('notifications')
  getNotifs(@Req() req: Request) {
    return this.notifsService.getNotifs(userId(req));
  }

  @ApiOperation({ summary: 'Mettre à jour les préférences de notifications' })
  @Patch('notifications')
  updateNotifs(@Req() req: Request, @Body() dto: UpdatePartenaireNotifsDto) {
    return this.notifsService.updateNotifs(userId(req), dto);
  }

  /* ──────────────────────────────────────────────────────────
   * CONFIDENTIALITÉ
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Paramètres de confidentialité actuels' })
  @Get('confidentialite')
  getPrivacy(@Req() req: Request) {
    return this.notifsService.getPrivacy(userId(req));
  }

  @ApiOperation({ summary: 'Mettre à jour les paramètres de confidentialité' })
  @Patch('confidentialite')
  updatePrivacy(@Req() req: Request, @Body() dto: UpdatePartenairePrivacyDto) {
    return this.notifsService.updatePrivacy(userId(req), dto);
  }

  /* ──────────────────────────────────────────────────────────
   * PRÉFÉRENCES (langue, apparence)
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Préférences UI actuelles (langue, apparence)' })
  @Get('preferences')
  getPreferences(@Req() req: Request) {
    return this.notifsService.getPreferences(userId(req));
  }

  @ApiOperation({ summary: 'Mettre à jour les préférences UI' })
  @Patch('preferences')
  updatePreferences(@Req() req: Request, @Body() dto: UpdatePartenairePreferencesDto) {
    return this.notifsService.updatePreferences(userId(req), dto);
  }

  /* ──────────────────────────────────────────────────────────
   * ZONE DANGER — Confirmation mot de passe obligatoire
   * ────────────────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Mettre le compte en pause (réversible)' })
  @HttpCode(HttpStatus.OK)
  @Patch('danger/pause')
  pauseCompte(@Req() req: Request, @Body() dto: PartenaireDangerConfirmDto) {
    return this.dangerService.pauseCompte(userId(req), dto);
  }

  @ApiOperation({ summary: 'Désactiver temporairement le compte (30 jours)' })
  @HttpCode(HttpStatus.OK)
  @Patch('danger/desactiver')
  desactiverCompte(@Req() req: Request, @Body() dto: PartenaireDangerConfirmDto) {
    return this.dangerService.desactiverCompte(userId(req), dto);
  }

  @ApiOperation({ summary: 'Suppression définitive du compte partenaire — IRRÉVERSIBLE' })
  @HttpCode(HttpStatus.OK)
  @Delete('danger/supprimer')
  supprimerCompte(@Req() req: Request, @Body() dto: PartenaireDangerConfirmDto) {
    return this.dangerService.supprimerCompte(userId(req), dto);
  }
}
