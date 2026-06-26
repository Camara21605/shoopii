/* ============================================================
 * FICHIER : src/modules/auth/hooks/useOtpInput.ts
 * RÔLE    : Hook pour gérer la saisie d'un code OTP / code
 *           d'activation (navigation clavier, copier-coller,
 *           détection de complétion)
 * ============================================================ */

import { useRef, useCallback } from 'react';

/**
 * Hook useOtpInput
 * @param length - Nombre de cases du code (ex: 6, 8, 10)
 * @param onComplete - Callback appelé quand toutes les cases sont remplies
 */
export function useOtpInput(length: number, onComplete?: (code: string) => void) {
  /* Références vers chaque <input> du code */
  const inputsRef = useRef<Array<HTMLInputElement | null>>(Array(length).fill(null));

  /** Lire la valeur complète du code depuis les refs */
  const getCode = useCallback((): string => {
    return inputsRef.current.map(el => el?.value ?? '').join('');
  }, []);

  /** Vérifie si le code est complet → appelle onComplete */
  const checkComplete = useCallback(() => {
    const code = getCode();
    if (code.length === length && !code.includes('')) {
      onComplete?.(code);
    }
  }, [getCode, length, onComplete]);

  /** Handler onChange : majuscules + alphanumérique + focus suivant */
  const handleChange = useCallback(
    (index: number, value: string) => {
      const el = inputsRef.current[index];
      if (!el) return;
      // Filtrer : uniquement alphanumérique majuscule
      el.value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
      // Avancer au champ suivant
      if (el.value && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      checkComplete();
    },
    [length, checkComplete]
  );

  /** Handler onKeyDown : Backspace et flèches */
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    },
    [length]
  );

  /** Handler onPaste : distribue les caractères collés */
  const handlePaste = useCallback(
    (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData
        .getData('text')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      text.split('').forEach((char, i) => {
        const el = inputsRef.current[index + i];
        if (el) el.value = char;
      });
      const lastFilled = Math.min(index + text.length - 1, length - 1);
      inputsRef.current[lastFilled]?.focus();
      checkComplete();
    },
    [length, checkComplete]
  );

  return { inputsRef, handleChange, handleKeyDown, handlePaste, getCode };
}