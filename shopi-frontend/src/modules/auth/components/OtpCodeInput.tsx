/* ============================================================
 * FICHIER : src/modules/auth/components/OtpCodeInput.tsx
 *
 * BUGS CORRIGÉS :
 *
 *  1. onComplete appelé a CHAQUE frappe (pas seulement quand complet)
 *     -> activationCode est mis a jour en temps reel dans le parent
 *     -> la validation useAuth lit toujours la valeur la plus recente
 *
 *  2. Re-render React ne vide plus les cases
 *     -> le composant est "uncontrolled" pour les inputs DOM
 *     -> seul le reset explicite (value='') vide les cases
 *
 *  3. Pre-remplissage depuis l'URL (?code=XXXX-XXXX-XX)
 *     -> useEffect sur prefilledCode distribue les chars dans les cases
 *
 *  4. isComplete est un state React (pas recalcule depuis le DOM)
 *     -> le style vert s'affiche correctement
 *
 *  5. checkComplete corrige : every() au lieu de includes('')
 * ============================================================ */

import React, {
  useRef, useEffect, useState,
  ClipboardEvent,
   KeyboardEvent,
} from 'react';

interface OtpCodeInputProps {
  length?: number;
  onComplete?: (code: string) => void;
  value?: string;
}

export const OtpCodeInput: React.FC<OtpCodeInputProps> = ({
  length    = 10,
  onComplete,
  value     = '',
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>(Array(length).fill(null));
  const [isComplete, setIsComplete] = useState(false);

  const getRawCode = (): string =>
    inputsRef.current.map(el => el?.value ?? '').join('');

  const focusAt = (idx: number) => inputsRef.current[idx]?.focus();

  /*
   * notifyParent()
   * Appele apres CHAQUE modification d'une case.
   *
   * CLE DU FIX : on notifie le parent a CHAQUE frappe,
   * pas seulement quand le code est complet.
   * Ainsi validateRegister() dans useAuth lit toujours
   * la bonne valeur, meme si l'utilisateur clique
   * "Creer mon compte" juste apres avoir rempli la
   * derniere case (avant le prochain render React).
   */
  const notifyParent = () => {
    const raw   = getRawCode();
    const all10 = inputsRef.current.every(el => (el?.value ?? '').length === 1);

    setIsComplete(all10);

    if (all10) {
      // Code complet : formate XXXX-XXXX-XX pour le backend
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
      onComplete?.(formatted);
    } else {
      // Code partiel : transmet quand meme pour garder le parent a jour
      onComplete?.(raw);
    }
  };

  /*
   * Pre-remplissage depuis l'URL (?code=XXXX-XXXX-XX)
   * ou reset quand value redevient ''.
   */
  useEffect(() => {
    if (!value) {
      inputsRef.current.forEach(el => { if (el) el.value = ''; });
      setIsComplete(false);
      return;
    }

    const clean = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, length);
    if (!clean) return;

    clean.split('').forEach((char, i) => {
      const el = inputsRef.current[i];
      if (el) el.value = char;
    });

    notifyParent();

    const firstEmpty = inputsRef.current.findIndex(el => !el?.value);
    if (firstEmpty !== -1) focusAt(firstEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* Saisie d'un caractere */
  const handleChange = (idx: number, raw: string) => {
    const char = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    const el   = inputsRef.current[idx];
    if (!el) return;
    el.value = char;
    if (char && idx < length - 1) focusAt(idx + 1);
    notifyParent();
  };

  /* Navigation clavier */
  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const el = inputsRef.current[idx];
      if (el?.value) {
        el.value = '';
        notifyParent();
      } else if (idx > 0) {
        const prev = inputsRef.current[idx - 1];
        if (prev) {
          prev.value = '';
          focusAt(idx - 1);
          notifyParent();
        }
      }
    } else if (e.key === 'ArrowLeft'  && idx > 0)          focusAt(idx - 1);
    else if   (e.key === 'ArrowRight' && idx < length - 1) focusAt(idx + 1);
  };

  /* Coller depuis le presse-papiers */
  const handlePaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, length - idx);

    pasted.split('').forEach((char, i) => {
      const el = inputsRef.current[idx + i];
      if (el) el.value = char;
    });

    focusAt(Math.min(idx + pasted.length, length - 1));
    notifyParent();
  };

  /* Groupes visuels : 4 - 4 - 2 */
  const groups = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]];

  return (
    <div
      className="code-input-wrap"
      style={{
        display: 'flex', alignItems: 'center',
        gap: '6px', justifyContent: 'center', flexWrap: 'wrap',
      }}
    >
      {groups.map((group, gIdx) => (
        <React.Fragment key={gIdx}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {group.map(i => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="text"
                maxLength={1}
                className="code-digit"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{
                  width:       '36px',
                  textAlign:   'center',
                  borderColor: isComplete ? 'var(--green)' : undefined,
                  background:  isComplete ? 'rgba(22,163,74,.04)' : undefined,
                }}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={e => handlePaste(i, e)}
                onFocus={e => e.target.select()}
              />
            ))}
          </div>

          {gIdx < groups.length - 1 && (
            <span
              aria-hidden="true"
              style={{
                fontSize: '18px', fontWeight: 700,
                color: isComplete ? 'var(--green)' : 'var(--t3, #94a3b8)',
                lineHeight: 1, userSelect: 'none',
                transition: 'color .2s', marginBottom: '2px',
              }}
            >
              {'\u2013'}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};