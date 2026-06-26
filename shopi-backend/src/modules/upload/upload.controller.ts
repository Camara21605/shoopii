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
import { UploadService, UPLOAD_FOLDERS } from './upload.service';

/* ── Config multer en mémoire (pas de disque) ── */
const memoryMulter = { storage: memoryStorage() };

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
  @UseInterceptors(FileInterceptor('file', memoryMulter))
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
  @UseInterceptors(FileInterceptor('file', memoryMulter))
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.PRODUCT,
      { width: 800 },   // largeur max produit
    );
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/avatar
   * Upload d'une photo de profil → dossier avatars
   * Optimisé : redimensionné à 400×400 max, converti WebP
   ────────────────────────────────────────────────────────── */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', memoryMulter))
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
   ────────────────────────────────────────────────────────── */
  @Post('company/:type')
  @UseInterceptors(FileInterceptor('file', memoryMulter))
  async uploadCompanyImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('type')  type: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
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
  @UseInterceptors(FileInterceptor('file', memoryMulter))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.uploadService.uploadVideo(file, UPLOAD_FOLDERS.VIDEO);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /upload/document
   * Upload document PDF → dossier documents
   ────────────────────────────────────────────────────────── */
  @Post('document')
  @UseInterceptors(FileInterceptor('file', memoryMulter))
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
  @UseInterceptors(FileInterceptor('file', memoryMulter))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier audio reçu.');
    return this.uploadService.uploadAudio(file, UPLOAD_FOLDERS.VIDEO);
  }
}