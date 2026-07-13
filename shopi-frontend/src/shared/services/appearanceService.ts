/* ================================================================
 * FICHIER : src/shared/services/appearanceService.ts
 *
 * RÔLE : Service frontend pour la gestion des préférences
 *        d'apparence du dashboard administrateur Shopi.
 *
 * RESPONSABILITÉS :
 *   1. Types TypeScript des préférences d'apparence
 *   2. Appels API vers le backend (GET / PUT / POST reset)
 *   3. Application des préférences via CSS variables + data-theme
 *   4. Chargement dynamique des polices Google Fonts
 *   5. Écoute du changement de thème système (mode auto)
 *   6. Export / import JSON pour la portabilité des prefs
 * ================================================================ */

import { apiFetch } from './apiFetch';

/* ─── Types ────────────────────────────────────────────────────── */

export type ThemeMode    = 'light' | 'dark' | 'auto';
export type AccentColor  = 'blue' | 'teal' | 'violet' | 'emerald' | 'amber' | 'rose';
export type FontFamily   = 'DM Sans' | 'Inter' | 'Roboto' | 'Poppins' | 'Nunito';
export type FontScale    = 'normal' | 'grand' | 'tres-grand';
export type Density      = 'compact' | 'normal' | 'comfortable';
export type BorderRadius = 'small' | 'medium' | 'large';

export interface AppearancePrefs {
  theme:             ThemeMode;
  accentColor:       AccentColor;
  fontFamily:        FontFamily;
  fontScale:         FontScale;
  density:           Density;
  borderRadius:      BorderRadius;
  sidebarCollapsed:  boolean;
  animationsEnabled: boolean;
  highContrast:      boolean;
  reduceMotion:      boolean;
}

/* ─── Valeurs par défaut du design system Shopi ────────────────── */

export const DEFAULT_PREFS: Readonly<AppearancePrefs> = {
  theme:             'light',
  accentColor:       'blue',
  fontFamily:        'DM Sans',
  fontScale:         'normal',
  density:           'normal',
  borderRadius:      'medium',
  sidebarCollapsed:  false,
  animationsEnabled: true,
  highContrast:      false,
  reduceMotion:      false,
};

/* ─── Design tokens des palettes ───────────────────────────────── */

/** Couleur principale de chaque accent */
const ACCENT_MAIN: Record<AccentColor, string> = {
  blue:    '#1A4FC4',
  teal:    '#0E7490',
  violet:  '#7C3AED',
  emerald: '#059669',
  amber:   '#D97706',
  rose:    '#E11D48',
};

/** Couleur claire (fond hover, badges) */
const ACCENT_LIGHT: Record<AccentColor, string> = {
  blue:    '#EEF3FD',
  teal:    '#E0F5F9',
  violet:  '#F3EEFF',
  emerald: '#ECFDF5',
  amber:   '#FEF3C7',
  rose:    '#FFF1F2',
};

/** Variante intermédiaire (sky-2 / sky-3 utilisées dans le design system) */
const ACCENT_MID: Record<AccentColor, string> = {
  blue:    '#C8D9F8',
  teal:    '#B5E8F0',
  violet:  '#DDD0FF',
  emerald: '#A7F3D0',
  amber:   '#FDE68A',
  rose:    '#FECDD3',
};

/** Valeur RGB séparée pour les fonctions rgba() dans les ombres */
const ACCENT_RGB: Record<AccentColor, string> = {
  blue:    '26,79,196',
  teal:    '14,116,144',
  violet:  '124,58,237',
  emerald: '5,150,105',
  amber:   '217,119,6',
  rose:    '225,29,72',
};

/** Bouton primary en mode sombre : variante plus claire pour la lisibilité sur fond sombre */
const ACCENT_DARK_BTN: Record<AccentColor, string> = {
  blue:    '#4A7EF0',
  teal:    '#22B8D1',
  violet:  '#9F67E8',
  emerald: '#34C882',
  amber:   '#F59E0B',
  rose:    '#FB4D7A',
};

