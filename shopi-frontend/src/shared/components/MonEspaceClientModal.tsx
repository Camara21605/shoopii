/* ================================================================
 * FICHIER : src/shared/components/MonEspaceClientModal.tsx
 *
 * RÔLE : "Mon espace" — permet à un compte pro (entreprise/livreur/
 *        correspondant/admin/partenaire) de créer ou lier un compte
 *        client sous le même email/téléphone, puis de basculer dessus.
 *
 * 3 ÉTATS (déterminés par GET /auth/client-account/status) :
 *   1. linked=true              → bouton "Basculer" direct.
 *   2. existingClientFound=true → preuve de possession requise
 *      (mot de passe du compte client, ou code OTP envoyé par email/SMS —
 *      réutilise le flux forgot-password/verify-otp existant) avant liaison.
 *   3. rien trouvé               → création rapide (mot de passe à définir,
 *      nom/email/téléphone repris du compte pro côté serveur).
 *
 * Après liaison/switch : rechargement complet de la page (pas navigate()
 * SPA) — nécessaire pour réinitialiser proprement AppContext + les sockets
 * /messaging et /notifications sous la nouvelle identité (socket.data.userId
 * est figé au handshake, un simple changement de contexte React ne suffit
 * pas — voir GlobalCallContext.tsx / useSocket.ts).
 * ================================================================ */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getClientAccountStatus, createLinkedClient, linkExistingClient,
  type ClientAccountStatus,
} from '../services/accountLink';
import { authService } from '../../modules/auth/services/authService';
import { useAppContext } from '../context/AppContext';
import { useAccountSwitch } from '../hooks/useAccountSwitch';
import { TwoFaChallenge } from '../../modules/auth/pages/TwoFaChallenge';

interface Props {
  onClose: () => void;
}

type ViewState = 'loading' | 'linked' | 'link-existing' | 'create' | 'error';

export default function MonEspaceClientModal({ onClose }: Props) {
  const { user } = useAppContext();
  const [view, setView]       = useState<ViewState>('loading');
  const [status, setStatus]   = useState<ClientAccountStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getClientAccountStatus()
      .then(s => {
        setStatus(s);
        setView(s.linked ? 'linked' : s.existingClientFound ? 'link-existing' : 'create');
      })
      .catch(() => setView('error'));
  }, []);

  const {
    performSwitch, pending: switchPending, error: switchError,
    twoFaChallengeToken, verifyTwoFa, cancelTwoFa,
  } = useAccountSwitch();

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(11,31,58,.55)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 'var(--r-xl, 16px)', maxWidth: 440, width: '100%',
          padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
            fontSize: 16, color: 'var(--t3, #64748B)', cursor: 'pointer', width: 30, height: 30,
          }}
        >
          <i className="fas fa-xmark" />
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy, #0B1F3A)', margin: '0 0 6px', fontFamily: 'var(--fd)' }}>
          <i className="fas fa-user-group" style={{ color: 'var(--blue, #1A4FC4)', marginRight: 8 }} />
          Mon espace
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--t3, #64748B)', margin: '0 0 20px' }}>
          Gérez votre compte client personnel, lié à ce compte professionnel.
        </p>

        {view === 'loading' && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
          </div>
        )}

        {view === 'error' && (
          <div style={{ textAlign: 'center', padding: 20, color: '#DC2626', fontSize: 13 }}>
            <i className="fas fa-triangle-exclamation" style={{ display: 'block', fontSize: 22, marginBottom: 8 }} />
            Impossible de charger votre espace client. Réessayez plus tard.
          </div>
        )}

        {view === 'linked' && status?.linked && !twoFaChallengeToken && (
          <div>
            <div style={{
              background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)',
              borderRadius: 12, padding: 14, fontSize: 12.5, color: '#059669', marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <i className="fas fa-circle-check" style={{ fontSize: 16 }} />
              Vous avez déjà un compte client lié à ce compte pro.
            </div>
            {switchError && <ErrorBox message={switchError} />}
            <PrimaryButton onClick={performSwitch} pending={switchPending} icon="fa-right-left">
              Basculer vers mon espace client
            </PrimaryButton>
          </div>
        )}

        {twoFaChallengeToken && (
          <TwoFaChallenge
            isLoading={switchPending}
            error={switchError}
            onVerify={verifyTwoFa}
            onCancel={cancelTwoFa}
          />
        )}

        {view === 'create' && (
          <CreateForm
            defaultEmail={user?.email}
            pending={pending}
            error={error}
            onSubmit={async password => {
              setPending(true); setError(null);
              try {
                await createLinkedClient(password);
                window.location.href = '/home';
              } catch (e: any) {
                setError(e?.message ?? 'Impossible de créer le compte client.');
                setPending(false);
              }
            }}
          />
        )}

        {view === 'link-existing' && (
          <LinkExistingForm
            identifier={user?.email ?? ''}
            matchedBy={status?.matchedBy}
            pending={pending}
            error={error}
            onPasswordSubmit={async password => {
              setPending(true); setError(null);
              try {
                await linkExistingClient({ password });
                window.location.href = '/home';
              } catch (e: any) {
                setError(e?.message ?? 'Mot de passe incorrect.');
                setPending(false);
              }
            }}
            onResetTokenReady={async resetToken => {
              setPending(true); setError(null);
              try {
                await linkExistingClient({ resetToken });
                window.location.href = '/home';
              } catch (e: any) {
                setError(e?.message ?? 'Impossible de lier ce compte.');
                setPending(false);
              }
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Sous-composants ──────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)',
      borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#DC2626', marginBottom: 14,
    }}>
      <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} /> {message}
    </div>
  );
}

