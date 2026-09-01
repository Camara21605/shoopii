/* ============================================================
 * FICHIER : src/modules/auth/pages/Login.tsx
 * ============================================================ */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate }  from 'react-router-dom';
import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';
import { getRoleFromToken, getDashboardPath } from '../../../shared/services/authUtils';
import { authService } from '../services/authService';

import { LeftPanel }      from '../components/LeftPanel';
import { LoginForm }      from '../components/LoginForm';
import { RegisterForm }   from '../components/RegisterForm';
import { ForgotPassword } from './ForgotPassword';
import { TwoFaChallenge } from './TwoFaChallenge';
import { AccountChoiceScreen } from './AccountChoiceScreen';
import { SessionConfirmScreen } from './SessionConfirmScreen';
import { SuccessScreen }  from '../components/SuccessScreen';
import { Toast }          from '../../../shared/components/ui/Toast';
import ShoneyaLogo          from '../../../shared/components/ShoneyaLogo';

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
   Invitation COLLABORATEUR (company-team) — mécanisme distinct de
   useInviteParams ci-dessus : ?collabToken=xxx au lieu de ?role&code&email.
   Le compte créé rejoint une entreprise EXISTANTE (CompanyTeamMember),
   pas de code d'activation à saisir. Contrairement au flux ci-dessus,
   l'info (prénom/nom/email/poste) n'est PAS dans l'URL — elle doit être
   récupérée depuis le serveur (GET /company-team/invitations/accept/:token,
   public) avant de pouvoir pré-remplir quoi que ce soit.
