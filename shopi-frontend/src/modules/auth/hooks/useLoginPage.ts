// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/hooks/useLoginPage.ts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { useNavigate }   from 'react-router-dom';
import { authService }   from '../services/authService';
import { ApiError }      from '../../../shared/services/apiFetch';
import { useAppContext } from '../../../shared/context/AppContext';
import { ROLE_CONFIGS }  from '../roleConfigs';
import type { UserRole, Role, LoginFormData, RegisterFormData, FormErrors } from '../types';

type Tab = 'login' | 'register';

interface ToastState { msg: string; visible: boolean; }

const INITIAL_LOGIN_DATA: LoginFormData = {
  email: '', password: '', rememberMe: false,
};

const INITIAL_REGISTER_DATA: RegisterFormData = {
  firstName: '', lastName: '', email: '', phone: '',
  password: '', confirmPassword: '', activationCode: '', terms: false,
  birthDate: '', gender: '',
};

const ROLE_MAP: Record<string, UserRole> = {
  admin: 'admin', entreprise: 'company', company: 'company',
  livreur: 'delivery', delivery: 'delivery',
  partenaire: 'partner', partner: 'partner',
  correspondant: 'correspondent', correspondent: 'correspondent',
  client: 'client',
};

/* 'client' n'est volontairement pas mappé ici : le dashboard client
   (/dashboard/client) n'est qu'un stub technique, la vraie destination
   du client après connexion/inscription est toujours '/home' (fallback ?? ci-dessous). */
const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/dashboard/super-admin', admin: '/dashboard/admin',
  company: '/dashboard/entreprise',      delivery: '/dashboard/livreur',
  partner: '/dashboard/partenaire',      correspondent: '/dashboard/correspondant',
};

interface UseLoginPageOptions {
  initialTab?: Tab;
}