function PrimaryButton({
  onClick, pending, icon, children,
}: { onClick: () => void; pending: boolean; icon: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        width: '100%', background: 'var(--blue, #1A4FC4)', color: '#fff', border: 'none',
        borderRadius: 999, padding: '12px 20px', fontSize: 13, fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? .7 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {pending ? <i className="fas fa-spinner fa-spin" /> : <i className={`fas ${icon}`} />}
      {children}
    </button>
  );
}

function CreateForm({
  defaultEmail, pending, error, onSubmit,
}: { defaultEmail?: string; pending: boolean; error: string | null; onSubmit: (password: string) => void }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
        Un compte client sera créé avec l'email <strong>{defaultEmail}</strong> — définissez
        simplement un mot de passe pour ce nouvel espace.
      </div>
      {error && <ErrorBox message={error} />}
      <label style={fieldLabel}>Mot de passe du compte client</label>
      <input
        type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Au moins 8 caractères" style={fieldInput}
      />
      <label style={fieldLabel}>Confirmer le mot de passe</label>
      <input
        type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
        style={{ ...fieldInput, marginBottom: mismatch ? 4 : 18 }}
      />
      {mismatch && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 14 }}>Les mots de passe ne correspondent pas.</div>}
      <PrimaryButton
        onClick={() => onSubmit(password)}
        pending={pending || !password || mismatch}
        icon="fa-user-plus"
      >
        Créer mon espace client
      </PrimaryButton>
    </div>
  );
}

function LinkExistingForm({
  identifier, matchedBy, pending, error, onPasswordSubmit, onResetTokenReady,
}: {
  identifier: string; matchedBy?: 'email' | 'phone'; pending: boolean; error: string | null;
  onPasswordSubmit: (password: string) => void;
  onResetTokenReady: (resetToken: string) => void;
}) {
  const [mode, setMode]       = useState<'password' | 'otp-request' | 'otp-verify'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode]         = useState('');
  const [otpBusy, setOtpBusy]   = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  async function requestOtp() {
    setOtpBusy(true); setOtpError(null);
    try {
      await authService.forgotPassword({ identifier });
      setMode('otp-verify');
    } catch (e: any) {
      setOtpError(e?.message ?? "Impossible d'envoyer le code.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyCode() {
    setOtpBusy(true); setOtpError(null);
    try {
      const res = await authService.verifyOtp(identifier, code);
      if ('requiresAccountChoice' in res) {
        // Le même code a matché le compte pro ET le compte client (rare) —
        // on cible explicitement le compte CLIENT non lié.
        const clientAccount = res.accounts.find(a => a.role === 'client');
        if (!clientAccount) { setOtpError('Compte client introuvable.'); return; }
        const res2 = await authService.verifyOtp(identifier, code, clientAccount.userId);
        if ('resetToken' in res2) onResetTokenReady(res2.resetToken);
        return;
      }
      onResetTokenReady(res.resetToken);
    } catch (e: any) {
      setOtpError(e?.message ?? 'Code incorrect.');
    } finally {
      setOtpBusy(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
        Un compte client existe déjà avec {matchedBy === 'phone' ? 'le même numéro de téléphone' : 'le même email'}.
        Confirmez que c'est bien le vôtre pour le lier à ce compte pro.
      </div>
      {error && <ErrorBox message={error} />}

      {mode === 'password' && (
        <>
          <label style={fieldLabel}>Mot de passe du compte client</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ ...fieldInput, marginBottom: 10 }}
          />
          <PrimaryButton onClick={() => onPasswordSubmit(password)} pending={pending || !password} icon="fa-link">
            Lier ce compte
          </PrimaryButton>
          <button
            onClick={() => setMode('otp-request')}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, marginTop: 12, cursor: 'pointer', width: '100%' }}
          >
            Je ne connais pas ce mot de passe
          </button>
        </>
      )}

      {mode === 'otp-request' && (
        <>
          {otpError && <ErrorBox message={otpError} />}
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
            Un code de vérification sera envoyé à {identifier}.
          </p>
          <PrimaryButton onClick={requestOtp} pending={otpBusy} icon="fa-paper-plane">
            Envoyer le code
          </PrimaryButton>
        </>
      )}

      {mode === 'otp-verify' && (
        <>
          {otpError && <ErrorBox message={otpError} />}
          <label style={fieldLabel}>Code reçu par email</label>
          <input
            type="text" inputMode="numeric" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ ...fieldInput, marginBottom: 14, letterSpacing: 4, textAlign: 'center', fontWeight: 700 }}
            placeholder="000000"
          />
          <PrimaryButton onClick={verifyCode} pending={otpBusy || code.length !== 6} icon="fa-check">
            Valider et lier ce compte
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--t2, #475569)', marginBottom: 6,
};
const fieldInput: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--bdr2, #E2E8F0)',
  fontSize: 13, marginBottom: 18, boxSizing: 'border-box',
};
