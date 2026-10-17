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
    backgroundSelected: 'rgba(0,0,0,0.05)',
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
 * couleur principale. Boutons, pastilles et sélections : NOIR TRANSPARENT (fond
 * noir 5 %, bordure noir 12 %, texte gris très foncé) — demande du 2026-10-03.
 * Accents (icônes, onglet actif, liens, bouton « + ») : NOIR. Cartes produit :
 * gris transparent (noir 4 %). Plus d'orange ni de bleu.
 */
export const Brand = {
  /** Accent : icônes, traits, onglet actif, liens (noir). */
  primary: '#1F1F1F',
  /** Fond noir transparent (5 %) : boutons, pastilles, sélection. */
  primarySoft: 'rgba(0,0,0,0.05)',
  /** Bordure noir transparent (12 %). */
  primaryLine: 'rgba(0,0,0,0.12)',
  /** Texte / icône posé sur un fond teinté. */
  primaryInk: '#1F1F1F',
  danger: '#D93025',
  success: '#0F9D58',
} as const;

/**
 * Bulles de la messagerie — MES messages et ceux REÇUS doivent se distinguer
 * au premier coup d'œil (comme WhatsApp) : les miens en NOIR plein, texte
 * blanc, à droite ; les siens en gris clair, texte noir, à gauche.
 * Avant : les deux étaient presque du même gris (noir 5 % vs #F6F6F6).
 * La double coche « lu » est BLEUE, sinon on ne voyait pas si l'autre avait lu.
 */
export const ChatBubble = {
  mine: '#1F1F1F',
  mineText: '#FFFFFF',
  mineMeta: 'rgba(255,255,255,0.72)',
  mineQuoteBar: 'rgba(255,255,255,0.7)',
  mineQuoteBg: 'rgba(255,255,255,0.14)',
  theirs: '#F0F1F3',
  theirsBorder: 'rgba(0,0,0,0.06)',
  theirsMeta: '#8A93A3',
  /** Coche « lu » (bleu, lisible sur le noir comme sur une photo). */
  read: '#53BDEB',
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
