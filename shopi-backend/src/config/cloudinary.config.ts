/* ============================================================
 * FICHIER      : src/config/cloudinary.config.ts
 * MODULE       : Config
 * ROLE         : Fournisseur NestJS pour le SDK Cloudinary (stockage d'images).
 *
 * RESPONSABILITES :
 *   - Lire les 3 variables d'environnement Cloudinary.
 *   - Configurer l'instance cloudinary.v2 et l'exposer sous le token 'CLOUDINARY'.
 *
 * DEPENDANCES  :
 *   - cloudinary (npm) — SDK officiel Cloudinary
 *   - @nestjs/config (ConfigService) — lecture des variables d'environnement
 *
 * CONSOMME PAR :
 *   - UploadModule — @Inject('CLOUDINARY') pour uploader/supprimer des images
 *
 * VARIABLES D'ENVIRONNEMENT REQUISES :
 *   CLOUDINARY_CLOUD_NAME  — nom du cloud (tableau de bord Cloudinary)
 *   CLOUDINARY_API_KEY     — clé publique API
 *   CLOUDINARY_API_SECRET  — secret API (ne jamais exposer côté client)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { v2 as cloudinary } from 'cloudinary';
import { ConfigService }    from '@nestjs/config';

/**
 * CloudinaryProvider
 * Fournisseur de factory NestJS qui configure le SDK Cloudinary.
 * Injecter avec @Inject('CLOUDINARY') dans les services d'upload.
 */
export const CloudinaryProvider = {
  provide:    'CLOUDINARY',
  inject:     [ConfigService],
  useFactory: (config: ConfigService) => {
    return cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key:    config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
    });
  },
};