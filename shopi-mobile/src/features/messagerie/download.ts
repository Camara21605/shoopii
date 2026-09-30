/**
 * Téléchargement d'une pièce jointe reçue dans la messagerie :
 *   - image/vidéo → enregistrée dans la pellicule (Photos/Galerie), via
 *     expo-media-library (l'API "legacy" — le nouveau module expo-media-
 *     library ("Next", classes Asset/Album) n'expose plus saveToLibraryAsync
 *     que sous ce sous-chemin ; l'importer depuis le point d'entrée principal
 *     lève une exception à l'exécution, voir son propre avertissement de dépréciation)
 *   - document → il n'existe aucun "dossier Téléchargements" universel sur
 *     mobile (contrairement à un navigateur) : téléchargé dans le cache de
 *     l'app puis proposé via la feuille de partage système (« Enregistrer
 *     dans Fichiers », Drive, etc.) — même geste que WhatsApp/Telegram pour
 *     un document reçu.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

export type DownloadableKind = 'image' | 'video' | 'document';

export interface DownloadResult {
  ok: boolean;
  message: string;
}

async function downloadToCache(url: string, filename: string): Promise<string> {
  const safeName = filename.replace(/[^\w.\-]+/g, '_') || 'fichier';
  const file = await File.downloadFileAsync(url, new File(new Directory(Paths.cache), safeName));
  return file.uri;
}

export async function downloadAttachment(kind: DownloadableKind, url: string, filename: string): Promise<DownloadResult> {
  try {
    if (kind === 'image' || kind === 'video') {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return { ok: false, message: "Autorisez l'accès à vos photos pour enregistrer ce média." };
      const localUri = await downloadToCache(url, filename);
      await MediaLibrary.saveToLibraryAsync(localUri);
      return { ok: true, message: kind === 'image' ? 'Photo enregistrée dans vos photos.' : 'Vidéo enregistrée dans vos vidéos.' };
    }

    const localUri = await downloadToCache(url, filename);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri);
    }
    return { ok: true, message: 'Fichier téléchargé.' };
  } catch (err) {
    console.error('[Messagerie] téléchargement échoué :', err);
    return { ok: false, message: 'Le téléchargement a échoué.' };
  }
}
