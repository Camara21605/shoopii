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

/** Déplace l'élément identifié par `id` en tête de liste après lui avoir
 *  appliqué `updater` — la conversation (ou le groupe) qui vient de
 *  recevoir/envoyer un message doit toujours remonter en premier, comme
 *  WhatsApp, plutôt que de rester figée à la position du tri initial. */
export function bumpToFront<T extends { id: string }>(
  list: T[],
  id: string,
  updater: (item: T) => T,
): T[] {
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) return list;
  const updated = updater(list[idx]);
  const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
  return [updated, ...rest];
}

/**
 * Dernière connexion d'un contact hors ligne. Renvoie null si la date est inconnue.
 *   complet (en-tête, panneau) : « Vu à l'instant » · « Vu il y a 5 min » · « Vu aujourd'hui à 14:32 »
 *                                · « Vu hier à 14:32 » · « Vu le 12/09/2026 à 14:32 »
 *   court (liste des conversations) : « vu à l'instant » · « vu il y a 5 min » · « vu à 14:32 »
 *                                · « vu hier » · « vu le 12/09 »
 */
export function formatLastSeen(
  iso: string | null | undefined,
  t: (key: string, opts?: Record<string, string | number>) => string,
  locale?: string,
  short = false,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const k = (name: string) => `messagerie.chatHeader.${short ? 'court.' : ''}${name}`;

  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1)  return t(k('vuInstant'));
  if (minutes < 60) return t(k('vuIlYaMin'), { n: minutes });

  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return t(k('vuAujourdhui'), { time });
  if (days === 1) return t(k('vuHier'), { time });
  const date = short
    ? d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
    : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return t(k('vuLe'), { date, time });
}
