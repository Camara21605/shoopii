// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/hooks/useLoginPage.ts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';
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

/* Âge minimum à l'inscription selon le rôle choisi — doit rester
 * synchronisé avec MIN_AGE_BY_ROLE côté backend (register.dto.ts /
 * min-age-for-role.validator.ts), qui reste la source de vérité :
 * ce contrôle frontend n'est qu'un retour immédiat à l'utilisateur,
 * le serveur revalide systématiquement. Client : aucune restriction. */
const MIN_AGE_BY_ROLE: Partial<Record<Role, number>> = {
  client:        18,
  delivery:      18,
  company:       18,
  correspondent: 18,
  partner:       20,
  admin:         25,
};

const ROLE_AGE_LABEL: Record<string, string> = {
  client: 'client', delivery: 'livreur', company: 'entreprise', correspondent: 'correspondant',
  partner: 'partenaire', admin: 'administrateur',
};

function computeAge(birthDateStr: string): number {
  const birth = new Date(birthDateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function validateMinAgeForRole(birthDateStr: string, role: Role): string | undefined {
  const minAge = MIN_AGE_BY_ROLE[role];
  if (!minAge) return undefined;
  if (Number.isNaN(new Date(birthDateStr).getTime())) return undefined;
  if (computeAge(birthDateStr) < minAge) {
    return `Vous devez avoir au moins ${minAge} ans pour vous inscrire en tant que ${ROLE_AGE_LABEL[role]}.`;
  }
  return undefined;
}

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
  /** Rôle verrouillé par un lien d'invitation (?role&code&email) — voir
   *  Login.tsx useInviteParams/effectiveLockedRole. Quand présent, le
   *  parcours saute la localisation GPS (RegisterForm.tsx needsLocation)
   *  au profit d'un simple champ "Ville d'origine" : la validation doit
   *  le savoir pour exiger le bon champ (voir 'location'/'city' dans
   *  validateRegisterField ci-dessous). */
  lockedRole?: UserRole | null;
  /** Lien de vérification email en un clic (?verifyUserId&verifyCode&verifyEmail)
   *  — voir Login.tsx useVerifyLinkParams. Quand présent, déclenche
   *  automatiquement handleVerifyEmailCode() au montage, sans attendre
   *  que l'utilisateur retape le code à la main. */
  verifyLinkParams?: { userId: string; email: string; code: string } | null;
}

export function useLoginPage(options: UseLoginPageOptions = {}) {
  const { initialTab = 'login', lockedRole = null, verifyLinkParams = null } = options;

  const navigate    = useNavigate();
  const { setUser } = useAppContext();

  const [activeTab,      setActiveTab]      = useState<Tab>(initialTab);
  const [loginRole,      setLoginRole]      = useState<Role>('client');
  const [registerRole,   setRegisterRole]   = useState<Role>('client');
  const [loginData,      setLoginData]      = useState<LoginFormData>(INITIAL_LOGIN_DATA);
  const [registerData,   setRegisterData]   = useState<RegisterFormData>(INITIAL_REGISTER_DATA);
  /* Logo entreprise choisi à l'étape "Identité" — jamais envoyé dans le
   * payload JSON de POST /auth/register (impossible, ce n'est pas un
   * fichier). Uploadé séparément juste après une inscription/connexion
   * réussie, une fois les cookies d'authentification posés (voir
   * maybeUploadRegisterLogo ci-dessous) — aucun endpoint d'upload de ce
   * projet n'accepte de requête anonyme. */
  const [registerLogoFile, setRegisterLogoFile] = useState<File | null>(null);
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

  /* ── 2FA obligatoire (PlatformSettings.adminTwoFaRequired) — la
   * connexion est complétée avec succès (identifiants + éventuelle 2FA
   * déjà existante OK) mais ce compte ADMIN/SUPER_ADMIN n'a pas encore
   * configuré sa propre 2FA alors que le super-admin l'a rendue
   * obligatoire. On retient la réponse de connexion sans encore
   * naviguer vers le dashboard : TwoFaSetupModal s'affiche sans
   * possibilité de fermeture, la navigation ne reprend qu'après
   * confirmation du code TOTP. */
  const [twoFaSetupPending, setTwoFaSetupPending] = useState<import('../types').AuthResponse | null>(null);

  // ── Vérification email obligatoire (PlatformSettings.emailVerifRequired) ──
  // Posé par register()/login()/chooseAccount() — voir EmailVerificationScreen.
  const [emailVerifyPending, setEmailVerifyPending] = useState<{ email: string; userId: string } | null>(null);
  const [emailVerifyError,   setEmailVerifyError]   = useState('');
  const [emailVerifyResending, setEmailVerifyResending] = useState(false);

  /* ── Politique d'inscription publique (PlatformSettings.openSignup /
   * .codeRequiredForCompany) — lue une fois au montage, indépendamment de
   * toute session. BUG CORRIGÉ : ces deux réglages bloquaient déjà
   * l'inscription côté serveur, mais rien côté UI n'en tenait compte —
   * "Client"/"Entreprise" restaient cliquables et le code restait exigé
   * dans le formulaire même quand le super-admin l'avait désactivé,
   * jusqu'à l'échec surprise à la toute fin de la soumission.
   * Valeurs par défaut "ouvert"/"code requis" (comportement historique)
   * tant que l'appel n'a pas répondu ou en cas d'échec réseau — jamais de
   * blocage fantôme sur une simple erreur réseau. */
  const [openSignup,              setOpenSignup]              = useState(true);
  const [codeRequiredForCompany,  setCodeRequiredForCompany]  = useState(true);
  useEffect(() => {
    let cancelled = false;
    authService.getRegistrationPolicy()
      .then(p => {
        if (cancelled) return;
        setOpenSignup(p.openSignup);
        setCodeRequiredForCompany(p.codeRequiredForCompany);
      })
      .catch(() => { /* silencieux — repli sur les valeurs par défaut ci-dessus */ });
    return () => { cancelled = true; };
  }, []);

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
      /* Une entreprise n'a pas de "prénom"/"nom" — seul le nom de la
       * boutique (shopName) est demandé pour ce rôle, voir plus bas.
       * Exception : un COLLABORATEUR invité (collabInvite) rejoint une
       * entreprise EXISTANTE en tant que personne réelle — son propre
       * prénom/nom reste exigé (voir acceptCollabInvitation). */
      case 'firstName':
        if (role === 'company' && !collabInvite) return undefined;
        return !data.firstName.trim() ? 'Prénom requis.' : undefined;

      case 'lastName':
        if (role === 'company' && !collabInvite) return undefined;
        return !data.lastName.trim() ? 'Nom requis.' : undefined;

      case 'email':
        if (!data.email.trim()) return 'Email requis.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Adresse email invalide.';
        return undefined;

      case 'phone':
        return !data.phone.trim() ? 'Téléphone requis.' : undefined;

      /*
       * BUG CORRIGÉ — cette validation n'exigeait pas de caractère
       * spécial, alors que le backend (register.dto.ts, @Matches) l'a
       * toujours exigé. Un mot de passe comme "Password1" passait donc
       * cette étape et le clic "Créer mon compte", pour être rejeté
       * ensuite par le serveur (400) — rejet que l'utilisateur ne
       * pouvait pas anticiper. Règle désormais identique des deux côtés.
       */
      case 'password':
        if (data.password.length < 8) return 'Mot de passe trop court (8 caractères min).';
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(data.password))
          return 'Doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.';
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
        /* BUG CORRIGÉ — ROLE_CONFIGS.company.code est statiquement `true` :
         * le code restait exigé côté formulaire même quand le super-admin
         * désactivait PlatformSettings.codeRequiredForCompany (Paramètres
         * Plateforme > Inscriptions). Seul "company" a un réglage dynamique
         * — les autres rôles (livreur, partenaire, correspondant, admin)
         * gardent leur code obligatoire codé en dur, non concernés par ce
         * réglage. */
        const codeRequired = role === 'company' ? codeRequiredForCompany : cfg?.code;
        return codeRequired && !data.activationCode?.trim()
          ? "Code d'activation requis pour ce rôle."
          : undefined;
      }

      case 'terms':
        return !data.terms ? "Vous devez accepter les conditions d'utilisation pour continuer." : undefined;

      /*
       * BUG CORRIGÉ — shopName et companyTypeId n'étaient validés nulle
       * part (ni dans STEP_FIELDS/validateRegister, ni ici : le
       * `default: return undefined` les laissait toujours passer). Un
       * compte entreprise pouvait donc être créé sans nom de boutique
       * ni type — uniquement pour le rôle "company", et jamais pour un
       * collaborateur invité (isCollabInvite/collabInvite : il rejoint
       * une entreprise déjà existante, voir RegisterForm.tsx
       * `roleConfig.shop && !isCollabInvite`).
       */
      case 'businessModel':
        if (role !== 'company' || collabInvite) return undefined;
        return !data.businessModel ? 'Choisissez "Produits" ou "Services".' : undefined;

      case 'shopName':
        if (role !== 'company' || collabInvite) return undefined;
        return !data.shopName?.trim() ? 'Nom de la boutique / entreprise requis.' : undefined;

      case 'companyTypeId':
        if (role !== 'company' || collabInvite) return undefined;
        return !data.companyTypeId?.trim() ? "Type d'entreprise requis." : undefined;

      /* OBLIGATOIRE : au moins une catégorie pour une entreprise. Le backend
       * revérifie de toute façon (AuthService.resolveCompanyCategories). */
      case 'categoryIds':
        if (role !== 'company' || collabInvite) return undefined;
        return !(data.categoryIds?.length) ? 'Choisissez au moins une catégorie.' : undefined;

      /*
       * BUG CORRIGÉ — date de naissance et genre étaient affichés
       * "(optionnel)" à l'étape Profil mais doivent en réalité être
       * obligatoires, pour tous les rôles (décision explicite,
       * confirmée y compris pour le rôle client). Exclus pour un
       * collaborateur invité (collabInvite) : ce parcours rejoint une
       * entreprise EXISTANTE via une route et un payload dédiés
       * (acceptCollabInvitation → POST /company-team/invitations/
       * accept/:token, { firstName, lastName, password, phone? }) qui
       * ne transmettent jamais birthDate/gender — les rendre
       * obligatoires ici bloquerait cette inscription pour des données
       * qui ne seraient de toute façon jamais envoyées.
       */
      case 'birthDate':
        if (collabInvite) return undefined;
        if (!data.birthDate?.trim()) return 'Date de naissance requise.';
        return validateMinAgeForRole(data.birthDate, role);

      case 'gender':
        if (collabInvite) return undefined;
        return !data.gender?.trim() ? 'Genre requis.' : undefined;

      /*
       * BUG CORRIGÉ — la localisation (LocationPermission /
       * CompanyLocationSelect) n'était validée nulle part : les boutons
       * "Ignorer" permettaient de finir l'inscription sans aucune
       * position. Désormais obligatoire pour client/delivery/partner/
       * correspondent (latitude+longitude, détection auto) et company
       * (companyPaysId+companyVilleId, sélection manuelle dans le
       * référentiel géo — voir CompanyLocationSelect.tsx). Non concerné
       * : rôles hors LOCATION_ROLES (RegisterForm.tsx) et collabInvite,
       * qui rejoint une entreprise existante sans redemander sa position.
       */
      /*
       * BUG CORRIGÉ — un utilisateur invité par lien (?role&code&email,
       * lockedRole) ne voit jamais l'étape GPS/carte (needsLocation=false
       * dans RegisterForm.tsx) : à la place, un simple champ "Ville
       * d'origine" (data.city) lui est proposé. Cette validation exigeait
       * pourtant latitude/longitude dans TOUS les cas pour ces rôles,
       * sans jamais tenir compte de lockedRole — un partenaire/livreur/
       * correspondant invité ne pouvait donc JAMAIS finaliser son
       * inscription (le champ qu'on lui montre — la ville — n'était de
       * toute façon pas celui vérifié ici). Voir le cas 'city' juste
       * après pour le champ réellement exigé dans ce parcours.
       */
      /* Le client doit voir dans quel QUARTIER se trouve l'entreprise, le livreur ou le
       * correspondant : sans quartier, sa carte et son profil ne peuvent pas le dire. */
      case 'quartier':
        if (collabInvite) return undefined;
        if (role === 'company' || role === 'delivery' || role === 'correspondent') {
          return !data.quartier?.trim()
            ? 'Le quartier est obligatoire : les clients doivent savoir où vous trouver.'
            : undefined;
        }
        return undefined;

      case 'city':
        if (!lockedRole) return undefined; // hors invitation : pas de champ "Ville d'origine" affiché (voir needsLocation)
        return !data.city?.trim() ? "Ville d'origine requise." : undefined;

      case 'location': {
        if (collabInvite || lockedRole) return undefined;
        if (role === 'company') {
          return (!data.companyPaysId || !data.companyVilleId)
            ? "La localisation de l'entreprise est obligatoire."
            : undefined;
        }
        if (role === 'client' || role === 'delivery' || role === 'partner' || role === 'correspondent') {
          return (data.latitude == null || data.longitude == null)
            ? 'La localisation est obligatoire.'
            : undefined;
        }
        return undefined;
      }

      default:
        return undefined;
    }
  }, [collabInvite, codeRequiredForCompany]);

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
      'shopName', 'companyTypeId', 'categoryIds', 'birthDate', 'gender', 'location', 'city', 'quartier',
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

  /* Envoie le logo choisi à l'étape "Identité" — pertinent uniquement
   * juste après la CRÉATION d'un compte entreprise (registerLogoFile
   * reste null dans tout autre contexte : connexion normale, 2FA,
   * session-confirm… donc no-op silencieux partout ailleurs). Ne peut
   * être envoyé qu'une fois les cookies d'authentification posés —
   * aucun endpoint d'upload de ce projet n'accepte de requête anonyme,
   * voir POST /dashboard/entreprise/parametres/logo (uploadCompanyLogo). */
  const maybeUploadRegisterLogo = useCallback((role: string) => {
    if (role !== 'company' || !registerLogoFile) return;
    const file = registerLogoFile;
    setRegisterLogoFile(null);
    authService.uploadCompanyLogo(file).catch(() => {
      showToast("⚠️ Compte créé, mais le logo n'a pas pu être envoyé — ajoutez-le depuis Paramètres > Boutique.");
    });
  }, [registerLogoFile, showToast]);

  // Finalise une connexion réussie (login direct ou après vérif 2FA)
  const completeLogin = useCallback((res: import('../types').AuthResponse) => {
    /* 2FA obligatoire mais pas encore configurée sur ce compte admin —
     * on bloque avant toute navigation, voir twoFaSetupPending ci-dessus. */
    if (res.twoFaSetupRequired) {
      setTwoFaSetupPending(res);
      return;
    }
    setUser(res.user);
    maybeUploadRegisterLogo(res.user.role);
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
  }, [navigate, setUser, showToast, maybeUploadRegisterLogo]);

  // Appelé après confirmation réussie du code TOTP dans TwoFaSetupModal —
  // reprend exactement le flux normal de fin de connexion.
  const finishTwoFaSetup = useCallback(() => {
    if (!twoFaSetupPending) return;
    const res = twoFaSetupPending;
    setTwoFaSetupPending(null);
    setUser(res.user);
    setSuccessAction('Connexion');
    setShowSuccess(true);
    if (res.sessionReplaced) {
      showToast('ℹ️ Votre compte était déjà connecté sur un autre appareil. Cette ancienne session a été automatiquement fermée.');
    }
    setTimeout(() => navigate(ROLE_ROUTES[res.user.role] ?? '/home'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFaSetupPending, navigate, setUser, showToast]);

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
      if ('requiresEmailVerification' in res) {
        setEmailVerifyError('');
        setEmailVerifyPending({ email: res.email, userId: res.userId });
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
      if ('requiresEmailVerification' in res) {
        setAccountChoiceOptions(null);
        setEmailVerifyError('');
        setEmailVerifyPending({ email: res.email, userId: res.userId });
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
        if ('requiresEmailVerification' in res) {
          setSessionConfirmPending(null);
          setAccountChoiceOptions(null);
          setEmailVerifyError('');
          setEmailVerifyPending({ email: res.email, userId: res.userId });
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
      if ('requiresEmailVerification' in res) {
        setSessionConfirmPending(null);
        setEmailVerifyError('');
        setEmailVerifyPending({ email: res.email, userId: res.userId });
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
      /* Vérification email requise (PlatformSettings.emailVerifRequired) :
       * pas de connexion automatique tant que le code n'est pas confirmé —
       * voir EmailVerificationScreen. */
      if ('requiresEmailVerification' in res) {
        setEmailVerifyError('');
        setEmailVerifyPending({ email: res.email, userId: res.userId });
        return;
      }
      setUser(res.user);
      maybeUploadRegisterLogo(res.user.role);
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
  }, [registerData, registerRole, navigate, setUser, collabInvite, switchTab, showToast, maybeUploadRegisterLogo]);

  // Soumission du code de vérification email
  /* `target` optionnel — permet à l'auto-vérification par lien (voir l'effet
   * verifyLinkParams plus bas) de fournir userId directement plutôt que de
   * dépendre de emailVerifyPending, qui n'a pas encore eu le temps d'être
   * mis à jour par React au moment où cet effet appelle cette fonction
   * (setEmailVerifyPending + handleVerifyEmailCode dans le même tick). */
  const handleVerifyEmailCode = useCallback(async (code: string, target?: { userId: string }) => {
    const pending = target ?? emailVerifyPending;
    if (!pending) return;
    setEmailVerifyError('');
    setIsLoading(true);
    try {
      const res = await authService.verifyEmail(pending.userId, code);
      setEmailVerifyPending(null);
      completeLogin(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Code invalide ou expiré. Réessayez.';
      setEmailVerifyError(msg);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailVerifyPending, completeLogin]);

  /* Auto-vérification depuis le lien d'activation en un clic de l'email
   * (?verifyUserId&verifyCode&verifyEmail — voir Login.tsx useVerifyLinkParams
   * et email.service.ts sendEmailVerificationOtp). Affiche l'écran de
   * vérification (comme un flux normal) ET soumet immédiatement le code
   * reçu dans l'URL — l'utilisateur voit brièvement l'écran passer en
   * "vérification…" puis atterrit connecté, sans rien taper. En cas
   * d'échec (code expiré/déjà utilisé), l'écran reste affiché avec
   * l'erreur, champ vide, prêt pour une saisie manuelle ou un renvoi. */
  const autoVerifyTriedRef = useRef(false);
  useEffect(() => {
    if (!verifyLinkParams || autoVerifyTriedRef.current) return;
    autoVerifyTriedRef.current = true;
    setEmailVerifyPending({ email: verifyLinkParams.email, userId: verifyLinkParams.userId });
    void handleVerifyEmailCode(verifyLinkParams.code, { userId: verifyLinkParams.userId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyLinkParams]);

  // Renvoyer le code de vérification email
  const handleResendEmailVerification = useCallback(async () => {
    if (!emailVerifyPending) return;
    setEmailVerifyResending(true);
    try {
      await authService.resendVerification(emailVerifyPending.userId);
      showToast('📧 Un nouveau code a été envoyé.');
    } catch {
      showToast("❌ Impossible d'envoyer le code pour le moment.");
    } finally {
      setEmailVerifyResending(false);
    }
  }, [emailVerifyPending, showToast]);

  // Retour à l'étape identifiants depuis l'écran de vérification email
  const cancelEmailVerify = useCallback(() => {
    setEmailVerifyPending(null);
    setEmailVerifyError('');
  }, []);

  return {
    activeTab,
    loginRole,    registerRole,
    loginData,    setLoginData,
    registerData, setRegisterData,
    // ✅ Logo entreprise choisi à l'inscription — voir maybeUploadRegisterLogo
    registerLogoFile, setRegisterLogoFile,
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
    // ✅ 2FA obligatoire (super-admin) — configuration forcée avant accès dashboard
    twoFaSetupPending,
    finishTwoFaSetup,
    // ✅ Vérification email obligatoire — voir EmailVerificationScreen
    emailVerifyPending,
    emailVerifyError,
    emailVerifyResending,
    handleVerifyEmailCode,
    handleResendEmailVerification,
    cancelEmailVerify,
    // ✅ Politique d'inscription publique — voir RoleSelector / RegisterForm
    openSignup,
    codeRequiredForCompany,
  };
}