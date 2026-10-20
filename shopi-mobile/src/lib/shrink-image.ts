/**
 * Réduit une photo choisie sur le téléphone avant de l'envoyer : côté le plus
 * long ramené à `maxSide` px, recompressée en JPEG.
 *
 * Pourquoi : une photo d'appareil récent pèse 3 à 12 Mo. Le serveur refuse
 * les images de plus de 5 Mo en coupant l'envoi en cours — le téléphone
 * l'affichait comme « Connexion impossible » (logo et couverture d'une
 * boutique). Réduite, la même photo pèse quelques centaines de Ko : envoi
 * rapide même en 3G, jamais refusée, et largement assez nette pour l'écran.
 * Même méthode que les photos de produits (company/components/product-media).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type ShrunkImage = { uri: string; name: string; mimeType: 'image/jpeg'; width: number; height: number };

export async function shrinkImage(
  src: { uri: string; width?: number; height?: number },
  maxSide: number,
  quality = 0.82,
): Promise<ShrunkImage> {
  const ctx = ImageManipulator.manipulate(src.uri);
  const w = src.width ?? 0;
  const h = src.height ?? 0;
  /* Dimensions inconnues : on redimensionne quand même par la largeur (sans agrandir au-delà de l'original). */
  if (!w || !h || Math.max(w, h) > maxSide) {
    ctx.resize(w >= h ? { width: Math.min(maxSide, w || maxSide) } : { height: Math.min(maxSide, h) });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return { uri: out.uri, name: `photo-${Date.now()}.jpg`, mimeType: 'image/jpeg', width: out.width, height: out.height };
}
