/* ============================================================
 * FICHIER : src/common/utils/avatar-url.util.ts
 *
 * Une photo de profil ne peut être qu'une image envoyée via
 * POST /upload/avatar : Cloudinary de la plateforme, dossier shopi/avatars.
 * Toute autre adresse (site externe, pixel de suivi, lien piégé) est refusée.
 * ============================================================ */

export const AVATAR_URL_MAX = 500;

export function estAvatarPlateforme(url: string): boolean {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || url.length > AVATAR_URL_MAX) return false;
  const prefix = `https://res.cloudinary.com/${cloud}/image/upload/`;
  return url.startsWith(prefix)
    && /^(v\d+\/)?shopi\/avatars\/[\w\-./]+$/.test(url.slice(prefix.length))
    && !url.includes('..');
}
