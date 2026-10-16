/**
 * Choix d'une image (galerie) ou d'un document (PDF / image) avec les mêmes
 * contrôles que le site : format accepté et poids maximal, vérifiés AVANT
 * l'envoi pour un message clair plutôt qu'un refus du serveur.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { confirmPhoto } from '@/components/photo-confirm';

import type { LocalFile } from '../api';

export type Picked = { ok: true; file: LocalFile } | { ok: false; error?: string };

const MB = 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const guessType = (name: string, fallback: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return fallback;
};

/**
 * Image de la galerie, recadrée au format demandé (logo carré, couverture 3:1), puis aperçu
 * avec un bouton final « Enregistrer » (ou « Choisir une autre photo »).
 */
export async function pickImage(aspect: [number, number], maxMb: number): Promise<Picked> {
  const wide = aspect[0] > aspect[1];
  for (;;) {
    const picked = await pickFromLibrary(aspect, maxMb);
    if (!picked.ok) return picked;
    const choice = await confirmPhoto({
      uri: picked.file.uri,
      shape: wide ? 'wide' : 'square',
      title: wide ? 'Nouvelle image de couverture' : 'Nouveau logo',
      confirmLabel: wide ? 'Enregistrer la couverture' : 'Enregistrer le logo',
    });
    if (choice === 'ok') return picked;
    if (choice === 'cancel') return { ok: false };
  }
}

async function pickFromLibrary(aspect: [number, number], maxMb: number): Promise<Picked> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, error: 'Autorisez l’accès à vos photos pour choisir une image.' };
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.85 });
  if (res.canceled || !res.assets[0]) return { ok: false };
  const a = res.assets[0];
  const name = a.fileName ?? `image-${Date.now()}.jpg`;
  const mimeType = a.mimeType ?? guessType(name, 'image/jpeg');
  if (!IMAGE_TYPES.includes(mimeType)) return { ok: false, error: 'Format invalide (JPG, PNG, WebP)' };
  if (a.fileSize && a.fileSize > maxMb * MB) return { ok: false, error: `Image trop lourde (max ${maxMb} MB)` };
  return { ok: true, file: { uri: a.uri, name, mimeType } };
}

/** Document légal : PDF, JPG, PNG ou WebP, 10 MB max. */
export async function pickDocument(): Promise<Picked> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', ...IMAGE_TYPES], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return { ok: false };
  const a = res.assets[0];
  const mimeType = a.mimeType ?? guessType(a.name, 'application/octet-stream');
  if (![...IMAGE_TYPES, 'application/pdf'].includes(mimeType)) return { ok: false, error: 'Format non accepté : PDF, JPG, PNG ou WebP uniquement' };
  if (a.size && a.size > 10 * MB) return { ok: false, error: 'Fichier trop lourd (max 10 MB)' };
  return { ok: true, file: { uri: a.uri, name: a.name, mimeType } };
}
