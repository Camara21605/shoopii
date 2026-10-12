/* ================================================================
 * FICHIER : src/shared/context/ThemeContext.tsx
 *
 * THÈME CLAIR / SOMBRE
 *
 *   préférence (choisie par l'utilisateur, mémorisée) :
 *     'light' | 'dark' | 'system' (suit le réglage de l'appareil)
 *   thème appliqué (`theme`) :
 *     'dark' si une page force le sombre (useForceDarkTheme),
 *     sinon la préférence résolue.
 *
 *   Appliqué sur <html data-theme="…">, + color-scheme (barres de
 *   défilement, champs natifs) et <meta name="theme-color"> (barre
 *   d'état du navigateur mobile).
 *
 *   La préférence est conservée dans localStorage (clé historique
 *   `shopi_theme`, lue aussi par le script inline de index.html pour
 *   éviter tout flash au chargement) et, pour un client connecté, dans
 *   son compte (Paramètres → Apparence, voir AppContext).
 *
 *   Forçage du sombre : les pages pas encore prêtes pour le mode clair
 *   (dashboards, Centre d'aide, support…) appellent useForceDarkTheme().
 *   C'est un compteur : le forçage ne modifie JAMAIS la préférence
 *   enregistrée (avant, il la réécrivait et pouvait la perdre).
 * ================================================================ */

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

interface ThemeContextValue {
  /** Thème réellement appliqué */
  theme:         Theme;
  /** Choix de l'utilisateur */
  preference:    ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Compatibilité (bouton clair/sombre des dashboards) : fixe une préférence explicite */
  setTheme:      (t: Theme) => void;
  toggleTheme:   () => void;
  /** Interne — utilisé par useForceDarkTheme */
  pushForceDark: () => () => void;
}

const STORAGE_KEY = 'shopi_theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#000000', light: '#FFFFFF' };

const isThemePreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

/* Jamais choisi sur cet appareil → CLAIR : le mode clair est prioritaire
 * (home et espace entreprise, oct. 2026). Même défaut que le script inline
 * de index.html et que le serveur (thème du compte jamais choisi = 'clair').
 * Les pages pas encore prêtes restent forcées en sombre (useForceDarkTheme). */
const DEFAULT_PREFERENCE: ThemePreference = 'light';

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(v) ? v : DEFAULT_PREFERENCE;
  } catch { return DEFAULT_PREFERENCE; }
}

const systemQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark', preference: 'dark',
  setPreference: () => {}, setTheme: () => {}, toggleTheme: () => {},
  pushForceDark: () => () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemLight, setSystemLight]    = useState<boolean>(() => !!systemQuery()?.matches);
  const [forceDark, setForceDark]        = useState(0);

  /* Suit le réglage de l'appareil en direct (mode « Automatique ») */
  useLayoutEffect(() => {
    const mq = systemQuery();
    if (!mq) return;
    const onChange = () => setSystemLight(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved: Theme = preference === 'system' ? (systemLight ? 'light' : 'dark') : preference;
  const theme: Theme = forceDark > 0 ? 'dark' : resolved;

  /* useLayoutEffect : appliqué AVANT que le navigateur peigne (pas de flash) */
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try { localStorage.setItem(STORAGE_KEY, p); } catch { /* navigation privée */ }
  }, []);

  const pushForceDark = useCallback(() => {
    setForceDark(n => n + 1);
    return () => setForceDark(n => Math.max(0, n - 1));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme, preference, setPreference,
    setTheme:    (t: Theme) => setPreference(t),
    toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    pushForceDark,
  }), [theme, preference, setPreference, pushForceDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * useForceDarkTheme — à appeler dans une page qui ne doit pas (encore)
 * s'afficher en mode clair. Force le sombre tant que la page est montée,
 * sans toucher à la préférence de l'utilisateur.
 */
export function useForceDarkTheme(enabled: boolean = true): void {
  const { pushForceDark } = useTheme();
  useLayoutEffect(() => {
    if (!enabled) return;
    return pushForceDark();
  }, [enabled, pushForceDark]);
}
