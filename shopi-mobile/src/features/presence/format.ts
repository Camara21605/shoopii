import type { PresenceStatus } from './api';

/** Couleurs des trois états (point sur la photo, texte). */
export const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: '#16A34A',
  reachable: '#F59E0B',
  offline: '#A3A3A3',
};

export const PRESENCE_TITLE: Record<PresenceStatus, string> = {
  online: 'En ligne',
  reachable: 'Joignable',
  offline: 'Hors ligne',
};

/** Explication de chaque état (légende). */
export const PRESENCE_HELP: Record<PresenceStatus, string> = {
  online: 'Dans l’application en ce moment : il voit vos messages tout de suite.',
  reachable: 'Application fermée, mais son téléphone est connecté à internet : votre message ou votre appel lui arrive tout de suite en notification.',
  offline: 'Pas de connexion internet (données coupées, téléphone éteint ou hors réseau) : il recevra votre message dès qu’il se reconnectera.',
};

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier à 14:05 », « le 12 oct. » */
export function seenAgo(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  const d = new Date(t);
  const today = new Date(now);
  const yest = new Date(now - 86_400_000);
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return h <= 3 ? `il y a ${h} h` : `aujourd’hui à ${hm}`;
  if (d.toDateString() === yest.toDateString()) return `hier à ${hm}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })}`;
}

/** Ligne d'état complète : « En ligne » · « Joignable · application fermée » · « Hors ligne · vu il y a 2 h ». */
export function presenceText(status: PresenceStatus, lastSeen: string | null, opts: { short?: boolean; now?: number } = {}): string {
  if (status === 'online') return 'En ligne';
  if (status === 'reachable') return opts.short ? 'Joignable' : 'Joignable · application fermée';
  const ago = seenAgo(lastSeen, opts.now);
  return ago ? `Hors ligne · vu ${ago}` : 'Hors ligne';
}
