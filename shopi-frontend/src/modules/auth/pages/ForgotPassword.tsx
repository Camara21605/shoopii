/* ============================================================
 * FICHIER : src/modules/auth/pages/ForgotPassword.tsx
 *
 * FONCTIONNEMENT EN 3 ÉTAPES :
 *
 *  Étape 1 — IDENTIFIANT
 *    L'utilisateur saisit son email ou téléphone.
 *    Le backend envoie un code OTP à 6 chiffres.
 *    Sécurité : le message de confirmation ne révèle pas
 *    si l'email existe vraiment (protection énumération).
 *
 *  Étape 2 — CODE OTP
 *    L'utilisateur saisit le code reçu par email/SMS.
 *    Compte à rebours de 10 minutes.
 *    Bouton "Renvoyer" disponible après 60 secondes.
 *    Le code est masqué / démasquable.
 *
 *  Étape 3 — NOUVEAU MOT DE PASSE
 *    Saisie + confirmation du nouveau mot de passe.
 *    Indicateur de force du mot de passe en temps réel.
 *    Exigences affichées sous forme de checklist.
 *    Le token OTP est envoyé avec le nouveau mot de passe.
 *
 * SÉCURITÉ :
 *    - Rate limiting visuel (bouton Renvoyer désactivé 60s)
 *    - Message générique ("si le compte existe…")
 *    - Validation côté client stricte avant envoi
 *    - Token OTP à usage unique (invalidé après utilisation)
 * ============================================================ */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types ── */
type Step = 'identifier' | 'otp' | 'newPassword';

interface ForgotPasswordProps {
  onBack:    () => void;
  onSuccess: () => void;
}

/* ── Durées ── */
const OTP_EXPIRY_SECONDS  = 10 * 60;  // 10 minutes
const RESEND_COOLDOWN_SEC = 60;        // 60s avant de pouvoir renvoyer