/** Font-size de l'élément html selon l'échelle */
const FONT_SIZE_MAP: Record<FontScale, string> = {
  'normal':     '15px',   /* taille par défaut du design system */
  'grand':      '16px',
  'tres-grand': '17px',
};

/** Espacement base (gap) selon la densité */
const DENSITY_GAP: Record<Density, string> = {
  compact:     '0.5rem',
  normal:      '0.75rem',
  comfortable: '1rem',
};

/** Padding des éléments selon la densité */
const DENSITY_PAD: Record<Density, string> = {
  compact:     '0.5rem 0.75rem',
  normal:      '0.75rem 1rem',
  comfortable: '1rem 1.25rem',
};

/** Jeu de rayons selon le preset */
const RADIUS: Record<BorderRadius, { sm: string; md: string; lg: string; xl: string }> = {
  small:  { sm: '4px',  md: '6px',  lg: '10px', xl: '14px' },
  medium: { sm: '6px',  md: '12px', lg: '18px', xl: '26px' },
  large:  { sm: '10px', md: '18px', lg: '26px', xl: '36px' },
};

/* ─── ID du <style> injecté dans <head> ────────────────────────── */
const STYLE_ID = 'shopi-appearance-vars';

/* ─── Référence à l'écouteur de thème système (pour cleanup) ───── */
let _mediaListener: (() => void) | null = null;

/* ════════════════════════════════════════════════════════════════
 * APPLICATION DES CSS VARIABLES
 * ════════════════════════════════════════════════════════════════ */

/**
 * Applique toutes les préférences d'apparence au DOM immédiatement.
 *
 * Mécanisme :
 *   - Attribut data-theme sur <html> → permet des règles CSS [data-theme="dark"]
 *   - Un <style id="shopi-appearance-vars"> injecté dans <head>
 *     contient les overrides de variables CSS :root
 *     (priorité maximale, écrase les valeurs de variables.css)
 *
 * Cette fonction est idempotente et sans effet de bord.
 * Elle peut être appelée à chaque changement de préférence
 * pour le live preview.
 */
