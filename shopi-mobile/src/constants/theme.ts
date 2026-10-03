/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1F1F1F',
    background: '#ffffff',
    backgroundElement: '#F6F6F6',
    backgroundSelected: '#FDF0E6',
    textSecondary: '#6B6B6B',
    border: '#E8E8E8',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#2E3135',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Couleurs de marque Shoneya sur mobile (choix du 2026-10-03) : le BLANC est la
 * couleur principale ; l'accent est un ABRICOT doux, utilisé de façon légère et
 * translucide — boutons et pastilles en fond pêche très clair avec texte abricot
 * profond, plutôt qu'un orange vif plein (identité propre, pas celle des grandes
 * marketplaces). Aucune couleur bleue.
 */
export const Brand = {
  /** Accent : icônes, traits, onglet actif, liens. */
  primary: '#E8843F',
  /** Fond pêche très clair, « translucide » : boutons, pastilles, sélection. */
  primarySoft: '#FDF0E6',
  /** Bordure assortie aux fonds pêche. */
  primaryLine: '#F6D3B6',
  /** Texte / icône posé sur un fond pêche (lisible). */
  primaryInk: '#B4561C',
  danger: '#D93025',
  success: '#0F9D58',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
