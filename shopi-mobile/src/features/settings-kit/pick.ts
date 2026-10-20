/**
 * Choix d'une photo (galerie) ou d'une pièce justificative (PDF / image) avec
 * les mêmes contrôles que le site — format accepté et poids maximal vérifiés
 * AVANT l'envoi, pour un message clair plutôt qu'un refus du serveur.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { confirmPhoto } from '@/components/photo-confirm';
import { shrinkImage } from '@/lib/shrink-image';

import type { LocalFile } from './upload';

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
 * Photo de profil : carrée, JPG / PNG / WebP, 5 MB max (POST …/photo). Après la galerie et le
 * recadrage, un aperçu rond avec un bouton final « Enregistrer la photo » (ou « Choisir une
 * autre photo », qui rouvre la galerie).
 */
export async function pickPhoto(): Promise<Picked> {
  for (;;) {
    const picked = await pickPhotoFromLibrary();
    if (!picked.ok) return picked;
    const choice = await confirmPhoto({ uri: picked.file.uri, shape: 'round', title: 'Nouvelle photo de profil' });
    if (choice === 'ok') return picked;
    if (choice === 'cancel') return { ok: false };
  }
}

async function pickPhotoFromLibrary(): Promise<Picked> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted)
    return {
      ok: false,
      error: 'Autorisez l’accès à vos photos pour choisir une image.',
    };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return { ok: false };
  const a = res.assets[0];
  const name = a.fileName ?? `photo-${Date.now()}.jpg`;
  const mimeType = a.mimeType ?? guessType(name, 'image/jpeg');
  if (!IMAGE_TYPES.includes(mimeType) && !/^image\/(heic|heif)$/i.test(mimeType))
    return {
      ok: false,
      error: 'Format invalide — JPG, PNG ou WebP uniquement',
    };
  /* Réduite à 800 px (JPEG) : jamais refusée par le serveur, envoi rapide. */
  try {
    const small = await shrinkImage(a, 800);
    return { ok: true, file: { uri: small.uri, name: small.name, mimeType: small.mimeType } };
  } catch {
    if (a.fileSize && a.fileSize > 5 * MB) return { ok: false, error: 'Photo trop lourde (max 5 MB)' };
    return { ok: true, file: { uri: a.uri, name, mimeType } };
  }
}

/** Pièce justificative : PDF, JPG, PNG ou WebP, 10 MB max (POST …/documents/:type). */
export async function pickDocument(): Promise<Picked> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', ...IMAGE_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return { ok: false };
  const a = res.assets[0];
  const mimeType = a.mimeType ?? guessType(a.name, 'application/octet-stream');
  if (![...IMAGE_TYPES, 'application/pdf'].includes(mimeType)) return { ok: false, error: 'Format non accepté : PDF, JPG, PNG ou WebP.' };
  if (a.size && a.size > 10 * MB) return { ok: false, error: 'Fichier trop lourd — maximum 10 MB' };
  return { ok: true, file: { uri: a.uri, name: a.name, mimeType } };
}

/** Pièce prise en photo avec l'appareil (plus simple qu'un scan sur téléphone). */
export async function takeDocumentPhoto(): Promise<Picked> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted)
    return {
      ok: false,
      error: 'Autorisez l’appareil photo pour photographier la pièce.',
    };
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return { ok: false };
  const a = res.assets[0];
  /* Pièce photographiée : 2 000 px gardent le texte lisible, pour un fichier léger. */
  try {
    const small = await shrinkImage(a, 2000, 0.85);
    return { ok: true, file: { uri: small.uri, name: `piece-${Date.now()}.jpg`, mimeType: small.mimeType } };
  } catch {
    const name = a.fileName ?? `piece-${Date.now()}.jpg`;
    if (a.fileSize && a.fileSize > 10 * MB) return { ok: false, error: 'Fichier trop lourd — maximum 10 MB' };
    return { ok: true, file: { uri: a.uri, name, mimeType: a.mimeType ?? 'image/jpeg' } };
  }
}
