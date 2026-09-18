/* ============================================================
 * FICHIER : src/modules/upload/upload.controller.ts
 *
 * Expose les endpoints d'upload vers Cloudinary.
 * Utilisé notamment pour les photos de profil client et produits.
 *
 * ✅ AJOUT : POST /upload/image/product
 *    → règle le 404 sur POST /api/upload/image/product
 * ============================================================ */

import {
  Controller, Post, UploadedFile, UseGuards,
  UseInterceptors, BadRequestException, Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';

import { JwtAuthGuard }   from '../../common/guards/auth.guard';
import { RolesGuard }     from '../../common/guards/roles.guard';
import { Roles }          from '../../common/decorators/roles.decorator';
import { UserRole }       from '../../common/enums/user-role.enum';
import { UploadService, UPLOAD_FOLDERS, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_DOC_SIZE } from './upload.service';

/* ── Config multer en mémoire (pas de disque) ──────────────────
 * ⚠️ FAILLE CORRIGÉE (audit sécurité) — sans `limits.fileSize`, multer
 * (memoryStorage) bufferise l'INTÉGRALITÉ du corps de la requête en RAM
 * AVANT que UploadService ne vérifie file.size — un utilisateur authentifié
 * pouvait envoyer des requêtes de plusieurs centaines de Mo/Go en boucle
 * pour épuiser la mémoire du process. La limite ici agit comme garde-fou
 * dur au niveau du parsing multipart lui-même ; les tailles reprennent
 * exactement les constantes déjà utilisées par UploadService (source
 * unique de vérité, pas de nombre magique dupliqué). */
const memoryMulterImage    = { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE } };
const memoryMulterVideo    = { storage: memoryStorage(), limits: { fileSize: MAX_VIDEO_SIZE } };
const memoryMulterDocument = { storage: memoryStorage(), limits: { fileSize: MAX_DOC_SIZE } };

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {

  constructor(private readonly uploadService: UploadService) {}

  /* ──────────────────────────────────────────────────────────
   * POST /upload/image
   * Upload générique d'une image → dossier products par défaut
   * Retourne : { url, publicId, width, height, format, size }
   ────────────────────────────────────────────────────────── */
  @Post('image')
  @UseInterceptors(FileInterceptor('file', memoryMulterImage))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadImage(file, UPLOAD_FOLDERS.PRODUCT);
  }

  /* ──────────────────────────────────────────────────────────
   * ✅ POST /upload/image/product
   * Upload d'une image PRODUIT → dossier products
   * (URL explicite utilisée par le formulaire produit du frontend)
   * Optimisé : largeur max 800px, conversion WebP automatique.
   * Retourne : { url, publicId, width, height, format, size }
   ────────────────────────────────────────────────────────── */
  @Post('image/product')
  @UseInterceptors(FileInterceptor('file', memoryMulterImage))
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.PRODUCT,
      { width: 800 },   // largeur max produit
    );
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/image/catalogue
   * Image d'un type d'entreprise / d'une catégorie / d'une sous-catégorie
   * → dossier catalogue. Réservé au SUPER_ADMIN (seul rôle qui gère le
   * catalogue, voir CatalogueController). Carré 512×512 max, WebP.
   ────────────────────────────────────────────────────────── */
  @Post('image/catalogue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', memoryMulterImage))
  async uploadCatalogueImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadImage(file, UPLOAD_FOLDERS.CATALOGUE, { width: 512, height: 512 });
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/avatar
   * Upload d'une photo de profil → dossier avatars
   * Optimisé : redimensionné à 400×400 max, converti WebP
   ────────────────────────────────────────────────────────── */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', memoryMulterImage))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.AVATAR,
      { width: 400, height: 400 },
    );
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/company/:type
   * :type = logo | cover
   * Upload logo ou bannière boutique → dossier companies
   *
   * FIX I3 — Restreindre au rôle COMPANY uniquement.
   * Avant : tout utilisateur JWT (CLIENT, LIVREUR…) pouvait
   * uploader dans le dossier companies sur Cloudinary.
   * Après : seul un COMPANY authentifié peut appeler cet endpoint.
   ────────────────────────────────────────────────────────── */
  @Post('company/:type')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY)
  @UseInterceptors(FileInterceptor('file', memoryMulterImage))
  async uploadCompanyImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('type')  type: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    if (!['logo', 'cover'].includes(type)) {
      throw new BadRequestException('Type invalide. Valeurs acceptées : logo, cover.');
    }
    const opts = type === 'cover'
      ? { width: 1200, height: 400 }
      : { width: 400,  height: 400 };
    return this.uploadService.uploadImage(file, UPLOAD_FOLDERS.COMPANY, opts);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/video
   * Upload vidéo produit → dossier videos
   ────────────────────────────────────────────────────────── */
  @Post('video')
  @UseInterceptors(FileInterceptor('file', memoryMulterVideo))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadVideo(file, UPLOAD_FOLDERS.VIDEO);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/document
   * Upload document PDF → dossier documents
   ────────────────────────────────────────────────────────── */
  @Post('document')
  @UseInterceptors(FileInterceptor('file', memoryMulterDocument))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/audio
   * Upload message vocal (WebM/OGG/MP4) → converti en MP3 Cloudinary
   * Retourne : { url, publicId, format, size }
   ────────────────────────────────────────────────────────── */
  @Post('audio')
  @UseInterceptors(FileInterceptor('file', memoryMulterVideo))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier audio reçu.');
    return this.uploadService.uploadAudio(file, UPLOAD_FOLDERS.VIDEO);
  }
}