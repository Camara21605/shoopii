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
 * au premier coup d'œil (comme WhatsApp) : les miens en VERT CLAIR à droite,
 * ceux reçus en BLANC bordé à gauche, texte foncé des deux côtés.
 * Avant : les miens étaient noirs — photos, fichiers et positions partagées
 * y devenaient illisibles (contenu sombre sur fond noir).
 * La double coche « lu » est BLEUE, sinon on ne voyait pas si l'autre avait lu.
 */
export const ChatBubble = {
  /** Fond du fil de discussion, sous les bulles */
  screen: '#F3F4F6',
  mine: '#DCF5E3',
  mineBorder: 'rgba(18,140,74,0.18)',
  mineText: '#14231A',
  mineMeta: '#5B7666',
  /** Accent de MES bulles : barre de citation, bouton lecture du vocal, icône fichier */
  mineAccent: '#128C4A',
  mineQuoteBar: '#128C4A',
  mineQuoteBg: 'rgba(18,140,74,0.10)',
  /** Fond des éléments posés dans MA bulle (icône fichier, carte de position) */
  mineInset: 'rgba(18,140,74,0.10)',
  theirs: '#FFFFFF',
  theirsBorder: 'rgba(0,0,0,0.09)',
  theirsMeta: '#8A93A3',
  /** Coche « lu » (bleu, lisible sur le vert clair comme sur une photo). */
  read: '#2F9BDB',
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
