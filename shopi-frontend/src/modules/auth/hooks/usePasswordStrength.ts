/* ============================================================
 * FICHIER : src/modules/auth/hooks/usePasswordStrength.ts
 * RÔLE    : Hook pour calculer la force du mot de passe
 *           et retourner le score (0-4), label et couleurs
 * ============================================================ */

import { useState, useCallback } from 'react';

export interface PasswordStrength {
  score: number;          // 0 à 4
  label: string;          // Trop faible / Faible / Correct / Fort / Très fort
  colorClass: string;     // classe CSS du niveau
}

const LABELS = ['Trop faible', 'Faible', 'Correct', 'Fort', 'Très fort'];
const COLOR_CLASSES = ['filled-1', 'filled-2', 'filled-3', 'filled-4'];

/**
 * Hook usePasswordStrength
 * Analyse la valeur du mot de passe et renvoie un score de 0 à 4.
 * Critères : longueur ≥ 8, majuscule, chiffre, caractère spécial.
 */
export function usePasswordStrength() {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    label: 'Entrez un mot de passe',
    colorClass: '',
  });
  const [show, setShow] = useState(false);

  const checkStrength = useCallback((value: string) => {
    setShow(value.length > 0);
    if (!value) return;

    let score = 0;
    if (value.length >= 8)           score++;
    if (/[A-Z]/.test(value))         score++;
    if (/[0-9]/.test(value))         score++;
    if (/[^A-Za-z0-9]/.test(value))  score++;

    setStrength({
      score,
      label: LABELS[score],
      colorClass: score > 0 ? COLOR_CLASSES[score - 1] : '',
    });
  }, []);

  return { strength, show, checkStrength };
}