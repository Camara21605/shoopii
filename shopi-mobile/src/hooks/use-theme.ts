/**
 * Couleurs de l'application.
 *
 * Shoneya est volontairement en thème CLAIR (fond blanc) quel que soit le
 * réglage « mode sombre » du téléphone — choix produit du 2026-09-29.
 * Les couleurs sombres restent définies dans constants/theme.ts si l'on
 * veut un jour proposer un mode sombre au choix.
 */
import { Colors } from '@/constants/theme';

export function useTheme() {
  return Colors.light;
}
