/* ================================================================
 * FICHIER : src/modules/commande/components/CodeInput.tsx
 *
 * Saisie d'un code à 6 caractères (lettres + chiffres) en cases séparées.
 *  - auto-focus sur la case suivante
 *  - retour arrière intelligent
 *  - collage d'un code complet
 *  - animation d'erreur (prop `error`)
 * ================================================================ */

import { useRef, useState, useEffect } from 'react';
import styles from '../styles/CodeInput.module.css';

interface CodeInputProps {
  length?:  number;            // nombre de cases (défaut 6)
  error?:   boolean;           // déclenche l'animation d'erreur
  onComplete?: (code: string) => void;  // appelé quand toutes les cases sont remplies
  onChange?:   (code: string) => void;
}

export default function CodeInput({ length = 6, error, onComplete, onChange }: CodeInputProps) {
  const [vals, setVals] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  /* Animation d'erreur → on vide les cases */
  useEffect(() => {
    if (error) setVals(Array(length).fill(''));
  }, [error, length]);

  function update(next: string[]) {
    setVals(next);
    const code = next.join('');
    onChange?.(code);
    if (code.length === length && !next.includes('')) onComplete?.(code);
  }

  function handleInput(i: number, raw: string) {
    const char = raw.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();   // garde 1 caractère alphanumérique
    const next = [...vals];
    next[i] = char;
    update(next);
    if (char && refs.current[i + 1]) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !vals[i] && refs.current[i - 1]) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const chars = (e.clipboardData.getData('text').match(/[a-zA-Z0-9]/g) || []).slice(0, length).map(c => c.toUpperCase());
    const next = Array(length).fill('').map((_, j) => chars[j] ?? '');
    update(next);
    const lastIdx = Math.min(chars.length, length) - 1;
    if (lastIdx >= 0) refs.current[lastIdx]?.focus();
  }

  return (
    <div className={styles.inputs} onPaste={handlePaste}>
      {vals.map((v, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          className={`${styles.box} ${v ? styles.filled : ''} ${error ? styles.err : ''}`}
          value={v}
          maxLength={1}
          inputMode="text"
          autoCapitalize="characters"
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}