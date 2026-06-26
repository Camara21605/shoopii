/* ============================================================
 * FICHIER : src/modules/auth/hooks/useAuth.ts  (EXTRAIT MIS À JOUR)
 *
 * CHANGEMENTS :
 *  - validateRegister() valide désormais firstName, lastName
 *    (séparés), terms (obligatoire) et activationCode.
 *  - Le payload envoyé à l'API inclut firstName et lastName
 *    séparément (au lieu d'un seul champ name).
 *
 * NOTE : seule la partie modifiée est montrée ici.
 *        Intégrez ces changements dans votre useAuth existant.
 * ============================================================ */

import { useState } from 'react';
import type { Role } from '../types';
import { apiFetch } from '../../../shared/services/apiFetch';
import { ROLE_CONFIGS } from '../roleConfigs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegisterFormData {
  firstName:      string;
  lastName:       string;
  shopName?:      string;
  email:          string;
  phone:          string;
  password:       string;
  confirmPassword:string;
  activationCode: string;
  terms:          boolean;
}

export interface LoginFormData {
  email:      string;
  password:   string;
  rememberMe: boolean;
}

export interface FormErrors {
  firstName?:      string;
  lastName?:       string;
  email?:          string;
  phone?:          string;
  password?:       string;
  confirmPassword?:string;
  activationCode?: string;
  terms?:          string;
  general?:        string;
}

// ─── Rôles nécessitant un code d'activation ──────────────────────────────────

const ROLES_REQUIRING_CODE: Role[] = [
  'company', 'delivery', 'partner', 'admin', 'correspondent',
];

// ─────────────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [activeTab,     setActiveTab]     = useState<'login' | 'register'>('login');
  const [loginRole,     setLoginRole]     = useState<Role>('client');
  const [registerRole,  setRegisterRole]  = useState<Role>('client');

  const [loginData,    setLoginData]    = useState<LoginFormData>({
    email: '', password: '', rememberMe: false,
  });
  const [registerData, setRegisterData] = useState<RegisterFormData>({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '', activationCode: '', terms: false,
  });

  const [loginErrors,    setLoginErrors]    = useState<FormErrors>({});
  const [registerErrors, setRegisterErrors] = useState<FormErrors>({});

  const [isLoading,     setIsLoading]    = useState(false);
  const [showSuccess,   setShowSuccess]  = useState(false);
  const [successAction, setSuccessAction]= useState<'Connexion' | 'Inscription'>('Connexion');
  const [showForgot,    setShowForgot]   = useState(false);
  const [toast,         setToast]        = useState({ msg: '', visible: false });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setLoginErrors({});
    setRegisterErrors({});
  };

  const selectLoginRole    = (role: Role) => setLoginRole(role);
  const selectRegisterRole = (role: Role, _icon: string) => setRegisterRole(role);

  const showToast = (msg: string) => {
    setToast({ msg, visible: true });
    setTimeout(() => setToast({ msg: '', visible: false }), 3000);
  };

  // ── Validation Inscription ────────────────────────────────────────────────

  const validateRegister = (): boolean => {
    const errors: FormErrors = {};

    /* Prénom */
    if (!registerData.firstName.trim())
      errors.firstName = 'Le prénom est obligatoire.';

    /* Nom */
    if (!registerData.lastName.trim())
      errors.lastName = 'Le nom est obligatoire.';

    /* Email */
    if (!registerData.email.trim())
      errors.email = "L'adresse email est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email))
      errors.email = 'Adresse email invalide.';

    /* Mot de passe */
    if (!registerData.password)
      errors.password = 'Le mot de passe est obligatoire.';
    else if (registerData.password.length < 8)
      errors.password = 'Le mot de passe doit faire au moins 8 caractères.';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(registerData.password))
      errors.password = 'Doit contenir une majuscule, une minuscule et un chiffre.';

    /* Confirmation */
    if (registerData.password !== registerData.confirmPassword)
      errors.confirmPassword = 'Les mots de passe ne correspondent pas.';

    /* Code d'activation */
    if (ROLES_REQUIRING_CODE.includes(registerRole)) {
      const code = registerData.activationCode?.replace(/-/g, '') ?? '';
      if (!code)
        errors.activationCode = 'Le code d\'invitation est obligatoire pour ce rôle.';
      else if (code.length !== 10)
        errors.activationCode = 'Le code doit contenir 10 caractères (format XXXX-XXXX-XX).';
    }

    /* Conditions d'utilisation — OBLIGATOIRE */
    if (!registerData.terms)
      errors.terms = 'Vous devez accepter les conditions d\'utilisation pour continuer.';

    setRegisterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Validation Connexion ──────────────────────────────────────────────────

  const validateLogin = (): boolean => {
    const errors: FormErrors = {};
    if (!loginData.email.trim())    errors.email    = 'L\'identifiant est obligatoire.';
    if (!loginData.password.trim()) errors.password = 'Le mot de passe est obligatoire.';
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Soumission Inscription ────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!validateRegister()) return;
    setIsLoading(true);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          firstName:      registerData.firstName.trim(),
          lastName:       registerData.lastName.trim(),
          email:          registerData.email.trim().toLowerCase(),
          phone:          registerData.phone.trim() || undefined,
          password:       registerData.password,
          role:           registerRole,
          activationCode: ROLES_REQUIRING_CODE.includes(registerRole)
                            ? registerData.activationCode
                            : undefined,
          shopName:       ROLE_CONFIGS[registerRole]?.shop
                            ? registerData.shopName?.trim()
                            : undefined,
        },
      });

      setSuccessAction('Inscription');
      setShowSuccess(true);
    } catch (err: unknown) {
      const message = (err as any)?.message ?? 'Une erreur est survenue. Réessayez.';
      setRegisterErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Soumission Connexion ──────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!validateLogin()) return;
    setIsLoading(true);

    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: {
          identifier: loginData.email.trim(),
          password:   loginData.password,
          rememberMe: loginData.rememberMe,
        },
      });

      setSuccessAction('Connexion');
      setShowSuccess(true);
    } catch (err: unknown) {
      const message = (err as any)?.message ?? 'Identifiants incorrects.';
      setLoginErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Retour ────────────────────────────────────────────────────────────────

  return {
    activeTab, loginRole, registerRole,
    loginData, setLoginData,
    registerData, setRegisterData,
    loginErrors, registerErrors,
    isLoading, showSuccess, successAction,
    showForgot, setShowForgot,
    toast,

    switchTab,
    selectLoginRole,
    selectRegisterRole,
    handleLogin,
    handleRegister,
    showToast,
  };
}