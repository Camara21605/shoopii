/* ============================================================
 * FICHIER : src/modules/auth/pages/Login.tsx
 * ============================================================ */

import React, { useEffect } from 'react';
import { useSearchParams, useNavigate }  from 'react-router-dom';
import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';
import { getRoleFromToken, getDashboardPath } from '../../../shared/services/authUtils';

import { LeftPanel }      from '../components/LeftPanel';
import { LoginForm }      from '../components/LoginForm';
import { RegisterForm }   from '../components/RegisterForm';
import { ForgotPassword } from './ForgotPassword';
import { SuccessScreen }  from '../components/SuccessScreen';
import { Toast }          from '../../../shared/components/ui/Toast';

import { useLoginPage }  from '../hooks/useLoginPage';
import { ROLE_CONFIGS }  from '../roleConfigs';
import type { UserRole }     from '../types';

import './login.css';

/* ─────────────────────────────────────────────────────────────
   Lit les paramètres d'invitation depuis l'URL.
   Utilise useSearchParams (hook React Router) → disponible
   APRÈS que le router soit monté → pas de problème de timing.
───────────────────────────────────────────────────────────────*/
function useInviteParams() {
  const [params] = useSearchParams();

  const rawRole  = params.get('role')?.toLowerCase().trim() ?? '';
  const rawCode  = params.get('code')?.trim()               ?? '';
  const rawEmail = params.get('email')?.trim()              ?? '';

  // Rôle valide = existe dans ROLE_CONFIGS et n'est pas super_admin
  const validRole: UserRole | null =
    rawRole &&
    rawRole !== 'super_admin' &&
    Object.prototype.hasOwnProperty.call(ROLE_CONFIGS, rawRole)
      ? (rawRole as UserRole)
      : null;

  // isInvited = rôle valide + code présent
  const isInvited = validRole !== null && rawCode.length > 0;

  return {
    lockedRole:     isInvited ? validRole : null,
    prefilledCode:  isInvited ? rawCode   : '',
    prefilledEmail: rawEmail,
    isInvited,
  };
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT
───────────────────────────────────────────────────────────────*/
const Login: React.FC = () => {
  // ✅ useSearchParams → lecture de l'URL APRÈS le montage du router
  const { lockedRole, prefilledCode, prefilledEmail, isInvited } = useInviteParams();
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    activeTab,
    loginRole,    registerRole,
    loginData,    setLoginData,
    registerData, setRegisterData, handleRegisterChange,
    loginErrors,  registerErrors,
    isLoading,
    showSuccess,  successAction,
    showForgot,   setShowForgot,
    toast,
    switchTab,
    selectLoginRole,
    selectRegisterRole,
    handleLogin,
    handleRegister,
    showToast,
    // ✅ Nouveau : forcer le rôle depuis l'invitation
    setRegisterRole,
  } = useLoginPage({ initialTab: isInvited ? 'register' : 'login' });

  /* ── Retour du callback Google OAuth ──────────────────────────────────────
     Le backend redirige vers /login?token=JWT  (succès)
     ou                       /login?error=msg  (échec).
     Ce useEffect doit être APRÈS useLoginPage pour avoir accès à showToast.
  ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const code  = searchParams.get('code');
    const role  = searchParams.get('role');
    const error = searchParams.get('error');

    // ?code sans ?role → callback Google OAuth (pas un lien d'invitation)
    if (code && !role) {
      window.history.replaceState({}, '', '/login');
      apiFetch<{ accessToken: string }>('/auth/google/exchange', {
        method: 'POST',
        body: { code },
      })
        .then(result => {
          tokenStorage.set(result.accessToken);
          const userRole = getRoleFromToken();
          navigate(getDashboardPath(userRole), { replace: true });
        })
        .catch(err => {
          showToast(`❌ ${(err as any)?.message ?? 'Erreur de connexion Google'}`);
        });
    } else if (error) {
      showToast(`❌ ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', '/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Pré-remplir email + forcer le rôle au montage
  useEffect(() => {
    if (isInvited) {
      // Ouvrir Register
      switchTab('register');

      // Forcer le rôle invité
      if (lockedRole) {
        setRegisterRole(lockedRole);
      }

      // Pré-remplir l'email
      if (prefilledEmail) {
        setRegisterData(prev => ({ ...prev, email: prefilledEmail }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInvited]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.04 },
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const isMobile = window.innerWidth <= 900;

  const registerSubtitle = isInvited && lockedRole
    ? `Invitation reçue — ${ROLE_CONFIGS[lockedRole]?.label ?? lockedRole}. Complétez vos informations.`
    : 'Seul le compte Client est disponible sans invitation. Rejoignez Shopi gratuitement.';

  return (
    <>
      <div className="bg-atm" />
      <div className="bg-grid" />

      <div className="page">
        <LeftPanel />

        <div className="right-panel">
          <div className="form-wrap">

            {isMobile && (
              <div className="form-logo" id="mobileLogo">
                <div className="form-logo-mark">Sh</div>
                Sho<b>pi</b>
              </div>
            )}

            {/* En-tête */}
            {!showSuccess && !showForgot && (
              <div className="form-hd">
                <h2 className="form-title">
                  {activeTab === 'login' ? 'Connexion' : 'Créer mon compte'}
                </h2>
                <p className="form-sub">
                  {activeTab === 'login'
                    ? 'Bon retour ! Entrez vos identifiants pour accéder à votre espace.'
                    : registerSubtitle}
                </p>

                {/* Bandeau invitation */}
                {activeTab === 'register' && isInvited && lockedRole && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '11px 14px', marginTop: 12,
                    background: 'rgba(37,99,235,.07)',
                    border: '1.5px solid rgba(37,99,235,.22)',
                    borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>✉️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue, #1A4FC4)', marginBottom: 3 }}>
                        Invitation confirmée — {ROLE_CONFIGS[lockedRole]?.label}
                      </div>
                      <div style={{ color: 'var(--t2)', fontSize: 12 }}>
                        Votre rôle et votre code d'activation sont pré-remplis.
                        {prefilledEmail && ' Votre email est verrouillé.'}
                        {' '}Renseignez uniquement vos informations personnelles.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Onglets */}
            {!showSuccess && !showForgot && (
              <div className="form-tabs">
                <button
                  className={`ftab${activeTab === 'login' ? ' active' : ''}`}
                  onClick={() => switchTab('login')}
                >
                  <i className="fas fa-right-to-bracket" /> Connexion
                </button>
                <button
                  className={`ftab${activeTab === 'register' ? ' active' : ''}`}
                  onClick={() => switchTab('register')}
                >
                  <i className="fas fa-user-plus" /> Inscription
                </button>
              </div>
            )}

            {/* Connexion */}
            {activeTab === 'login' && !showSuccess && !showForgot && (
              <LoginForm
                data={loginData}
                errors={loginErrors}
                selectedRole={loginRole}
                isLoading={isLoading}
                onDataChange={partial => setLoginData(prev => ({ ...prev, ...partial }))}
                onRoleSelect={selectLoginRole}
                onSubmit={handleLogin}
                onForgot={() => setShowForgot(true)}
                onSwitchToRegister={() => switchTab('register')}
                onSocialToast={showToast}
              />
            )}

            {/* Inscription */}
            {activeTab === 'register' && !showSuccess && !showForgot && (
              <RegisterForm
                data={registerData}
                errors={registerErrors}
                selectedRole={registerRole}
                isLoading={isLoading}
                onDataChange={handleRegisterChange}
                onRoleSelect={role => selectRegisterRole(role)}
                onSubmit={handleRegister}
                onSwitchToLogin={() => switchTab('login')}
                lockedRole={lockedRole}
                prefilledCode={prefilledCode}
                onlyClientRole={!isInvited}
              />
            )}

            {/* Mot de passe oublié */}
            {showForgot && (
              <ForgotPassword
                onBack={() => setShowForgot(false)}
                onSuccess={() => {
                  showToast('✅ Mot de passe réinitialisé avec succès !');
                  setShowForgot(false);
                }}
              />
            )}

            {/* Succès */}
            {showSuccess && (
              <SuccessScreen
                action={successAction}
                role={activeTab === 'login' ? loginRole : registerRole}
              />
            )}

          </div>
        </div>
      </div>

      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
};

export default Login;