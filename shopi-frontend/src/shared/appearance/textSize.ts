/* ================================================================
 * FICHIER : src/shared/appearance/textSize.ts
 *
 * Taille du texte choisie dans Paramètres → Apparence, appliquée à TOUTE
 * l'application (avant : la préférence était enregistrée mais ne changeait rien).
 * Le site est dimensionné en pixels : le réglage agit donc par agrandissement
 * de la page (`zoom` sur <html>, pris en charge par Chrome, Edge, Safari et
 * Firefox ≥ 126). Mémorisé dans le navigateur pour s'appliquer dès le premier
 * affichage, sans attendre l'API.
 * ================================================================ */

export type TextSize = 'normal' | 'grand' | 'tres_grand';

const KEY = 'shoneya.textSize';
const ZOOM: Record<TextSize, string> = { normal: '', grand: '1.1', tres_grand: '1.22' };

export const isTextSize = (v: unknown): v is TextSize => v === 'normal' || v === 'grand' || v === 'tres_grand';

export function applyTextSize(size: TextSize): void {
  const root = document.documentElement;
  if (size === 'normal') { root.style.removeProperty('zoom'); delete root.dataset.textSize; }
  else                   { root.style.setProperty('zoom', ZOOM[size]); root.dataset.textSize = size; }
}

export function readStoredTextSize(): TextSize {
  try { const v = localStorage.getItem(KEY); return isTextSize(v) ? v : 'normal'; }
  catch { return 'normal'; }
}

export function storeTextSize(size: TextSize): void {
  try { localStorage.setItem(KEY, size); } catch { /* préférence non conservée (navigation privée) */ }
}

/** À appeler une fois au démarrage (main.tsx). */
export function initTextSize(): void {
  applyTextSize(readStoredTextSize());
}
