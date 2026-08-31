// src/modules/upload/upload.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

// ── Dossiers Cloudinary par type de contenu ───────────────────────────────────
export const UPLOAD_FOLDERS = {
  PRODUCT:   'shopi/products',    // photos des produits
  COMPANY:   'shopi/companies',   // logos et bannières boutiques
  AVATAR:    'shopi/avatars',     // photos de profil
  DOCUMENT:  'shopi/documents',   // PDFs, documents légaux
  VIDEO:     'shopi/videos',      // vidéos promotionnelles
  SUPPORT:   'shopi/support',     // pièces jointes tickets support
} as const;

export type UploadFolder = typeof UPLOAD_FOLDERS[keyof typeof UPLOAD_FOLDERS];

export interface UploadResult {
  url:       string;   // URL HTTPS publique
  publicId:  string;   // ID pour supprimer/modifier plus tard
  width?:    number;
  height?:   number;
  format:    string;
  size:      number;   // en bytes
}

// ── Limites ───────────────────────────────────────────────────────────────────
const MAX_IMAGE_SIZE = 5  * 1024 * 1024;  // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50 MB
const MAX_DOC_SIZE   = 10 * 1024 * 1024;  // 10 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const ALLOWED_AUDIO_TYPES = [
  'audio/webm', 'audio/webm;codecs=opus',
  'audio/ogg',  'audio/ogg;codecs=opus',
  'audio/mp4',  'audio/mpeg',
  'audio/wav',  'audio/x-m4a',
];

@Injectable()
export class UploadService {

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE
  // ══════════════════════════════════════════════════════════════════════════

  async uploadImage(
    file:   Express.Multer.File,
    folder: UploadFolder = UPLOAD_FOLDERS.PRODUCT,
    options?: { width?: number; height?: number },
  ): Promise<UploadResult> {

    // ── Validation ────────────────────────────────────────────────────────
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Format non supporté. Formats acceptés : JPG, PNG, WebP, GIF.`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(`Image trop lourde. Maximum : 5 MB.`);
    }

    // ── Upload vers Cloudinary ────────────────────────────────────────────
    const result = await this.uploadToCloudinary(file.buffer, {
      folder,
      resource_type: 'image',
      format:        'webp',        // conversion automatique en WebP
      quality:       'auto:good',   // compression intelligente
      ...(options?.width  && { width:  options.width  }),
      ...(options?.height && { height: options.height }),
      ...(options?.width || options?.height ? { crop: 'limit' } : {}),
    });

    return this.toUploadResult(result);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD VIDÉO
  // ══════════════════════════════════════════════════════════════════════════

  async uploadVideo(
    file:   Express.Multer.File,
    folder: UploadFolder = UPLOAD_FOLDERS.VIDEO,
  ): Promise<UploadResult> {

    if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Format vidéo non supporté. Formats acceptés : MP4, WebM, MOV.`,
      );
    }
    if (file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException(`Vidéo trop lourde. Maximum : 50 MB.`);
    }

    const result = await this.uploadToCloudinary(file.buffer, {
      folder,
      resource_type: 'video',
      eager: [
        { format: 'mp4',  quality: 'auto' },   // version MP4
        { format: 'webm', quality: 'auto' },   // version WebM (navigateurs modernes)
      ],
      eager_async: true,   // transformations en arrière-plan
    });

    return this.toUploadResult(result);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD DOCUMENT (PDF)
  // ══════════════════════════════════════════════════════════════════════════

  async uploadDocument(
    file:   Express.Multer.File,
    folder: UploadFolder = UPLOAD_FOLDERS.DOCUMENT,
  ): Promise<UploadResult> {

    if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Seuls les fichiers PDF sont acceptés.`);
    }
    if (file.size > MAX_DOC_SIZE) {
      throw new BadRequestException(`Document trop lourd. Maximum : 10 MB.`);
    }

    const result = await this.uploadToCloudinary(file.buffer, {
      folder,
      resource_type: 'raw',   // fichiers non-média
    });

    return this.toUploadResult(result);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD AUDIO (messages vocaux)
  // Cloudinary stocke audio via resource_type:'video' (son API regroupe les deux)
  // ══════════════════════════════════════════════════════════════════════════

  async uploadAudio(
    file:   Express.Multer.File,
    folder: UploadFolder = UPLOAD_FOLDERS.VIDEO,
  ): Promise<UploadResult> {
    const mime    = file.mimetype.split(';')[0].trim();
    const allowed = ALLOWED_AUDIO_TYPES.some(t => t.startsWith(mime));
    if (!allowed) {
      throw new BadRequestException(
        'Format audio non supporté. Formats acceptés : WebM, OGG, MP4, MP3, WAV.',
      );
    }
    if (file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException('Fichier audio trop lourd. Maximum : 50 MB.');
    }

    /* PAS de `format: 'mp3'` ici — ça forçait Cloudinary à transcoder AVANT
     * de répondre (upload bloqué le temps de la conversion complète),
     * retardant d'autant la création du message ET sa réception par le
     * destinataire (qui a besoin d'une URL persistante — voir
     * useMessagerie.ts::sendMessage). L'upload stocke le fichier brut
     * (webm/ogg) tel quel — quasi instantané, pas de transcodage à
     * attendre — et l'URL de livraison ci-dessous demande le mp3 : Cloudinary
     * le génère à la demande au premier accès (mis en cache ensuite), donc
     * seul le tout premier lecteur (souvent le destinataire) absorbe ce
     * coût, jamais l'envoi du message. */
    const result = await this.uploadToCloudinary(file.buffer, {
      folder,
      resource_type: 'video',  // Cloudinary gère audio + vidéo ensemble
    });

    const uploadResult = this.toUploadResult(result);
    /* Conversion universelle (iOS + Android + Web) demandée dans l'URL de
     * livraison plutôt qu'à l'upload — voir commentaire ci-dessus. */
    uploadResult.url    = uploadResult.url.replace(/\.[a-z0-9]+$/i, '.mp3');
    uploadResult.format = 'mp3';
    return uploadResult;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD GÉNÉRIQUE (pièces jointes support, etc.)
  // Détermine le resource_type Cloudinary à partir du mimeType.
  // ══════════════════════════════════════════════════════════════════════════

  async uploadBuffer(
    buffer:   Buffer,
    folder:   UploadFolder,
    mimeType: string,
  ): Promise<{ url: string; publicId: string }> {
    const resourceType: 'image' | 'video' | 'raw' =
      mimeType.startsWith('image/') ? 'image' :
      mimeType.startsWith('video/') ? 'video' : 'raw';

    const result = await this.uploadToCloudinary(buffer, {
      folder,
      resource_type: resourceType,
    });

    return { url: result.secure_url, publicId: result.public_id };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUPPRESSION
  // ══════════════════════════════════════════════════════════════════════════

  async delete(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVÉS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * uploadToCloudinary()
   * Convertit un Buffer en stream pour Cloudinary (multer stocke en mémoire).
   */
  private uploadToCloudinary(
    buffer:  Buffer,
    options: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      });
      streamifier.createReadStream(buffer).pipe(stream);
    });
  }

  private toUploadResult(result: UploadApiResponse): UploadResult {
    return {
      url:      result.secure_url,
      publicId: result.public_id,
      width:    result.width,
      height:   result.height,
      format:   result.format,
      size:     result.bytes,
    };
  }
}