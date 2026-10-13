/**
 * Envoi d'un fichier choisi sur le téléphone (multipart). Sur le web,
 * FormData exige un vrai fichier : l'objet { uri, name, type } de React
 * Native n'y est pas compris (le serveur répondait 400).
 */
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';

export type LocalFile = { uri: string; name: string; mimeType: string };

export async function appendFile(formData: FormData, field: string, file: LocalFile) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    formData.append(field, new File([blob], file.name, { type: file.mimeType }));
  } else {
    // RN FormData : objet {uri, name, type} — pris en charge nativement par fetch.
    formData.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
}

/** POST multipart d'un ou plusieurs fichiers sous le même nom de champ. */
export async function uploadFiles(url: string, field: string, files: LocalFile[]) {
  const formData = new FormData();
  for (const f of files) await appendFile(formData, field, f);
  return apiFetch<Record<string, unknown>>(url, { method: 'POST', formData });
}
