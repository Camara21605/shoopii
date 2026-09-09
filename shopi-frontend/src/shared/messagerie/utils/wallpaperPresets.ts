/* ================================================================
 * FICHIER : src/shared/messagerie/utils/wallpaperPresets.ts
 *
 * Fonds d'écran de la messagerie — galerie fermée fournie par le
 * système (façon Telegram/WhatsApp mode sombre : fond noir + motif SVG
 * blanc répété en tuile, data URI, aucun fichier à héberger). Chaque
 * motif est distinct — le fond étant fixé au noir pour tous, c'est le
 * dessin lui-même qui différencie les choix. L'utilisateur sélectionne
 * uniquement parmi cette liste, jamais d'import d'image personnelle.
 * Stocké côté backend sous la forme "preset:<key>" (voir User.chatWallpaper).
 * ================================================================ */

import type { CSSProperties } from 'react';

export interface WallpaperPreset {
  key:     string;
  label:   string;
  pattern: string;
}

/** Fond noir commun à tous les motifs — voir l'en-tête du fichier. */
const BG_BLACK = '#0B0B0D';

function svgTile(inner: string, size: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${inner}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const DOODLES = svgTile(
  `<g fill='none' stroke='#FFFFFF' stroke-opacity='0.14' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M14 18h26a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H26l-8 7v-7h-4a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z'/>
    <path d='M100 30c-3-6-12-6-14 1-2-7-11-7-14-1-3 7 6 15 14 20 8-5 17-13 14-20z'/>
    <path d='M40 92l50-22-16 50-9-20-13 9 3-15z'/>
    <path d='M108 94l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z'/>
  </g>`,
  140,
);

const DOTS = svgTile(
  `<g fill='#FFFFFF' fill-opacity='0.16'>
    <circle cx='10' cy='10' r='1.5'/>
    <circle cx='30' cy='10' r='1.5'/>
    <circle cx='20' cy='25' r='1.5'/>
    <circle cx='10' cy='30' r='1.5'/>
    <circle cx='30' cy='30' r='1.5'/>
  </g>`,
  40,
);

const GRID = svgTile(
  `<g stroke='#FFFFFF' stroke-opacity='0.10' stroke-width='1'>
    <path d='M0 30h60M30 0v60'/>
  </g>`,
  60,
);

const LEAVES = svgTile(
  `<g fill='none' stroke='#FFFFFF' stroke-opacity='0.13' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M20 60c0-22 14-36 30-40-4 20-8 34-30 40z'/>
    <path d='M20 60c8-16 16-26 30-32'/>
    <path d='M90 20c18 6 26 20 22 38-16-6-26-18-22-38z'/>
    <path d='M90 20c4 14 8 24 22 38'/>
  </g>`,
  110,
);

const STARS = svgTile(
  `<g fill='#FFFFFF' fill-opacity='0.15'>
    <path d='M22 8l2.6 6.9L32 17l-7.4 2.1L22 26l-2.6-6.9L12 17l7.4-2.1z'/>
    <path d='M88 46l1.8 4.6L95 52l-5.2 1.4L88 58l-1.8-4.6L81 52l5.2-1.4z'/>
    <circle cx='70' cy='16' r='2.2'/>
    <circle cx='16' cy='70' r='2.2'/>
  </g>
  <path d='M62 78a13 13 0 1 1 0-26 10.5 10.5 0 0 0 0 26z' fill='#FFFFFF' fill-opacity='0.12'/>`,
  100,
);

const WAVES = svgTile(
  `<g fill='none' stroke='#FFFFFF' stroke-opacity='0.12' stroke-width='2' stroke-linecap='round'>
    <path d='M0 20c8-8 16-8 24 0s16 8 24 0 16-8 24 0'/>
    <path d='M0 44c8-8 16-8 24 0s16 8 24 0 16-8 24 0'/>
  </g>`,
  72,
);

const DIAMONDS = svgTile(
  `<g fill='none' stroke='#FFFFFF' stroke-opacity='0.12' stroke-width='1.6'>
    <rect x='16.5' y='16.5' width='17' height='17' transform='rotate(45 25 25)'/>
  </g>`,
  50,
);

const BUBBLES = svgTile(
  `<g fill='none' stroke='#FFFFFF' stroke-opacity='0.13' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M10 14h22a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H22l-6 6v-6h-6a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5z'/>
    <path d='M70 50h30a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H84l-6 6v-6h-8a5 5 0 0 1-5-5V55a5 5 0 0 1 5-5z'/>
  </g>`,
  120,
);

/* Tête de lion — anciennement le fond PAR DÉFAUT, remplacé par "Petits s"
 * ci-dessous (demande explicite) : crinière en 12 mèches rayonnantes
 * (longueurs alternées pour un rendu fourrure plutôt qu'un soleil
 * parfaitement régulier), oreilles, yeux, truffe, moustaches. Tuile plus
 * grande que les autres motifs (240px) pour que le dessin reste lisible
 * et détaillé une fois répété. Conservé comme motif sélectionnable
 * (WALLPAPER_PRESETS) plutôt que supprimé. */
const LION = svgTile(
  `<g stroke='#FFFFFF' stroke-opacity='0.16' stroke-width='3' stroke-linecap='round'>
    <path d='M168 120L208 120M161.6 144L191 161M144 161.6L161 191M120 168L120 202M96 161.6L79 191M78.4 144L49 161M72 120L38 120M78.4 96L49 79M96 78.4L79 49M120 72L120 38M144 78.4L161 49M161.6 96L191 79'/>
  </g>
  <circle cx='120' cy='120' r='46' fill='none' stroke='#FFFFFF' stroke-opacity='0.16' stroke-width='2.6'/>
  <g fill='none' stroke='#FFFFFF' stroke-opacity='0.16' stroke-width='2.6' stroke-linejoin='round'>
    <path d='M92 84L100 64 112 86'/>
    <path d='M148 84L140 64 128 86'/>
  </g>
  <g fill='#FFFFFF' fill-opacity='0.18'>
    <circle cx='104' cy='114' r='3.4'/>
    <circle cx='136' cy='114' r='3.4'/>
    <path d='M114 126h12l-6 8z'/>
  </g>
  <g fill='none' stroke='#FFFFFF' stroke-opacity='0.16' stroke-width='2.2' stroke-linecap='round'>
    <path d='M112 137q8 8 16 0'/>
    <path d='M96 132L80 128M96 138L78 138M96 144L80 150'/>
    <path d='M144 132L160 128M144 138L162 138M144 144L160 150'/>
  </g>`,
  240,
);

/* Petits "s" épars — motif du fond PAR DÉFAUT (voir DEFAULT_WALLPAPER_STYLE
 * plus bas), demandé explicitement à la place de l'ancienne tête de lion :
 * beaucoup de petits "s" fins, sur fond noir comme tous les autres motifs.
 * Tuile petite (36px) et légèrement pivotée à chaque occurrence pour un
 * rendu dispersé plutôt qu'une grille de lettres identiques et alignées. */
const SMALL_S = svgTile(
  `<g fill='#FFFFFF' fill-opacity='0.14' font-family='Georgia, serif' font-weight='700'>
    <text x='2' y='15' font-size='12' transform='rotate(-10 6 10)'>s</text>
    <text x='19' y='32' font-size='10' transform='rotate(14 22 28)'>s</text>
  </g>`,
  36,
);

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { key: 'petits-s', label: 'Petits s',      pattern: SMALL_S  },
  { key: 'doodles',  label: 'Doodles',       pattern: DOODLES  },
  { key: 'dots',     label: 'Points',        pattern: DOTS     },
  { key: 'grid',     label: 'Quadrillage',   pattern: GRID     },
  { key: 'leaves',   label: 'Feuilles',      pattern: LEAVES   },
  { key: 'stars',    label: 'Étoiles',       pattern: STARS    },
  { key: 'waves',    label: 'Vagues',        pattern: WAVES    },
  { key: 'diamonds', label: 'Losanges',      pattern: DIAMONDS },
  { key: 'bubbles',  label: 'Bulles',        pattern: BUBBLES  },
  { key: 'lion',     label: 'Lion',          pattern: LION     },
];

