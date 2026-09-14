/* ================================================================
 * FICHIER : src/shared/components/DisableTwoFaModal.tsx
 *
 * Modal générique de DÉSACTIVATION de la 2FA, partagée par les 6
 * dashboards (Admin, Entreprise, Livreur, Partenaire, Correspondant,
 * Client) — pendant de TwoFaSetupModal (activation).
 *
 * Exige le mot de passe actuel ET le code TOTP courant avant d'appeler
 * le PATCH .../securite/2fa { twoFaEnabled:false, currentPassword, code }
 * de chaque dashboard (voir *SecuriteService.updateTwoFa côté backend) —
 * sans ces deux preuves, une session volée (XSS, token dérobé) suffirait
 * à désactiver la 2FA sans jamais posséder le second facteur, ce qui
 * annule sa protection dans exactement le scénario qu'elle doit couvrir.
 * ================================================================ */

import { useRef, useState } from 'react';

interface DisableTwoFaModalProps {
  onClose:   () => void;
  /** Doit lancer l'appel API réel et rejeter avec un message lisible en cas d'échec. */
  onConfirm: (currentPassword: string, code: string) => Promise<void>;
}

export default function DisableTwoFaModal({ onClose, onConfirm }: DisableTwoFaModalProps) {
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [code,       setCode]       = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    if (e.key === 'Enter' && password && code.length === 6) void handleSubmit();
  };

  const handleSubmit = async () => {
    if (!password || code.length < 6) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(password, code);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Mot de passe ou code incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { e.stopPropagation(); onClose(); }}
    >
      <div
        style={{ background: 'var(--white, #fff)', borderRadius: 22, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(11,31,58,.3)', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontWeight: 800, fontSize: 20, color: 'var(--navy, #0B1F3A)', marginBottom: 6 }}>
          Désactiver la vérification en deux étapes
        </div>
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20 }}>
          Confirmez votre mot de passe et le code généré par votre application d'authentification
          pour désactiver la 2FA sur ce compte.
        </p>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', marginBottom: 16, background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 10, textAlign: 'left' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 13, color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <div style={{ textAlign: 'left', marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>
            Mot de passe actuel
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              style={{
                width: '100%', padding: '11px 40px 11px 14px', borderRadius: 10,
                border: '1.5px solid var(--bdr2, #E2E8F0)', fontSize: 14, color: 'var(--navy)',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}
            >
              <i className={`fas fa-${showPwd ? 'eye-slash' : 'eye'}`} />
            </button>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 8, textAlign: 'left' }}>
          Code de vérification
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              style={{
                width: 42, height: 50,
                textAlign: 'center', fontSize: 20, fontWeight: 700,
                fontFamily: 'monospace',
                background: 'var(--white)',
                border: `2px solid ${code.length > i ? 'var(--blue, #2563EB)' : 'var(--bdr2)'}`,
                borderRadius: 10,
                color: 'var(--navy)',
                outline: 'none',
              }}
              onFocus={e => e.target.select()}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexDirection: 'column' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || !password || code.length < 6}
            style={{
              background: 'var(--red, #DC2626)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '13px 24px', fontSize: 14, fontWeight: 700,
              cursor: submitting || !password || code.length < 6 ? 'not-allowed' : 'pointer',
              opacity: submitting || !password || code.length < 6 ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {submitting
              ? <><i className="fas fa-circle-notch spin" /> Vérification…</>
              : <><i className="fas fa-shield-xmark" /> Désactiver la 2FA</>
            }
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--t3)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Annuler
          </button>
        </div>

        <style>{`.spin { animation: spin .8s linear infinite; display: inline-block; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