───────────────────────────────────────────────────────────────*/
function useCollabToken(): string | null {
  const [params] = useSearchParams();
  const raw = params.get('collabToken')?.trim() ?? '';
  return raw.length > 0 ? raw : null;
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT
───────────────────────────────────────────────────────────────*/
const Login: React.FC = () => {
  // ✅ useSearchParams → lecture de l'URL APRÈS le montage du router
  const { lockedRole, prefilledCode, prefilledEmail, isInvited } = useInviteParams();
  const collabToken   = useCollabToken();
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [collabInviteError, setCollabInviteError] = useState<string | null>(null);

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
    validateRegisterStep,
    showToast,
    // ✅ Nouveau : forcer le rôle depuis l'invitation
    setRegisterRole,
    // ✅ Invitation collaborateur (company-team)
    collabInvite, setCollabInvite,
    // ✅ 2FA — étape 2 du login
    twoFaChallengeToken,
    twoFaError,
    handleVerifyTwoFa,
    cancelTwoFa,
    // ✅ Choix de compte — comptes liés pro↔client partageant identifiant+mdp
    accountChoiceOptions,
    accountChoiceError,
    handleChooseAccount,
    cancelAccountChoice,
    // ✅ Session déjà active sur un autre appareil — confirmation requise
    sessionConfirmPending,
    sessionConfirmError,
    sessionConfirmLoading,
    handleConfirmDisconnectOther,
    cancelSessionConfirm,
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

  /* ✅ Invitation collaborateur (company-team) — récupère les infos
   * (prénom/nom/email/poste) depuis le serveur puis pré-remplit
   * Inscription. Contrairement au flux ?role&code&email ci-dessus, rien
   * n'est disponible directement dans l'URL : il faut d'abord valider
   * le jeton côté serveur (jeton invalide/expiré → message d'erreur,
   * reste sur Connexion normale). */
  useEffect(() => {
    if (!collabToken) return;
    let cancelled = false;

    authService.getCollabInvitationInfo(collabToken)
      .then(info => {
        if (cancelled) return;
        if (info.status !== 'pending') {
          setCollabInviteError(
            info.status === 'accepted'
              ? 'Cette invitation a déjà été acceptée — connectez-vous directement.'
              : 'Cette invitation a expiré ou a été annulée. Demandez-en une nouvelle.',
          );
          return;
        }
        switchTab('register');
        setRegisterRole('company');
        setRegisterData(prev => ({
          ...prev,
          email:     info.email,
          firstName: info.firstName ?? prev.firstName,
          lastName:  info.lastName  ?? prev.lastName,
        }));
        setCollabInvite({ token: collabToken, jobTitle: info.jobTitle });
      })
      .catch(err => {
        if (cancelled) return;
        setCollabInviteError(
          (err as any)?.message ?? "Ce lien d'invitation est invalide ou a expiré.",
        );
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabToken]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.04 },
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const isMobile = window.innerWidth <= 900;

  // lockedRole (?role&code&email) et collabInvite (?collabToken) sont deux
  // mécanismes d'invitation distincts mais s'excluent mutuellement dans la
  // pratique (URL différentes) — celui-ci unifie leur effet sur RegisterForm
  // (masque le sélecteur de rôle, verrouille l'email pré-rempli).
  const effectiveLockedRole = lockedRole ?? (collabInvite ? 'company' : null);

  const registerSubtitle = collabInvite
    ? 'Invitation collaborateur reçue. Complétez vos informations pour rejoindre la boutique.'
    : isInvited && lockedRole
    ? `Invitation reçue — ${ROLE_CONFIGS[lockedRole]?.label ?? lockedRole}. Complétez vos informations.`
    : 'Seul le compte Client est disponible sans invitation. Rejoignez Shoneya gratuitement.';

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
                <ShoneyaLogo size={28} />
                Sho<b>neya</b>
              </div>
            )}

            {/* En-tête */}
            {!showSuccess && !showForgot && !twoFaChallengeToken && !accountChoiceOptions && !sessionConfirmPending && (
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

                {/* Bandeau invitation collaborateur (company-team) */}
                {activeTab === 'register' && collabInvite && (
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
                        Invitation collaborateur confirmée
                      </div>
                      <div style={{ color: 'var(--t2)', fontSize: 12 }}>
                        Votre email est verrouillé. Choisissez simplement un mot de passe pour finaliser votre compte.
                      </div>
                    </div>
                  </div>
                )}

                {/* Erreur d'invitation collaborateur (jeton invalide/expiré) */}
                {collabInviteError && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '11px 14px', marginTop: 12,
                    background: 'rgba(220,38,38,.07)',
                    border: '1.5px solid rgba(220,38,38,.22)',
                    borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                    <div style={{ color: 'var(--t2)', fontSize: 12.5 }}>{collabInviteError}</div>
                  </div>
                )}
              </div>
            )}

            {/* Onglets */}
            {!showSuccess && !showForgot && !twoFaChallengeToken && !accountChoiceOptions && !sessionConfirmPending && (
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
            {activeTab === 'login' && !showSuccess && !showForgot && !twoFaChallengeToken && !accountChoiceOptions && !sessionConfirmPending && (
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
                lockedRole={effectiveLockedRole}
                prefilledCode={prefilledCode}
                onlyClientRole={!isInvited && !collabInvite}
                onValidateStep={validateRegisterStep}
                isCollabInvite={collabInvite !== null}
                collabJobTitle={collabInvite?.jobTitle}
              />
            )}

            {/* 2FA — étape 2 du login */}
            {twoFaChallengeToken && !showSuccess && (
              <TwoFaChallenge
                isLoading={isLoading}
                error={twoFaError}
                onVerify={handleVerifyTwoFa}
                onCancel={cancelTwoFa}
              />
            )}

            {/* Choix de compte — identifiant + mdp partagés par 2 comptes liés */}
            {accountChoiceOptions && !showSuccess && (
              <AccountChoiceScreen
                accounts={accountChoiceOptions}
                isLoading={isLoading}
                error={accountChoiceError}
                onChoose={handleChooseAccount}
                onCancel={cancelAccountChoice}
              />
            )}

            {/* Session déjà active sur un autre appareil — confirmation requise */}
            {sessionConfirmPending && !showSuccess && (
              <SessionConfirmScreen
                isLoading={sessionConfirmLoading}
                error={sessionConfirmError}
                onConfirm={handleConfirmDisconnectOther}
                onCancel={cancelSessionConfirm}
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
                subtitleOverride={collabInvite ? 'Compte créé ! Connectez-vous avec votre nouveau mot de passe pour accéder à votre espace.' : undefined}
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