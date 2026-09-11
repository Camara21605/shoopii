/* ============================================================
 * FICHIER : src/modules/auth/hooks/usePasswordStrength.ts
 * RÔLE    : Hook pour calculer la force du mot de passe
 *           et retourner le score, label, couleurs et le détail
 *           de chaque règle (pour un affichage "liste à cocher").
 * ============================================================ */

import { useState, useCallback } from 'react';

export interface PasswordRequirements {
  length:    boolean; // ≥ 8 caractères
  lowercase: boolean;
  uppercase: boolean;
  digit:     boolean;
  special:   boolean;
}

export interface PasswordStrength {
  score: number;          // 0 à 5 (nombre de règles satisfaites)
  label: string;          // Trop faible / Faible / Correct / Bon / Fort / Très fort
  colorClass: string;     // classe CSS du niveau
  requirements: PasswordRequirements;
  /** true seulement quand TOUTES les règles sont satisfaites — c'est
   *  exactement la condition acceptée par le formulaire ET le backend
   *  (voir validateRegisterField('password') dans useLoginPage.ts et
   *  register.dto.ts côté serveur, mêmes 5 règles). */
  valid: boolean;
}

const LABELS = ['Trop faible', 'Faible', 'Correct', 'Bon', 'Fort', 'Très fort'];
/* Seules 4 couleurs existent (login.css .pwd-bar.filled-1..4 : rouge,
 * ambre, lime, vert) pour 5 scores possibles — la plus forte (vert)
 * est réutilisée pour les scores 4 ET 5. */
const COLOR_CLASSES = ['filled-1', 'filled-2', 'filled-3', 'filled-4', 'filled-4'];

const EMPTY_REQUIREMENTS: PasswordRequirements = {
  length: false, lowercase: false, uppercase: false, digit: false, special: false,
};

/**
 * Hook usePasswordStrength
 * Analyse la valeur du mot de passe et renvoie un score de 0 à 5.
 *
 * BUG CORRIGÉ — la minuscule n'était jamais vérifiée ici (seulement
 * longueur/majuscule/chiffre/spécial), alors que le formulaire ET le
 * backend l'exigent tous les deux : un mot de passe pouvait afficher
 * "Très fort" dans la barre tout en étant encore invalide (sans
 * minuscule). Les 5 règles ci-dessous sont désormais EXACTEMENT celles
 * vérifiées à la validation du formulaire et par le serveur.
 */
export function usePasswordStrength() {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    label: 'Entrez un mot de passe',
    colorClass: '',
    requirements: EMPTY_REQUIREMENTS,
    valid: false,
  });
  const [show, setShow] = useState(false);

  const checkStrength = useCallback((value: string) => {
    setShow(value.length > 0);
    if (!value) { setStrength(s => ({ ...s, requirements: EMPTY_REQUIREMENTS, score: 0, valid: false })); return; }

    const requirements: PasswordRequirements = {
      length:    value.length >= 8,
      lowercase: /[a-z]/.test(value),
      uppercase: /[A-Z]/.test(value),
      digit:     /[0-9]/.test(value),
      special:   /[^A-Za-z0-9]/.test(value),
    };
    const score = Object.values(requirements).filter(Boolean).length;
    const valid = score === 5;

    setStrength({
      score,
      label: LABELS[score],
      colorClass: score > 0 ? COLOR_CLASSES[score - 1] : '',
      requirements,
      valid,
    });
  }, []);

  return { strength, show, checkStrength };
}
