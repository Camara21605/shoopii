/* ================================================================
 * FICHIER : src/shared/utils/imageResize.ts
 *
 * Réduction d'une photo DANS LE NAVIGATEUR avant envoi.
 *
 * Pourquoi : une photo de téléphone fait 3 000 – 4 000 px et 3 à 10 Mo.
 * L'envoyer telle quelle est lent sur réseau mobile, et au-delà de 5 Mo le
 * serveur la refuse — alors qu'il la ramène de toute façon à 800 px de
 * large (fiche produit). On la réduit donc à MAX_SIDE avant l'envoi :
 * quelques centaines de Ko, envoi quasi instantané, qualité identique à
 * l'écran.
 *
 * Orientation respectée (photos prises en portrait) : createImageBitmap
 * avec `imageOrientation: 'from-image'` applique la rotation EXIF.
 * ================================================================ */

const MAX_SIDE = 1600;
const QUALITY  = 0.88;

/** Rend une version réduite de `file` (ou `file` lui-même s'il est déjà petit
 *  ou si le navigateur ne sait pas le décoder). PNG conservé en PNG
 *  (transparence), le reste en JPEG. */
export async function resizeImageFile(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;                                   // format non décodable : envoi tel quel
  }
  const { width, height } = bitmap;
  const k = Math.min(1, maxSide / Math.max(width, height));
  if (k === 1 && file.size <= 1.5 * 1024 * 1024) { bitmap.close(); return file; }

  const w = Math.round(width * k), h = Math.round(height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return file; }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, type, QUALITY));
  if (!blob || blob.size >= file.size) return file;   // jamais plus lourd que l'original
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.${type === 'image/png' ? 'png' : 'jpg'}`, { type, lastModified: Date.now() });
}
