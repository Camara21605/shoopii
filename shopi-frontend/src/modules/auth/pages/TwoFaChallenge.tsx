/* ============================================================
 * FICHIER : src/modules/auth/pages/TwoFaChallenge.tsx
 *
 * Étape 2 du login pour un compte ayant activé la 2FA TOTP.
 * Le backend renvoie { requiresTwoFa: true, challengeToken } depuis
 * POST /auth/login (aucun cookie posé). Cet écran fait saisir le code
 * à 6 chiffres de l'app d'authentification puis appelle
 * POST /auth/2fa/verify-login pour obtenir la session complète.
 * ============================================================ */

import React, { useRef, useState } from 'react';

interface TwoFaChallengeProps {
  isLoading: boolean;
  error:     string;
  onVerify:  (code: string) => void;
  onCancel:  () => void;
}

export const TwoFaChallenge: React.FC<TwoFaChallengeProps> = ({
  isLoading, error, onVerify, onCancel,
}) => {
  const [code, setCode] = useState('');
  const refs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const handleInput = (idx: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const el = refs.current[idx];
    if (!el) return;
    el.value = char;
    if (char && idx < 5) refs.current[idx + 1]?.focus();
    setCode(refs.current.map(r => r?.value ?? '').join(''));
  };

  const handleKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const el = refs.current[idx];
      if (el?.value) { el.value = ''; setCode(refs.current.map(r => r?.value ?? '').join('')); }
      else if (idx > 0) refs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft'  && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) refs.current[idx + 1]?.focus();
    if (e.key === 'Enter' && code.length === 6) onVerify(code);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, i) => {
      const el = refs.current[i];
      if (el) el.value = d;
    });
    setCode(refs.current.map(r => r?.value ?? '').join(''));
    refs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>

      <button
        onClick={onCancel}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'var(--t2)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          marginBottom: '20px', padding: 0,
        }}
      >
        <i className="fas fa-arrow-left" /> Retour à la connexion
      </button>

      <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
        Vérification en deux étapes
      </h2>
      <p style={{ fontSize: '13.5px', color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.6 }}>
        Ouvrez votre application d'authentification (Google Authenticator, Authy…)
        et saisissez le code à 6 chiffres généré pour Shopi.
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px', marginBottom: '14px', background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: '10px' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '13px', color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }} onPaste={handlePaste}>
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoFocus={i === 0}
            style={{
              width: '46px', height: '54px',
              textAlign: 'center', fontSize: '22px', fontWeight: 700,
              fontFamily: 'monospace',
              background: 'var(--white)',
              border: `2px solid ${code.length > i ? 'var(--blue, #2563EB)' : 'var(--bdr2)'}`,
              borderRadius: '12px',
              color: 'var(--navy)',
              outline: 'none',
              transition: 'border-color .2s, box-shadow .2s',
              boxShadow: code.length > i ? '0 0 0 3px rgba(37,99,235,.1)' : 'none',
            }}
            onFocus={e => e.target.select()}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
          />
        ))}
      </div>

      <button
        className={`btn-submit${isLoading ? ' loading' : ''}`}
        onClick={() => onVerify(code)}
        disabled={isLoading || code.length < 6}
      >
        {isLoading
          ? <><i className="fas fa-circle-notch spin" /> Vérification…</>
          : <><i className="fas fa-check-circle" /> Vérifier le code</>
        }
      </button>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
