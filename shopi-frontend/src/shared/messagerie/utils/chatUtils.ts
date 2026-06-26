/**
 * src/shared/messagerie/utils/chatUtils.ts
 * Utilitaires partagés entre tous les composants de la messagerie.
 */

export const API_BASE =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api';

/** Formate un nombre de secondes en "m:ss" */
export function fmtDuration(seconds: number): string {
  const m  = Math.floor(seconds / 60);
  const s2 = Math.floor(seconds % 60);
  return `${m}:${String(s2).padStart(2, '0')}`;
}

/** Upload un fichier vers le backend et retourne l'URL Cloudinary. */
export async function uploadToServer(
  file:     File | Blob,
  endpoint: string,
  filename  = 'file',
): Promise<string> {
  const fd    = new FormData();
  fd.append('file', file, filename);
  const token = localStorage.getItem('shopi_access_token') ?? '';
  const res   = await fetch(`${API_BASE}${endpoint}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Erreur ${res.status}`);
  }
  const data: { url: string } = await res.json();
  return data.url;
}
