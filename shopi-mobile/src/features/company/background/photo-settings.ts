/**
 * Réglages photo du vendeur (gardés sur ce téléphone) — ce que fait
 * « ⚡ Arranger » en un toucher, et le point de départ de « Retoucher » :
 *   style (Auto, Éclatant, Lumineux, Doux, Chaud, Original), intensité,
 *   retirer le fond ou non, fond blanc / transparent, cadrer le produit,
 *   arranger automatiquement chaque nouvelle photo.
 */
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

export type PhotoStyle = 'orig' | 'auto' | 'vivid' | 'bright' | 'soft' | 'warmp';
export type PhotoSettings = {
  style: PhotoStyle;
  /** 0.4 = discret · 0.7 = normal · 1 = fort */
  strength: number;
  removeBg: boolean;
  bg: 'white' | 'transparent';
  crop: boolean;
  /** Arranger chaque photo dès qu'elle est ajoutée (avant l'envoi). */
  autoOnAdd: boolean;
};

export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = { style: 'auto', strength: 0.7, removeBg: false, bg: 'white', crop: true, autoOnAdd: false };

export const STYLES: { key: PhotoStyle; label: string; sub: string }[] = [
  { key: 'auto', label: 'Auto', sub: 'Corrige lumière et couleurs' },
  { key: 'vivid', label: 'Éclatant', sub: 'Couleurs vives, contrasté' },
  { key: 'bright', label: 'Lumineux', sub: 'Pour les photos sombres' },
  { key: 'soft', label: 'Doux', sub: 'Tons clairs et légers' },
  { key: 'warmp', label: 'Chaud', sub: 'Ambiance chaleureuse' },
  { key: 'orig', label: 'Aucun', sub: 'Garder les couleurs' },
];
export const STRENGTHS: { value: number; label: string }[] = [
  { value: 0.4, label: 'Discret' },
  { value: 0.7, label: 'Normal' },
  { value: 1, label: 'Fort' },
];

const file = () => new File(Paths.document, 'photo-settings.json');

function read(): PhotoSettings {
  try {
    const f = file();
    if (!f.exists) return DEFAULT_PHOTO_SETTINGS;
    const raw = JSON.parse(f.textSync()) as Partial<PhotoSettings>;
    return { ...DEFAULT_PHOTO_SETTINGS, ...raw, strength: Math.min(1, Math.max(0.2, Number(raw.strength) || DEFAULT_PHOTO_SETTINGS.strength)) };
  } catch {
    return DEFAULT_PHOTO_SETTINGS;
  }
}

let current: PhotoSettings | null = null;
const listeners = new Set<() => void>();

export function getPhotoSettings(): PhotoSettings {
  if (!current) current = read();
  return current;
}

export function savePhotoSettings(patch: Partial<PhotoSettings>) {
  current = { ...getPhotoSettings(), ...patch };
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(current));
  } catch {
    /* stockage indisponible : réglage gardé pour cette session */
  }
  listeners.forEach((l) => l());
}

export function usePhotoSettings(): PhotoSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getPhotoSettings,
  );
}

/** Ce que l'éditeur reçoit au chargement. */
export const editorOptions = (s: PhotoSettings) => ({ preset: s.style, strength: s.strength, removeBg: s.removeBg, bg: s.bg, crop: s.crop });
