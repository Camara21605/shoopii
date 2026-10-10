/* ================================================================
 * FICHIER : src/shared/appearance/theme.ts
 *
 * Correspondance entre le thème enregistré dans le compte client
 * (GET/PATCH /client/parametres/apparence : 'clair' | 'sombre' | 'auto')
 * et la préférence appliquée par ThemeContext ('light' | 'dark' | 'system').
 * ================================================================ */

import type { ThemePreference } from '../context/ThemeContext';

export type AccountTheme = 'clair' | 'sombre' | 'auto';

const TO_PREF: Record<AccountTheme, ThemePreference> = { clair: 'light', sombre: 'dark', auto: 'system' };
const TO_ACCOUNT: Record<ThemePreference, AccountTheme> = { light: 'clair', dark: 'sombre', system: 'auto' };

export const isAccountTheme = (v: unknown): v is AccountTheme => v === 'clair' || v === 'sombre' || v === 'auto';
export const accountToPreference = (t: AccountTheme): ThemePreference => TO_PREF[t];
export const preferenceToAccount = (p: ThemePreference): AccountTheme => TO_ACCOUNT[p];