export function useLoginPage(options: UseLoginPageOptions = {}) {
  const { initialTab = 'login' } = options;

  const navigate    = useNavigate();
  const { setUser } = useAppContext();

  const [activeTab,      setActiveTab]      = useState<Tab>(initialTab);
  const [loginRole,      setLoginRole]      = useState<Role>('client');
  const [registerRole,   setRegisterRole]   = useState<Role>('client');
  const [loginData,      setLoginData]      = useState<LoginFormData>(INITIAL_LOGIN_DATA);
  const [registerData,   setRegisterData]   = useState<RegisterFormData>(INITIAL_REGISTER_DATA);
  const [loginErrors,    setLoginErrors]    = useState<FormErrors>({});
  const [registerErrors, setRegisterErrors] = useState<FormErrors>({});
  const [isLoading,      setIsLoading]      = useState(false);
  const [showSuccess,    setShowSuccess]    = useState(false);
  const [successAction,  setSuccessAction]  = useState<'Connexion' | 'Inscription'>('Connexion');
  const [showForgot,     setShowForgot]     = useState(false);
  const [toast,          setToast]          = useState<ToastState>({ msg: '', visible: false });

  /* ── Invitation collaborateur (company-team) — voir Login.tsx,
   * useCollabInviteParams. Distinct du mécanisme ?role&code&email
   * (invitations livreur/correspondant, plus haut) : ici le compte créé
   * rejoint une entreprise EXISTANTE (CompanyTeamMember), pas de code
   * d'activation ni de nom de boutique à demander, et l'endpoint
   * d'acceptation ne renvoie pas de JWT (pas de connexion automatique). */
  const [collabInvite, setCollabInvite] = useState<{ token: string; jobTitle?: string } | null>(null);

  // ── 2FA — challenge posé par /auth/login quand le compte a activé la 2FA ──
  const [twoFaChallengeToken, setTwoFaChallengeToken] = useState<string | null>(null);
  const [twoFaError,          setTwoFaError]          = useState('');

  // ── Choix de compte — identifiant + mot de passe partagés par un compte
  //    pro et son compte client lié (coïncidence), posé par /auth/login ──
  const [accountChoiceOptions, setAccountChoiceOptions] = useState<{ userId: string; role: UserRole }[] | null>(null);
  const [accountChoiceError,   setAccountChoiceError]   = useState('');

  // ── Session déjà active sur un autre appareil — posé par /auth/login
  //    (ou /auth/login/choose-account) quand une confirmation est requise
  //    avant de fermer l'autre session. `null` = pas de conflit en attente ;
  //    'account' = le conflit vient du flux choix-de-compte (userId choisi
  //    conservé pour le rappel confirmé). ──
  const [sessionConfirmPending, setSessionConfirmPending] = useState<null | { via: 'login' } | { via: 'account'; userId: string }>(null);
  const [sessionConfirmError,   setSessionConfirmError]   = useState('');
  const [sessionConfirmLoading, setSessionConfirmLoading] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    setTimeout(() => setToast({ msg: '', visible: false }), 3000);
  }, []);

  /* Session unique : redirigé ici après une déconnexion forcée par une
   * connexion sur un autre appareil (voir AppContext.handleSessionRevoked,
   * qui pose ce message avant window.location.href = '/login'). Affiché
   * une seule fois puis effacé. */
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('shopi_session_revoked_message');
      if (msg) {
        sessionStorage.removeItem('shopi_session_revoked_message');
        showToast(`🔒 Session terminée — ${msg}`);
      }
    } catch { /* sessionStorage indisponible — pas de message, pas grave */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setLoginErrors({});
    setRegisterErrors({});
    setShowForgot(false);
    setShowSuccess(false);
  }, []);

  const selectLoginRole    = useCallback((role: Role) => setLoginRole(role), []);
  const selectRegisterRole = useCallback((role: Role) => {
    setRegisterRole(role);
    setRegisterData(prev => ({ ...prev, activationCode: '' }));
    setRegisterErrors(prev => {
      const next = { ...prev };
      delete next.activationCode;
      return next;
    });
  }, []);

  // Validation Login
  const validateLogin = (): boolean => {
    const errs: FormErrors = {};
    if (!loginData.email.trim())    errs.email    = 'Email ou téléphone requis.';
    if (!loginData.password.trim()) errs.password = 'Mot de passe requis.';
    setLoginErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Validation d'un champ d'inscription (utilisée à la fois pour
  //     la validation instantanée à la saisie et pour la validation
  //     finale à la soumission) ──────────────────────────────────────
  const validateRegisterField = useCallback((
    field: keyof RegisterFormData,
    data:  RegisterFormData,
    role:  Role,
  ): string | undefined => {
    switch (field) {
      case 'firstName':
        return !data.firstName.trim() ? 'Prénom requis.' : undefined;

      case 'lastName':
        return !data.lastName.trim() ? 'Nom requis.' : undefined;

      case 'email':
        if (!data.email.trim()) return 'Email requis.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Adresse email invalide.';
        return undefined;

      case 'phone':
        return !data.phone.trim() ? 'Téléphone requis.' : undefined;

      case 'password':
        if (data.password.length < 8) return 'Mot de passe trop court (8 caractères min).';
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password))
          return 'Doit contenir une majuscule, une minuscule et un chiffre.';
        return undefined;

      case 'confirmPassword':
        return data.password !== data.confirmPassword
          ? 'Les mots de passe ne correspondent pas.'
          : undefined;

      case 'activationCode': {
        /* Invitation collaborateur : rejoint une entreprise existante,
         * aucun code d'activation à demander (voir collabInvite). */
        if (collabInvite) return undefined;
        const cfg = ROLE_CONFIGS[role];
        return cfg?.code && !data.activationCode?.trim()
          ? "Code d'activation requis pour ce rôle."
          : undefined;
      }

      case 'terms':
        return !data.terms ? "Vous devez accepter les conditions d'utilisation pour continuer." : undefined;

      default:
        return undefined;
    }
  }, [collabInvite]);

  // Validation partielle d'un sous-ensemble de champs (navigation wizard)
  const validateRegisterStep = useCallback((fields: (keyof RegisterFormData)[]): boolean => {
    const errs: FormErrors = {};
    fields.forEach(field => {
      const error = validateRegisterField(field, registerData, registerRole);
      if (error) (errs as Record<string, string>)[field] = error;
    });
    setRegisterErrors(prev => {
      const next = { ...prev };
      fields.forEach(field => {
        const error = validateRegisterField(field, registerData, registerRole);
        if (error) (next as Record<string, string>)[field] = error;
        else delete (next as Record<string, string | undefined>)[field];
      });
      return next;
    });
    return Object.keys(errs).length === 0;
  }, [registerData, registerRole, validateRegisterField]);

  // Validation Register (soumission) — vérifie tous les champs
  const validateRegister = (): boolean => {
    const fields: (keyof RegisterFormData)[] = [
      'firstName', 'lastName', 'email', 'phone',
      'password', 'confirmPassword', 'activationCode', 'terms',
    ];
    const errs: FormErrors = {};
    fields.forEach(field => {
      const error = validateRegisterField(field, registerData, registerRole);
      if (error) (errs as Record<string, string>)[field] = error;
    });
    setRegisterErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Mise à jour des champs d'inscription + validation instantanée ──
  // Dès que l'utilisateur modifie un champ, on revalide immédiatement
  // ce champ (et, si le mot de passe change, la confirmation associée)
  // afin d'afficher/masquer le message d'erreur sans attendre la soumission.
  const handleRegisterChange = useCallback((partial: Partial<RegisterFormData>) => {
    setRegisterData(prev => {
      const next = { ...prev, ...partial };

      setRegisterErrors(prevErrors => {
        const nextErrors = { ...prevErrors };

        (Object.keys(partial) as (keyof RegisterFormData)[]).forEach(field => {
          const error = validateRegisterField(field, next, registerRole);
          if (error) (nextErrors as Record<string, string>)[field] = error;
          else delete (nextErrors as Record<string, string | undefined>)[field];
        });

        // Le mot de passe et sa confirmation sont liés : revalider l'un
        // quand l'autre change.
        if ('password' in partial || 'confirmPassword' in partial) {
          const confirmError = validateRegisterField('confirmPassword', next, registerRole);
          if (confirmError) nextErrors.confirmPassword = confirmError;
          else delete nextErrors.confirmPassword;
        }

        return nextErrors;
      });

      return next;
    });
  }, [registerRole, validateRegisterField]);

  // Finalise une connexion réussie (login direct ou après vérif 2FA)
  const completeLogin = useCallback((res: import('../types').AuthResponse) => {
    setUser(res.user);
    setSuccessAction('Connexion');
    setShowSuccess(true);
    /* Session unique : ce compte était déjà connecté sur un autre appareil,
     * qui vient d'être déconnecté par ce login-ci — message informatif,
     * non alarmiste (mission §13). */
    if (res.sessionReplaced) {
      showToast('ℹ️ Votre compte était déjà connecté sur un autre appareil. Cette ancienne session a été automatiquement fermée.');
    }
    setTimeout(() => navigate(ROLE_ROUTES[res.user.role] ?? '/home'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setUser, showToast]);

  // Soumission Login
  const handleLogin = useCallback(async () => {
    if (!validateLogin()) return;
    setIsLoading(true);
    try {
      const res = await authService.login({
        identifier: loginData.email.trim(),
        password:   loginData.password,
        rememberMe: loginData.rememberMe,
      });
      if ('requiresTwoFa' in res) {
        setTwoFaError('');
        setTwoFaChallengeToken(res.challengeToken);
        return;
      }
      if ('requiresAccountChoice' in res) {
        setAccountChoiceError('');
        setAccountChoiceOptions(res.accounts);
        return;
      }
      if ('requiresSessionConfirm' in res) {
        setSessionConfirmError('');
        setSessionConfirmPending({ via: 'login' });
        return;
      }
      completeLogin(res);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
      setLoginErrors({ general: msg });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginData, completeLogin]);

  // Soumission du choix de compte (étape 2 quand requiresAccountChoice) —
  // le mot de passe est revérifié côté serveur contre le userId choisi.
  const handleChooseAccount = useCallback(async (userId: string) => {
    setAccountChoiceError('');
    setIsLoading(true);
    try {
      const res = await authService.chooseAccount(
        loginData.email.trim(), loginData.password, userId, loginData.rememberMe,
      );
      if ('requiresTwoFa' in res) {
        setAccountChoiceOptions(null);
        setTwoFaError('');
        setTwoFaChallengeToken(res.challengeToken);
        return;
      }
      if ('requiresSessionConfirm' in res) {
        setSessionConfirmError('');
        setSessionConfirmPending({ via: 'account', userId });
        return;
      }
      setAccountChoiceOptions(null);
      completeLogin(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Identifiants incorrects.';
      setAccountChoiceError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [loginData, completeLogin]);

  // Retour à l'étape identifiants depuis l'écran de choix de compte
  const cancelAccountChoice = useCallback(() => {
    setAccountChoiceOptions(null);
    setAccountChoiceError('');
  }, []);

  // Confirmation "déconnecter l'autre appareil" — rappelle le même endpoint
  // (login ou choose-account, selon l'origine) avec confirmDisconnectOther:true.
  // La session précédente est alors fermée instantanément côté serveur, qui
  // diffuse un événement temps réel session:revoked à cet autre appareil
  // (voir AppContext.handleSessionRevoked côté client).
  const handleConfirmDisconnectOther = useCallback(async () => {
    if (!sessionConfirmPending) return;
    setSessionConfirmError('');
    setSessionConfirmLoading(true);
    try {
      if (sessionConfirmPending.via === 'account') {
        const res = await authService.chooseAccount(
          loginData.email.trim(), loginData.password, sessionConfirmPending.userId,
          loginData.rememberMe, true,
        );
        if ('requiresTwoFa' in res) {
          setSessionConfirmPending(null);
          setAccountChoiceOptions(null);
          setTwoFaError('');
          setTwoFaChallengeToken(res.challengeToken);
          return;
        }
        /* Ne devrait pas se reproduire (on vient de confirmer) — sauf
         * course très rare avec une 3e connexion entre-temps. */
        if ('requiresSessionConfirm' in res) {
          setSessionConfirmError('Une nouvelle connexion a eu lieu entre-temps. Réessayez.');
          return;
        }
        setSessionConfirmPending(null);
        setAccountChoiceOptions(null);
        completeLogin(res);
        return;
      }
      const res = await authService.login({
        identifier: loginData.email.trim(),
        password:   loginData.password,
        rememberMe: loginData.rememberMe,
        confirmDisconnectOther: true,
      });
      if ('requiresTwoFa' in res) {
        setSessionConfirmPending(null);
        setTwoFaError('');
        setTwoFaChallengeToken(res.challengeToken);
        return;
      }
      if ('requiresAccountChoice' in res) {
        setSessionConfirmPending(null);
        setAccountChoiceError('');
        setAccountChoiceOptions(res.accounts);
        return;
      }
      /* Ne devrait pas se reproduire (on vient de confirmer) — sauf
       * course très rare avec une 3e connexion entre-temps. */
      if ('requiresSessionConfirm' in res) {
        setSessionConfirmError('Une nouvelle connexion a eu lieu entre-temps. Réessayez.');
        return;
      }
      setSessionConfirmPending(null);
      completeLogin(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Identifiants incorrects.';
      setSessionConfirmError(msg);
    } finally {
      setSessionConfirmLoading(false);
    }
  }, [sessionConfirmPending, loginData, completeLogin]);

  // Retour à l'étape identifiants depuis l'écran de confirmation de session
  const cancelSessionConfirm = useCallback(() => {
    setSessionConfirmPending(null);
    setSessionConfirmError('');
  }, []);

  // Soumission du code 2FA (étape 2 du login)
  const handleVerifyTwoFa = useCallback(async (code: string) => {
    if (!twoFaChallengeToken) return;
    setTwoFaError('');
    setIsLoading(true);
    try {
      const res = await authService.verifyTwoFaLogin(twoFaChallengeToken, code);
      completeLogin(res);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Code invalide ou expiré. Réessayez.';
      setTwoFaError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [twoFaChallengeToken, completeLogin]);

  // Retour à l'étape identifiants depuis l'écran 2FA
  const cancelTwoFa = useCallback(() => {
    setTwoFaChallengeToken(null);
    setTwoFaError('');
  }, []);

  // Soumission Register
  const handleRegister = useCallback(async () => {
    if (!validateRegister()) return;
    setIsLoading(true);

    /* Invitation collaborateur : endpoint distinct, pas de JWT en retour
     * (voir CompanyTeamInvitationService.accept — ne connecte jamais
     * automatiquement). On bascule vers Connexion avec l'email déjà
     * rempli plutôt que de naviguer vers un dashboard. */
    if (collabInvite) {
      try {
        await authService.acceptCollabInvitation(collabInvite.token, {
          firstName: registerData.firstName,
          lastName:  registerData.lastName,
          password:  registerData.password,
          phone:     registerData.phone || undefined,
        });
        setSuccessAction('Inscription');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setLoginData(prev => ({ ...prev, email: registerData.email }));
          switchTab('login');
          showToast('✅ Compte créé — connectez-vous avec votre nouveau mot de passe.');
        }, 1800);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Erreur lors de l'inscription.";
        setRegisterErrors({ general: msg });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await authService.register({
        ...registerData,
        role: ROLE_MAP[registerRole] ?? registerRole,
      });
      setUser(res.user);
      setSuccessAction('Inscription');
      setShowSuccess(true);
      setTimeout(() => navigate(ROLE_ROUTES[res.user.role] ?? '/home'), 1500);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erreur lors de l'inscription.";
      if (msg.toLowerCase().includes('code'))
        setRegisterErrors({ activationCode: msg });
      else if (msg.toLowerCase().includes('email'))
        setRegisterErrors({ email: msg });
      else
        setRegisterErrors({ general: msg });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerData, registerRole, navigate, setUser, collabInvite, switchTab, showToast]);

  return {
    activeTab,
    loginRole,    registerRole,
    loginData,    setLoginData,
    registerData, setRegisterData,
    // ✅ Met à jour registerData ET valide instantanément les champs modifiés
    handleRegisterChange,
    loginErrors,  registerErrors,
    isLoading,
    showSuccess,  successAction,
    showForgot,   setShowForgot,
    toast,
    switchTab,
    selectLoginRole,
    selectRegisterRole,
    // ✅ Exposé pour que Login.tsx puisse forcer le rôle depuis l'invitation
    setRegisterRole,
    // ✅ Invitation collaborateur — voir Login.tsx, useCollabInviteParams
    collabInvite, setCollabInvite,
    handleLogin,
    handleRegister,
    validateRegisterStep,
    showToast,
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
  };
}