const PRESET_PREFIX = 'preset:';

function styleFor(pattern: string): CSSProperties {
  return { backgroundColor: BG_BLACK, backgroundImage: pattern, backgroundRepeat: 'repeat' };
}

/** Fond réellement appliqué quand l'utilisateur n'a rien choisi ("Aucun")
 *  — noir + petits "s", comme les autres motifs plutôt qu'un simple gris
 *  plat. C'est ce que ChatWindow applique par défaut à toute conversation.
 *  (Remplace l'ancienne tête de lion, désormais un motif sélectionnable
 *  parmi d'autres — voir WALLPAPER_PRESETS — plutôt que le défaut forcé.) */
export const DEFAULT_WALLPAPER_STYLE = styleFor(SMALL_S);

/** Style CSS complet à appliquer sur la zone de messages pour une valeur User.chatWallpaper donnée. */
export function resolveWallpaperStyle(wallpaper: string | null): CSSProperties {
  if (!wallpaper?.startsWith(PRESET_PREFIX)) return DEFAULT_WALLPAPER_STYLE;

  const preset = WALLPAPER_PRESETS.find(p => p.key === wallpaper.slice(PRESET_PREFIX.length));
  if (!preset) return DEFAULT_WALLPAPER_STYLE;

  return styleFor(preset.pattern);
}

/** Style d'aperçu (vignette du sélecteur) — identique au fond réel. */
export function resolveSwatchStyle(preset: WallpaperPreset): CSSProperties {
  return resolveWallpaperStyle(presetKey(preset.key));
}

export function presetKey(key: string): string {
  return `${PRESET_PREFIX}${key}`;
}