export function applyPrefs(prefs: AppearancePrefs): void {
  const root = document.documentElement;

  /* ── 1. Thème : clair / sombre / automatique ── */
  const isDark =
    prefs.theme === 'dark' ||
    (prefs.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme', isDark ? 'dark' : 'light');

  /* ── 2. Data-attributes pour l'accessibilité ── */
  if (prefs.reduceMotion) {
    root.setAttribute('data-reduce-motion', 'true');
  } else {
    root.removeAttribute('data-reduce-motion');
  }

  /* ── 3. Chargement de la police si ce n'est pas DM Sans (default) ── */
  if (prefs.fontFamily !== 'DM Sans') {
    _loadGoogleFont(prefs.fontFamily);
  }

  /* ── 4. Génération du bloc CSS ── */
  const accent = prefs.accentColor;
  const rgb    = ACCENT_RGB[accent];
  const r      = RADIUS[prefs.borderRadius] ?? RADIUS.medium;
  const noAnim = !prefs.animationsEnabled || prefs.reduceMotion;

  const css = `
/* === Shopi Appearance Overrides — générés dynamiquement === */

/* Tokens globaux (accent, police, rayons, densité) — indépendants du thème */
:root {
  --blue:    ${ACCENT_MAIN[accent]};
  --blue-2:  ${ACCENT_MAIN[accent]};
  --blue-3:  ${ACCENT_MAIN[accent]};
  --blue-lt: ${ACCENT_MAIN[accent]};
  --fb:      '${prefs.fontFamily}', 'DM Sans', system-ui, sans-serif;
  font-size: ${FONT_SIZE_MAP[prefs.fontScale] ?? '15px'};
  --r-sm:    ${r.sm};
  --r-md:    ${r.md};
  --r-lg:    ${r.lg};
  --r-xl:    ${r.xl};
  --density-gap: ${DENSITY_GAP[prefs.density] ?? '0.75rem'};
  --density-pad: ${DENSITY_PAD[prefs.density] ?? '0.75rem 1rem'};
  --transition-speed: ${noAnim ? '0s' : '0.2s'};
}

body, button, input, select, textarea {
  font-family: var(--fb);
}

/* Mode clair — tokens accent + surfaces claires */
:root[data-theme="light"] {
  --sky:            ${ACCENT_LIGHT[accent]};
  --sky-2:          ${ACCENT_LIGHT[accent]};
  --sky-3:          ${ACCENT_MID[accent]};
  --bdrb:           rgba(${rgb},.30);
  --sh-b:           0 8px 32px rgba(${rgb},.32);
  --heading-color:  var(--navy);
  --btn-primary-bg: var(--navy);
  --topbar-bg:      rgba(255,255,255,.96);
  --topbar-border:  var(--bdr);
}

/* Mode sombre — inversion des surfaces + tokens accent adaptés */
:root[data-theme="dark"] {
  --white:  #1C2B3A;
  --g50:    #0F1923;
  --g100:   #172333;
  --g200:   #1F3044;
  --g300:   #2B3E54;
  --g400:   #5E7A93;
  --t1:     #DEE9F7;
  --t2:     #86A0BC;
  --t3:     #4E6D88;
  --t4:     #344F68;
  --bdr:    rgba(255,255,255,.06);
  --bdr2:   rgba(255,255,255,.10);
  --sky:    rgba(${rgb},.14);
  --sky-2:  rgba(${rgb},.09);
  --sky-3:  rgba(${rgb},.06);
  --bdrb:   rgba(${rgb},.35);
  --sh-b:   0 8px 32px rgba(${rgb},.20);
  --em-bg:  rgba(4,120,87,.18);
  --vl-bg:  rgba(109,40,217,.18);
  --am-bg:  rgba(180,83,9,.18);
  --heading-color:  #DEE9F7;
  --btn-primary-bg: ${ACCENT_DARK_BTN[accent]};
  --topbar-bg:      rgba(15,25,35,.96);
  --topbar-border:  rgba(255,255,255,.06);
}

${prefs.highContrast ? `
:root[data-theme="light"] { --t1: #000; --t2: #1a1a1a; --bdr: rgba(0,0,0,.35); --bdr2: rgba(0,0,0,.55); }
:root[data-theme="dark"]  { --t1: #fff; --t2: #e5e5e5; --bdr: rgba(255,255,255,.35); --bdr2: rgba(255,255,255,.55); }
` : ''}

${noAnim ? `
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
` : ''}
`.trim();

  /* Injecter ou mettre à jour le <style> d'overrides */
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

/* ─── Chargement de police via Google Fonts CDN ─────────────────
 * (le CDN est accessible car on est dans l'app, pas un Artifact) */
function _loadGoogleFont(family: string): void {
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return; /* déjà chargé */

  const link  = document.createElement('link');
  link.id     = id;
  link.rel    = 'stylesheet';
  link.href   = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/* ════════════════════════════════════════════════════════════════
 * ÉCOUTE DU THÈME SYSTÈME (MODE AUTO)
 * ════════════════════════════════════════════════════════════════ */

/**
 * Active ou désactive l'écoute de prefers-color-scheme.
 * En mode 'auto', le thème se met à jour dès que l'utilisateur
 * change la préférence de son OS (bascule jour/nuit).
 *
 * Doit être appelé après chaque changement de la préférence `theme`.
 */
export function watchAutoTheme(prefs: AppearancePrefs): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  /* Retirer l'écouteur précédent pour éviter les doublons */
  if (_mediaListener) {
    mq.removeEventListener('change', _mediaListener);
    _mediaListener = null;
  }

  if (prefs.theme === 'auto') {
    /* Recalculer le thème à chaque changement système */
    _mediaListener = () => applyPrefs(prefs);
    mq.addEventListener('change', _mediaListener);
  }
}

/* ════════════════════════════════════════════════════════════════
 * APPELS API
 * ════════════════════════════════════════════════════════════════ */

/**
 * Charge les préférences depuis le backend.
 * Fusionne avec les DEFAULT_PREFS pour les champs absents
 * (garantit la cohérence même si l'entité évolue en base).
 */
export async function fetchPrefs(): Promise<AppearancePrefs> {
  const raw = await apiFetch<Record<string, unknown>>('/appearance');
  return _extractPrefs(raw);
}

/** Sauvegarde les préférences au backend (PUT /api/appearance) */
export async function savePrefs(prefs: AppearancePrefs): Promise<AppearancePrefs> {
  const raw = await apiFetch<Record<string, unknown>>('/appearance', {
    method: 'PUT',
    body:   prefs,
  });
  return _extractPrefs(raw);
}

/** Réinitialise les préférences aux valeurs par défaut (POST /api/appearance/reset) */
export async function resetPrefs(): Promise<AppearancePrefs> {
  const raw = await apiFetch<Record<string, unknown>>('/appearance/reset', { method: 'POST' });
  return _extractPrefs(raw);
}

/** Extrait les champs de préférence d'une réponse API brute */
function _extractPrefs(raw: Record<string, unknown>): AppearancePrefs {
  return {
    theme:             (raw.theme             as ThemeMode)    ?? DEFAULT_PREFS.theme,
    accentColor:       (raw.accentColor        as AccentColor)  ?? DEFAULT_PREFS.accentColor,
    fontFamily:        (raw.fontFamily         as FontFamily)   ?? DEFAULT_PREFS.fontFamily,
    fontScale:         (raw.fontScale          as FontScale)    ?? DEFAULT_PREFS.fontScale,
    density:           (raw.density            as Density)      ?? DEFAULT_PREFS.density,
    borderRadius:      (raw.borderRadius       as BorderRadius) ?? DEFAULT_PREFS.borderRadius,
    sidebarCollapsed:  (raw.sidebarCollapsed   as boolean)      ?? DEFAULT_PREFS.sidebarCollapsed,
    animationsEnabled: (raw.animationsEnabled  as boolean)      ?? DEFAULT_PREFS.animationsEnabled,
    highContrast:      (raw.highContrast       as boolean)      ?? DEFAULT_PREFS.highContrast,
    reduceMotion:      (raw.reduceMotion       as boolean)      ?? DEFAULT_PREFS.reduceMotion,
  };
}

/* ════════════════════════════════════════════════════════════════
 * EXPORT / IMPORT JSON
 * ════════════════════════════════════════════════════════════════ */

/**
 * Exporte les préférences actuelles dans un fichier JSON téléchargeable.
 * Le fichier inclut un champ `version` pour la compatibilité future.
 */
export function exportPrefsJson(
  prefs: AppearancePrefs,
  filename = 'shopi-apparence.json',
): void {
  const payload = JSON.stringify({ version: 1, prefs }, null, 2);
  const blob    = new Blob([payload], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Lit un fichier JSON importé et retourne les préférences parsées.
 * Les champs manquants sont remplacés par les valeurs par défaut.
 * Rejette la promesse si le fichier est invalide ou corrompu.
 */
export function importPrefsJson(file: File): Promise<AppearancePrefs> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as {
          version?: number;
          prefs?: Record<string, unknown>;
        };

        if (!parsed.prefs) {
          throw new Error('Clé "prefs" absente dans le fichier JSON.');
        }

        /* Fusion sécurisée avec les defaults */
        resolve({ ...DEFAULT_PREFS, ..._extractPrefs(parsed.prefs) });
      } catch (err: unknown) {
        reject(new Error(
          err instanceof Error ? err.message : 'Fichier JSON invalide ou corrompu.'
        ));
      }
    };

    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsText(file, 'utf-8');
  });
}
