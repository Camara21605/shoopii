import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'shopi_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved ?? 'dark';
  });

  /* useLayoutEffect (pas useEffect) : applique data-theme AVANT que le
   * navigateur peigne. Avec useEffect, la mise à jour du DOM arrive après
   * la 1ère peinture -> un frame visible avec l'ancien thème (flash). */
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setThemeState(t => (t === 'dark' ? 'light' : 'dark'));
  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/**
 * useForceDarkTheme
 *
 * Hook à appeler dans un composant qui NE DOIT JAMAIS s'afficher en mode
 * clair (ex : dashboard entreprise, pages "home" côté client, Centre
 * d'aide…). Au montage, si le thème actuel n'est pas "dark", il le force.
 * Au démontage, il restaure le thème que l'utilisateur avait choisi AVANT
 * d'arriver sur cette page — pour ne pas imposer le mode sombre au reste
 * du site (les dashboards qui ont encore leur propre bouton clair/sombre,
 * par exemple, ne sont pas affectés une fois qu'on les quitte).
 *
 * Comme `theme` est un état GLOBAL (partagé par toute l'app via
 * ThemeProvider), appeler ce hook depuis plusieurs pages en même temps
 * ne pose pas de problème : chaque page force "dark" à son montage et
 * restaure fidèlement ce qu'elle a trouvé à son démontage.
 */
export function useForceDarkTheme(enabled: boolean = true): void {
  const { theme, setTheme } = useTheme();

  useLayoutEffect(() => {
    if (!enabled) return;
    const themeAvantForçage = theme;
    if (theme !== 'dark') setTheme('dark');

    return () => {
      if (themeAvantForçage !== 'dark') setTheme(themeAvantForçage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
