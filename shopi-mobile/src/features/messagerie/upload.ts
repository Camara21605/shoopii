/**
 * Upload d'une pièce jointe de messagerie (image, vidéo, fichier, message
 * vocal) — mêmes routes que le site (upload.controller.ts) :
 *   POST /upload/image   POST /upload/video   POST /upload/document   POST /upload/audio
 * Champ multipart "file", réponse { url }. apiFetch gère déjà le Bearer et
 * le rafraîchissement de session automatiquement, avec ou sans formData.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const uploadResponseSchema = z.object({ url: z.string() }).passthrough();

/** avatar = photo carrée 400×400 (photo d'un groupe, voir POST /upload/avatar). */
export type UploadKind = 'image' | 'video' | 'document' | 'audio' | 'avatar';

const ENDPOINT: Record<UploadKind, string> = {
  image: '/upload/image',
  video: '/upload/video',
  document: '/upload/document',
  audio: '/upload/audio',
  avatar: '/upload/avatar',
};

/**
 * @param file.uri URI locale (file:// ou content://) du fichier à envoyer.
 */
export async function uploadAttachment(
  kind: UploadKind,
  file: { uri: string; name: string; mimeType: string },
): Promise<string> {
  const formData = new FormData();
  // RN FormData : objet {uri, name, type} plutôt qu'un vrai Blob — envoyé par XMLHttpRequest dans apiFetch (le fetch d'Expo ne lit pas ce format) sur RN.
  formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const res = await apiFetch(ENDPOINT[kind], { method: 'POST', formData, schema: uploadResponseSchema });
  return res.url;
}
