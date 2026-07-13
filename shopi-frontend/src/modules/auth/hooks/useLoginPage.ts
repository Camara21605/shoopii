// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/hooks/useLoginPage.ts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
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

  const showToast = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    setTimeout(() => setToast({ msg: '', visible: false }), 3000);
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
  }, []);

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
      setUser(res.user);
      setSuccessAction('Connexion');
      setShowSuccess(true);
      setTimeout(() => navigate(ROLE_ROUTES[res.user.role] ?? '/home'), 1500);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
      setLoginErrors({ general: msg });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginData, navigate, setUser]);

  // Soumission Register
  const handleRegister = useCallback(async () => {
    if (!validateRegister()) return;
    setIsLoading(true);
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
  }, [registerData, registerRole, navigate, setUser]);

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
    handleLogin,
    handleRegister,
    validateRegisterStep,
    showToast,
  };
}