/* ─────────────────────────────────────────────────────────────────────────────
   COMPOSANT
───────────────────────────────────────────────────────────────────────────── */
export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onSuccess }) => {
  /* ── État des étapes ── */
  const [step,        setStep]        = useState<Step>('identifier');
  const [identifier,  setIdentifier]  = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── État UI ── */
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  /* ── Compte à rebours OTP ── */
  const [otpTimer,    setOtpTimer]    = useState(OTP_EXPIRY_SECONDS);
  const [canResend,   setCanResend]   = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SEC);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Refs OTP inputs (6 cases) ── */
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  /* ─── Démarrer le compte à rebours OTP ─── */
  const startOtpTimer = useCallback(() => {
    setOtpTimer(OTP_EXPIRY_SECONDS);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) { clearInterval(intervalRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  /* ─── Démarrer le cooldown de renvoi ─── */
  const startResendCooldown = useCallback(() => {
    setCanResend(false);
    setResendTimer(RESEND_COOLDOWN_SEC);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) {
          clearInterval(resendRef.current!);
          setCanResend(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (intervalRef.current)  clearInterval(intervalRef.current);
    if (resendRef.current)    clearInterval(resendRef.current);
  }, []);

  /* ─── Formatage du timer ─── */
  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  /* ─── Vérification force du mot de passe ─── */
  const pwdChecks = {
    length:  newPwd.length >= 8,
    upper:   /[A-Z]/.test(newPwd),
    lower:   /[a-z]/.test(newPwd),
    digit:   /[0-9]/.test(newPwd),
    special: /[^A-Za-z0-9]/.test(newPwd),
  };
  const pwdScore  = Object.values(pwdChecks).filter(Boolean).length;
  const pwdStrong = pwdScore >= 4;

  const pwdColor = pwdScore <= 1 ? '#DC2626' : pwdScore === 2 ? '#D97706' : pwdScore === 3 ? '#CA8A04' : pwdScore === 4 ? '#16A34A' : '#15803D';
  const pwdLabel = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][pwdScore];

  /* ─── OTP input handlers ─── */
  const handleOtpInput = (idx: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const el = otpRefs.current[idx];
    if (!el) return;
    el.value = char;
    if (char && idx < 5) otpRefs.current[idx + 1]?.focus();
    setOtp(otpRefs.current.map(r => r?.value ?? '').join(''));
  };

  const handleOtpKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const el = otpRefs.current[idx];
      if (el?.value) { el.value = ''; setOtp(otpRefs.current.map(r => r?.value ?? '').join('')); }
      else if (idx > 0) otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft'  && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, i) => {
      const el = otpRefs.current[i];
      if (el) el.value = d;
    });
    setOtp(otpRefs.current.map(r => r?.value ?? '').join(''));
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  /* ═══════════════════════════════════════════════════════
     ÉTAPE 1 — ENVOI DU CODE
  ═══════════════════════════════════════════════════════ */
  const handleSendCode = async () => {
    setError('');
    const id = identifier.trim();
    if (!id) { setError("Veuillez saisir votre email ou numéro de téléphone."); return; }

    setIsLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { identifier: id },
      });
      setStep('otp');
      startOtpTimer();
      startResendCooldown();
    } catch {
      // Message générique pour ne pas révéler si l'email existe
      setStep('otp');
      startOtpTimer();
      startResendCooldown();
    } finally {
      setIsLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     ÉTAPE 1B — RENVOI DU CODE
  ═══════════════════════════════════════════════════════ */
  const handleResend = async () => {
    if (!canResend) return;
    setError('');
    setIsLoading(true);
    otpRefs.current.forEach(el => { if (el) el.value = ''; });
    setOtp('');
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { identifier: identifier.trim() },
      });
    } catch { /* Silencieux */ } finally {
      setIsLoading(false);
      startOtpTimer();
      startResendCooldown();
      setSuccess('Nouveau code envoyé !');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  /* ═══════════════════════════════════════════════════════
     ÉTAPE 2 — VÉRIFICATION OTP
  ═══════════════════════════════════════════════════════ */
  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length < 6) { setError("Veuillez saisir les 6 chiffres du code."); return; }
    if (otpTimer === 0) { setError("Ce code a expiré. Veuillez en demander un nouveau."); return; }

    setIsLoading(true);
    try {
      const data = await apiFetch<{ resetToken: string }>('/auth/verify-otp', {
        method: 'POST',
        body: { identifier: identifier.trim(), code: otp },
      });
      setResetToken(data.resetToken);
      setStep('newPassword');
    } catch (err: any) {
      setError(err?.message ?? "Code incorrect ou expiré. Vérifiez et réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     ÉTAPE 3 — NOUVEAU MOT DE PASSE
  ═══════════════════════════════════════════════════════ */
  const handleResetPassword = async () => {
    setError('');
    if (!pwdStrong)         { setError("Votre mot de passe ne remplit pas les exigences minimales."); return; }
    if (newPwd !== confirmPwd) { setError("Les mots de passe ne correspondent pas."); return; }

    setIsLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { resetToken, newPassword: newPwd },
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la réinitialisation. Recommencez depuis le début.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── Styles communs ─── */
  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--white, #fff)',
    border: '1.5px solid var(--bdr2, #CBD5E1)',
    borderRadius: '10px', padding: '11px 14px 11px 38px',
    fontSize: '13.5px', color: 'var(--t1, #0F172A)',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color .2s, box-shadow .2s',
  };

  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>

      {/* ─── Bouton retour ─── */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'var(--t2)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          marginBottom: '20px', padding: 0,
        }}
      >
        <i className="fas fa-arrow-left" /> Retour à la connexion
      </button>

      {/* ─── Stepper ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '24px' }}>
        {[
          { n: 1, label: 'Identifiant', step: 'identifier' },
          { n: 2, label: 'Code OTP',    step: 'otp' },
          { n: 3, label: 'Nouveau MDP', step: 'newPassword' },
        ].map((s, idx) => {
          const isActive   = step === s.step;
          const isDone     = (step === 'otp' && idx === 0) || (step === 'newPassword' && idx <= 1);
          return (
            <React.Fragment key={s.step}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, transition: 'all .3s',
                  background: isDone ? 'var(--green, #16A34A)' : isActive ? 'var(--blue, #2563EB)' : 'var(--g100, #F1F5F9)',
                  color: isDone || isActive ? '#fff' : 'var(--t3)',
                  border: `2px solid ${isDone ? 'var(--green)' : isActive ? 'var(--blue)' : 'var(--bdr2)'}`,
                }}>
                  {isDone ? '✓' : s.n}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: isActive ? 'var(--blue)' : isDone ? 'var(--green)' : 'var(--t4)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div style={{ flex: 2, height: '2px', background: isDone ? 'var(--green)' : 'var(--bdr)', marginBottom: '20px', transition: 'background .3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ─── Messages d'erreur / succès ─── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px', marginBottom: '14px', background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: '10px' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '13px', color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', marginBottom: '14px', background: 'rgba(22,163,74,.06)', border: '1.5px solid rgba(22,163,74,.2)', borderRadius: '10px', fontSize: '13px', color: 'var(--green, #16A34A)', fontWeight: 600 }}>
          ✅ {success}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ÉTAPE 1 — IDENTIFIANT
      ══════════════════════════════════════════════════ */}
      {step === 'identifier' && (
        <>
          <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
            Mot de passe oublié ?
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.6 }}>
            Saisissez votre email ou téléphone. Nous vous enverrons un code de vérification à 6 chiffres.
          </p>

          <div className="field-group" style={{ marginBottom: '16px' }}>
            <div className="field-label">Email ou téléphone</div>
            <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: '12px', color: 'var(--t3)', fontSize: '13px', zIndex: 1 }} />
              <input
                style={inputStyle}
                type="text"
                placeholder="votre@email.com ou +224 620 000 000"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                autoFocus
              />
            </div>
          </div>

          {/* Info sécurité */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '10px 13px', background: 'rgba(37,99,235,.05)', border: '1px solid rgba(37,99,235,.15)', borderRadius: '9px', marginBottom: '18px', fontSize: '12px', color: 'var(--blue, #1A4FC4)', lineHeight: 1.5 }}>
            <i className="fas fa-shield-halved" style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>Pour votre sécurité, nous vous enverrons un code même si aucun compte ne correspond — cela évite de révéler quels emails sont enregistrés.</span>
          </div>

          <button
            className={`btn-submit${isLoading ? ' loading' : ''}`}
            onClick={handleSendCode}
            disabled={isLoading}
          >
            {isLoading
              ? <><i className="fas fa-circle-notch spin" /> Envoi en cours…</>
              : <><i className="fas fa-paper-plane" /> Envoyer le code</>
            }
          </button>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          ÉTAPE 2 — CODE OTP
      ══════════════════════════════════════════════════ */}
      {step === 'otp' && (
        <>
          <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
            Vérifiez votre email
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.6 }}>
            Si un compte correspond à <strong style={{ color: 'var(--navy)' }}>{identifier}</strong>, un code à 6 chiffres a été envoyé. Saisissez-le ci-dessous.
          </p>

          {/* Timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--t3)' }}>Code valable</span>
            <span style={{
              fontFamily: 'monospace', fontSize: '16px', fontWeight: 700,
              color: otpTimer <= 60 ? 'var(--rose, #DC2626)' : 'var(--navy)',
              padding: '3px 10px', background: otpTimer <= 60 ? 'rgba(220,38,38,.06)' : 'var(--sky, #EEF3FD)',
              borderRadius: '6px', border: `1px solid ${otpTimer <= 60 ? 'rgba(220,38,38,.2)' : 'var(--sky-3)'}`,
              transition: 'all .3s',
            }}>
              {otpTimer > 0 ? `⏱ ${formatTime(otpTimer)}` : '⏱ Expiré'}
            </span>
          </div>

          {/* Cases OTP à 6 chiffres */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }} onPaste={handleOtpPaste}>
            {Array.from({ length: 6 }, (_, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                style={{
                  width: '46px', height: '54px',
                  textAlign: 'center', fontSize: '22px', fontWeight: 700,
                  fontFamily: 'monospace',
                  background: 'var(--white)',
                  border: `2px solid ${otp.length > i ? 'var(--blue, #2563EB)' : 'var(--bdr2)'}`,
                  borderRadius: '12px',
                  color: 'var(--navy)',
                  outline: 'none',
                  transition: 'border-color .2s, box-shadow .2s',
                  boxShadow: otp.length > i ? '0 0 0 3px rgba(37,99,235,.1)' : 'none',
                }}
                onFocus={e => e.target.select()}
                onChange={e => handleOtpInput(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)}
              />
            ))}
          </div>

          {/* Bouton renvoyer */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <button
              onClick={handleResend}
              disabled={!canResend || isLoading}
              style={{
                background: 'none', border: 'none',
                color: canResend ? 'var(--blue)' : 'var(--t3)',
                fontSize: '13px', fontWeight: 600, cursor: canResend ? 'pointer' : 'not-allowed',
                transition: 'color .2s',
              }}
            >
              {canResend
                ? '↺ Renvoyer un code'
                : `↺ Renvoyer dans ${resendTimer}s`
              }
            </button>
          </div>

          <button
            className={`btn-submit${isLoading ? ' loading' : ''}`}
            onClick={handleVerifyOtp}
            disabled={isLoading || otp.length < 6}
          >
            {isLoading
              ? <><i className="fas fa-circle-notch spin" /> Vérification…</>
              : <><i className="fas fa-check-circle" /> Vérifier le code</>
            }
          </button>

          {/* Bouton retour vers étape 1 */}
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button
              onClick={() => { setStep('identifier'); setError(''); setOtp(''); otpRefs.current.forEach(el => { if (el) el.value = ''; }); }}
              style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: '12.5px', cursor: 'pointer', fontWeight: 500 }}
            >
              ← Changer d'identifiant
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          ÉTAPE 3 — NOUVEAU MOT DE PASSE
      ══════════════════════════════════════════════════ */}
      {step === 'newPassword' && (
        <>
          <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
            Nouveau mot de passe
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.6 }}>
            Choisissez un mot de passe fort. Il ne doit pas être identique à un mot de passe précédent.
          </p>

          {/* Champ nouveau mot de passe */}
          <div className="field-group" style={{ marginBottom: '10px' }}>
            <div className="field-label">Nouveau mot de passe</div>
            <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-lock" style={{ position: 'absolute', left: '12px', color: 'var(--t3)', fontSize: '13px', zIndex: 1 }} />
              <input
                style={{ ...inputStyle, paddingRight: '42px' }}
                type={showPwd ? 'text' : 'password'}
                placeholder="Nouveau mot de passe"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '14px' }}
              >
                <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          {/* Barre de force du mot de passe */}
          {newPwd.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '5px' }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{
                    flex: 1, height: '4px', borderRadius: '2px',
                    background: pwdScore >= i ? pwdColor : 'var(--bdr)',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: pwdColor }}>
                {pwdLabel}
              </span>
            </div>
          )}

          {/* Checklist des exigences */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px', padding: '12px', background: 'var(--g50)', borderRadius: '10px', border: '1px solid var(--bdr)' }}>
            {[
              { ok: pwdChecks.length,  label: '8 caractères minimum' },
              { ok: pwdChecks.upper,   label: '1 lettre majuscule' },
              { ok: pwdChecks.lower,   label: '1 lettre minuscule' },
              { ok: pwdChecks.digit,   label: '1 chiffre' },
              { ok: pwdChecks.special, label: '1 caractère spécial' },
            ].map(({ ok, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: ok ? 'var(--green, #16A34A)' : 'var(--t3)', transition: 'color .2s' }}>
                <span style={{ fontSize: '12px', flexShrink: 0 }}>{ok ? '✅' : '○'}</span>
                {label}
              </div>
            ))}
          </div>

          {/* Confirmation */}
          <div className="field-group" style={{ marginBottom: '16px' }}>
            <div className="field-label">Confirmer le mot de passe</div>
            <div className="field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-lock-keyhole" style={{ position: 'absolute', left: '12px', color: 'var(--t3)', fontSize: '13px', zIndex: 1 }} />
              <input
                style={{
                  ...inputStyle,
                  paddingRight: '42px',
                  borderColor: confirmPwd && newPwd !== confirmPwd ? 'var(--rose)' : confirmPwd && newPwd === confirmPwd ? 'var(--green)' : undefined,
                  boxShadow: confirmPwd && newPwd !== confirmPwd ? '0 0 0 3px rgba(220,38,38,.08)' : confirmPwd && newPwd === confirmPwd ? '0 0 0 3px rgba(22,163,74,.08)' : 'none',
                }}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Répétez votre mot de passe"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '14px' }}
              >
                <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <div style={{ fontSize: '11.5px', color: 'var(--rose)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fas fa-circle-exclamation" style={{ fontSize: '10px' }} />
                Les mots de passe ne correspondent pas
              </div>
            )}
            {confirmPwd && newPwd === confirmPwd && (
              <div style={{ fontSize: '11.5px', color: 'var(--green)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fas fa-circle-check" style={{ fontSize: '10px' }} />
                Les mots de passe correspondent
              </div>
            )}
          </div>

          <button
            className={`btn-submit${isLoading ? ' loading' : ''}`}
            onClick={handleResetPassword}
            disabled={isLoading || !pwdStrong || newPwd !== confirmPwd}
            style={{ opacity: (!pwdStrong || newPwd !== confirmPwd) ? .6 : 1 }}
          >
            {isLoading
              ? <><i className="fas fa-circle-notch spin" /> Mise à jour…</>
              : <><i className="fas fa-key" /> Réinitialiser mon mot de passe</>
            }
          </button>
        </>
      )}

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