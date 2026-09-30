/**
 * Horaires d'une boutique — même calcul que le site (BoutiquePage.tsx::toBoutiqueInfo) :
 * « Ouvert maintenant · jusqu'à 20:00 », « Fermé · ouvre à 08:00 », « Fermé ·
 * ouvre demain à… », fermeture après minuit gérée (18:00 → 02:00 : encore
 * ouvert à 01:00 grâce à la plage de la veille). Heure RÉELLE du téléphone.
 */
import type { ShopHour } from './api';

export const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const BY_GETDAY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const DAY_LABEL: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

/** « 08:00:00 » (colonne Postgres time) → « 08:00 ». */
export const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : null);
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };

export const todayKey = (now = new Date()) => BY_GETDAY[now.getDay()];

/** Jours triés lundi → dimanche, heures au format HH:MM. */
export function sortedHours(list: ShopHour[]) {
  return [...list]
    .sort((a, b) => DAYS.indexOf(a.jour as never) - DAYS.indexOf(b.jour as never))
    .map((h) => ({ ...h, ouverture: hhmm(h.ouverture), fermeture: hhmm(h.fermeture) }));
}

export type OpenStatus = { open: boolean; label: string } | null;

/** null quand la boutique n'a renseigné aucun horaire. */
export function openStatus(list: ShopHour[], now = new Date()): OpenStatus {
  const hours = sortedHours(list);
  if (!hours.some((h) => h.actif && h.ouverture && h.fermeture)) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayAt = (offset: number) => {
    const nom = BY_GETDAY[(now.getDay() + offset + 7) % 7];
    const h = hours.find((x) => x.jour === nom);
    return h && h.actif && h.ouverture && h.fermeture ? { nom, o: toMin(h.ouverture), f: toMin(h.fermeture), debut: h.ouverture, fin: h.fermeture } : null;
  };
  const auj = dayAt(0);
  const veille = dayAt(-1);
  if (veille && veille.f < veille.o && nowMin < veille.f) return { open: true, label: `Ouvert maintenant · jusqu’à ${veille.fin}` };
  if (auj) {
    const ouvert = auj.f > auj.o ? nowMin >= auj.o && nowMin < auj.f : nowMin >= auj.o;
    if (ouvert) return { open: true, label: `Ouvert maintenant · jusqu’à ${auj.fin}` };
    if (nowMin < auj.o) return { open: false, label: `Fermé · ouvre à ${auj.debut}` };
  }
  for (let k = 1; k <= 7; k++) {
    const j = dayAt(k);
    if (j) return { open: false, label: k === 1 ? `Fermé · ouvre demain à ${j.debut}` : `Fermé · ouvre ${DAY_LABEL[j.nom].toLowerCase()} à ${j.debut}` };
  }
  return { open: false, label: 'Fermé aujourd’hui' };
}
