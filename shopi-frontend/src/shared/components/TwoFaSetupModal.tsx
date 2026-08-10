/* ================================================================
 * FICHIER : src/shared/components/TwoFaSetupModal.tsx
 *
 * Modal générique d'activation de la 2FA TOTP, partagé par les 6
 * dashboards (Admin, Entreprise, Livreur, Partenaire, Correspondant,
 * Client). Flux setup → confirm (voir TwoFaService côté backend) :
 *
 *   1. À l'ouverture : POST /auth/2fa/setup → { secret, otpauthUri }
 *      (aucun cookie/état modifié tant que le code n'est pas confirmé)
 *   2. QR code généré CÔTÉ CLIENT avec la lib `qrcode` — le secret
 *      TOTP ne doit JAMAIS transiter par un service tiers (contrairement
 *      à une API d'image QR externe).
 *   3. L'utilisateur scanne puis saisit le code à 6 chiffres généré
 *      par son app d'authentification.
 *   4. POST /auth/2fa/confirm { code } → active réellement la 2FA.
 *
 * La désactivation reste gérée par l'ancien endpoint spécifique à
 * chaque dashboard (PATCH .../securite/2fa avec twoFaEnabled:false) —
 * ce flux n'est pas concerné et continue de fonctionner tel quel.
 * ================================================================ */

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiFetch, ApiError } from '../services/apiFetch';

interface TwoFaSetupModalProps {
  onClose:   () => void;
  /** Appelé après confirmation réussie — le parent doit rafraîchir son état local. */
  onEnabled: () => void;
}

export default function TwoFaSetupModal({ onClose, onEnabled }: TwoFaSetupModalProps) {
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [error,        setError]        = useState('');
  const [otpauthUri,   setOtpauthUri]   = useState('');
  const [secret,       setSecret]       = useState('');
  const [qrDataUrl,    setQrDataUrl]    = useState('');
  const [code,         setCode]         = useState('');
  const [confirming,   setConfirming]   = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ secret: string; otpauthUri: string }>('/auth/2fa/setup', { method: 'POST' })
      .then(async data => {
        if (cancelled) return;
        setSecret(data.secret);
        setOtpauthUri(data.otpauthUri);
        const dataUrl = await QRCode.toDataURL(data.otpauthUri, { width: 220, margin: 1 });
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Impossible de générer le secret 2FA.');
      })
      .finally(() => { if (!cancelled) setLoadingSetup(false); });
    return () => { cancelled = true; };
  }, []);

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
    if (e.key === 'Enter' && code.length === 6) void handleConfirm();
  };

  const handleConfirm = async () => {
    if (code.length < 6) return;
    setError('');
    setConfirming(true);
    try {
      await apiFetch('/auth/2fa/confirm', { method: 'POST', body: { code } });
      onEnabled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide. Réessayez.');
    } finally {
      setConfirming(false);
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
          Activer la vérification en deux étapes
        </div>
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20 }}>
          Scannez ce QR code avec Google Authenticator, Authy ou une autre application TOTP,
          puis saisissez le code généré pour confirmer.
        </p>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', marginBottom: 16, background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 10, textAlign: 'left' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 13, color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {loadingSetup ? (
          <div style={{ padding: '30px 0', color: 'var(--t3)', fontSize: 13 }}>
            <i className="fas fa-circle-notch spin" style={{ marginRight: 8 }} />
            Génération du secret…
          </div>
        ) : otpauthUri ? (
          <>
            {qrDataUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <img src={qrDataUrl} alt="QR code 2FA" width={200} height={200} style={{ borderRadius: 12, border: '1px solid var(--bdr2)' }} />
              </div>
            )}

            <details style={{ marginBottom: 20, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
                Impossible de scanner ? Saisir la clé manuellement
              </summary>
              <div style={{ marginTop: 8, padding: '9px 12px', background: 'var(--g50, #F8FAFC)', border: '1px solid var(--bdr)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all', color: 'var(--navy)' }}>
                {secret}
              </div>
            </details>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <input
                  key={i}
                  ref={el => { refs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  autoFocus={i === 0}
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
                onClick={handleConfirm}
                disabled={confirming || code.length < 6}
                style={{
                  background: 'linear-gradient(135deg,var(--navy,#0B1F3A),var(--blue,#1A4FC4))', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '13px 24px', fontSize: 14, fontWeight: 700,
                  cursor: confirming || code.length < 6 ? 'not-allowed' : 'pointer',
                  opacity: confirming || code.length < 6 ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {confirming
                  ? <><i className="fas fa-circle-notch spin" /> Vérification…</>
                  : <><i className="fas fa-check-circle" /> Activer la 2FA</>
                }
              </button>
              <button
                onClick={onClose}
                style={{ background: 'none', color: 'var(--t3)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--t3)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Fermer
          </button>
        )}

        <style>{`.spin { animation: spin .8s linear infinite; display: inline-block; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
