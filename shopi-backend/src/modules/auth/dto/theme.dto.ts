/* ============================================================
 * FICHIER : src/modules/auth/dto/theme.dto.ts
 * PATCH /auth/theme — thème d'affichage de l'utilisateur connecté.
 * ============================================================ */

import { IsIn } from 'class-validator';

export const THEME_VALUES = ['clair', 'sombre', 'auto'] as const;
export type ThemeValue = typeof THEME_VALUES[number];

export class UpdateThemeDto {
  @IsIn(THEME_VALUES, { message: "Le thème doit être 'clair', 'sombre' ou 'auto'." })
  theme: ThemeValue;
}
