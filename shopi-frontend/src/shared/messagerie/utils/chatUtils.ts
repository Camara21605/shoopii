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

// ── Optimisation des images Cloudinary ─────────────────────────
//
// Les URLs Cloudinary (avatars, photos partagées) étaient jusqu'ici
// utilisées telles quelles dans <img>, donc téléchargées à leur
// résolution d'upload d'origine même quand affichées en 30-50px
// (avatar) — gaspillage de bande passante et ralentissement du
// premier affichage, surtout sur mobile/connexion lente.
//
// Cloudinary permet d'insérer des paramètres de transformation
// directement dans l'URL (sans re-upload) : on ajoute un segment
// juste après "/upload/". f_auto choisit le meilleur format supporté
// par le navigateur (WebP/AVIF), q_auto ajuste la qualité au strict
// nécessaire visuellement.

function cldTransform(url: string, transform: string): string {
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  // Pas une URL Cloudinary reconnue (ou variable d'environnement de
  // stockage différente) → on la laisse inchangée plutôt que de risquer
  // de casser un lien valide.
  if (idx === -1) return url;
  const insertAt = idx + marker.length;
  return `${url.slice(0, insertAt)}${transform}/${url.slice(insertAt)}`;
}

/** Avatar carré recadré sur le visage — taille en px (le composant l'affiche en CSS, ×2 ici pour les écrans retina). */
export function cldAvatar(url: string | null | undefined, size = 64): string | null {
  if (!url) return url ?? null;
  return cldTransform(url, `w_${size},h_${size},c_fill,g_face,q_auto,f_auto`);
}

/** Image partagée dans une bulle de chat — largeur plafonnée, format/qualité auto. Le clic ouvre toujours l'URL ORIGINALE (voir MessageBubble). */
export function cldChatImage(url: string | null | undefined, maxWidth = 480): string | null {
  if (!url) return url ?? null;
  return cldTransform(url, `w_${maxWidth},c_limit,q_auto,f_auto`);
}
