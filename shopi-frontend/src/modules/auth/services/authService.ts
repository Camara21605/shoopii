// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/services/authService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';
import { getOrCreateDeviceId }    from '../../../shared/services/deviceId';
import type {
  AuthResponse,
  LoginResult,
  RegisterResult,
  PublicUser,
  RegisterPayload,
  LoginPayload,
  ForgotPasswordPayload,
  RegisterFormData,
  Role,
  TwoFaChallengeResponse,
  AccountChoiceResponse,
  SessionConfirmResponse,
} from '../types';

function buildRegisterPayload(
  formData: RegisterFormData & { role: Role },
): RegisterPayload {
  const {
    firstName, lastName, email, phone, password, role,
    activationCode, shopName, companyTypeId,
    // Pays
    countryCode, countryName, dialCode,
    // Localisation
    latitude, longitude, locationAccuracy,
    address, city, district, region, country, postalCode, gpsEnabled,
  } = formData;

  const payload: RegisterPayload = {
    firstName,
    lastName,
    email,
    phone,
    password,
    role,
  };

  // Code d'activation — omis pour 'client' si vide
  if (activationCode && activationCode.trim() !== '') {
    payload.activationCode = activationCode.trim();
  }

  // Nom de boutique → companyName (seulement pour role='company')
  if (role === 'company' && shopName && shopName.trim() !== '') {
    payload.companyName = shopName.trim();
  }

  // Type d'entreprise (seulement pour role='company')
  if (role === 'company' && companyTypeId && companyTypeId.trim() !== '') {
    payload.companyTypeId = companyTypeId.trim();
  }

  // Pays détecté via indicatif
  if (countryCode) payload.countryCode = countryCode;
  if (countryName) payload.countryName = countryName;
  if (dialCode)    payload.dialCode    = dialCode;

  // Localisation GPS / manuelle (seulement si coordonnées présentes)
  if (latitude  != null) payload.latitude  = latitude;
  if (longitude != null) payload.longitude = longitude;
  if (locationAccuracy)  payload.locationAccuracy = locationAccuracy;
  if (address)           payload.address   = address;
  if (city)              payload.city      = city;
  if (district)          payload.district  = district;
  if (region)            payload.region    = region;
  if (country)           payload.country   = country;
  if (postalCode)        payload.postalCode = postalCode;
  if (gpsEnabled != null) payload.gpsEnabled = gpsEnabled;

  return payload;
}

export async function register(
  formData: RegisterFormData & { role: Role },
): Promise<RegisterResult> {
  const payload = buildRegisterPayload(formData);
  payload.deviceId = getOrCreateDeviceId();

  const data = await apiFetch<RegisterResult>('/auth/register', {
    method: 'POST',
    body:   payload,
    public: true,
  });

  // Vérification email requise : aucun token émis, voir EmailVerificationScreen.
  if ('requiresEmailVerification' in data) return data;

  tokenStorage.set(data.accessToken);
  return data;
}

/** Info publique d'une invitation collaborateur (email/prénom/nom/poste
 *  pré-remplis) — GET /company-team/invitations/accept/:token, public. */
export interface CollabInvitationInfo {
  email:      string;
  firstName?: string;
  lastName?:  string;
  jobTitle?:  string;
  companyId:  string;
  expiresAt:  string;
  status:     string;
}

export async function getCollabInvitationInfo(token: string): Promise<CollabInvitationInfo> {
  return apiFetch<CollabInvitationInfo>(`/company-team/invitations/accept/${token}`, {
    method: 'GET',
    public: true,
  });
}

/**
 * Accepte une invitation collaborateur et crée le compte — contrairement à
 * register(), ne renvoie PAS de JWT (POST /company-team/invitations/accept/:token
 * ne connecte pas automatiquement, voir CompanyTeamInvitationService.accept) :
 * l'appelant doit rediriger vers l'onglet Connexion après succès.
 */
export async function acceptCollabInvitation(
  token: string,
  data: { firstName: string; lastName: string; password: string; phone?: string },
): Promise<{ message: string; email: string }> {
  return apiFetch<{ message: string; email: string }>(`/company-team/invitations/accept/${token}`, {
    method: 'POST',
    body:   data,
    public: true,
  });
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const data = await apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body:   { ...payload, deviceId: getOrCreateDeviceId() },
    public: true,
  });
  // Compte avec 2FA active : pas de token émis tant que le code n'est
  // pas vérifié via verifyTwoFaLogin() ci-dessous.
  if ('requiresTwoFa' in data) return data;
  // Identifiant + mot de passe partagés par un compte pro et son compte
  // client lié (coïncidence) : pas de token tant que l'utilisateur n'a
  // pas choisi via chooseAccount() ci-dessous.
  if ('requiresAccountChoice' in data) return data;
  // Compte déjà connecté sur un autre appareil : pas de token tant que
  // l'utilisateur n'a pas confirmé vouloir déconnecter l'autre appareil
  // (rappel de login() ci-dessus avec confirmDisconnectOther:true).
  if ('requiresSessionConfirm' in data) return data;
  // Compte jamais vérifié (PlatformSettings.emailVerifRequired) : pas de
  // token tant que le code n'est pas confirmé via verifyEmail() ci-dessous.
  if ('requiresEmailVerification' in data) return data;
  tokenStorage.set(data.accessToken);
  return data;
}

/** 2e appel quand login() a renvoyé requiresAccountChoice — le mot de passe
 *  est revérifié côté serveur contre le userId choisi. */
export async function chooseAccount(
  identifier: string, password: string, userId: string, rememberMe?: boolean,
  confirmDisconnectOther?: boolean,
): Promise<AuthResponse | TwoFaChallengeResponse | SessionConfirmResponse | import('../types').EmailVerificationRequiredResponse> {
  const data = await apiFetch<AuthResponse | TwoFaChallengeResponse | SessionConfirmResponse | import('../types').EmailVerificationRequiredResponse>('/auth/login/choose-account', {
    method: 'POST',
    body:   { identifier, password, userId, rememberMe, confirmDisconnectOther, deviceId: getOrCreateDeviceId() },
    public: true,
  });
  if ('requiresTwoFa' in data) return data;
  if ('requiresSessionConfirm' in data) return data;
  if ('requiresEmailVerification' in data) return data;
  tokenStorage.set(data.accessToken);
  return data;
}

/** Confirme le code OTP reçu par email — voir EmailVerificationScreen. */
export async function verifyEmail(userId: string, code: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body:   { userId, code },
    public: true,
  });
  tokenStorage.set(data.accessToken);
  return data;
}

/** Renvoie un nouveau code de vérification email. */
export async function resendVerification(userId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    body:   { userId },
    public: true,
  });
}

export async function verifyTwoFaLogin(
  challengeToken: string,
  code:           string,
): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/2fa/verify-login', {
    method: 'POST',
    body:   { challengeToken, code },
    public: true,
  });
  tokenStorage.set(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  tokenStorage.remove();
  /* Efface aussi le cookie httpOnly côté serveur — fire & forget côté UI
   * (AppContext.logout() n'attend pas cette promesse pour rester réactif),
   * mais keepalive:true est indispensable : sans lui, un utilisateur qui
   * navigue ou recharge la page juste après avoir cliqué "Déconnexion" peut
   * voir cette requête annulée avant même d'atteindre le serveur — le cookie
   * de session reste alors valide, et la session "revient" silencieusement
   * au chargement suivant (voir apiFetch.ts pour le détail du bug observé).
   *
   * Le `.catch` NE DOIT JAMAIS rester silencieux : un 403 CSRF (jeton
   * manquant/périmé) ou toute autre erreur ici laisse EXACTEMENT le même
   * cookie de session valide côté serveur, avec zéro signal pour le
   * diagnostiquer si on avale l'erreur sans rien logger. */
  await apiFetch('/auth/logout', { method: 'POST', public: true, keepalive: true })
    .catch(err => console.error('[Auth] POST /auth/logout a échoué — la session côté serveur n\'a peut-être pas été révoquée :', err));
}

/** accountUserId : requis seulement en 2e appel, quand la 1re réponse était
 *  requiresAccountChoice (identifiant partagé par un compte pro et son
 *  compte client lié — voir "Mon espace"). */
export async function verifyOtp(
  identifier: string,
  code: string,
  accountUserId?: string,
): Promise<{ resetToken: string } | AccountChoiceResponse> {
  return apiFetch<{ resetToken: string } | AccountChoiceResponse>('/auth/verify-otp', {
    method: 'POST',
    body:   { identifier, code, accountUserId },
    public: true,
  });
}

export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body:   { resetToken, newPassword },
    public: true,
  });
}

export async function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body:   payload,
    public: true,
  });
}

export async function getMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/me');
}

/** PlatformSettings.sessionTimeoutMin (Paramètres Plateforme > Sécurité) —
 *  utilisé par AppContext pour armer le minuteur de déconnexion automatique
 *  après inactivité. */
export async function getSessionPolicy(): Promise<{ sessionTimeoutMin: number }> {
  return apiFetch<{ sessionTimeoutMin: number }>('/auth/session-policy');
}

export function isAuthenticated(): boolean {
  return !!tokenStorage.get();
}

/** PlatformSettings.openSignup / .codeRequiredForCompany — publique, lue
 *  par useLoginPage pour griser les rôles fermés et ne plus exiger de
 *  code d'inscription entreprise quand le super-admin l'a désactivé. */
export async function getRegistrationPolicy(): Promise<{ openSignup: boolean; codeRequiredForCompany: boolean }> {
  return apiFetch<{ openSignup: boolean; codeRequiredForCompany: boolean }>('/public/registration-policy', { public: true });
}

export const authService = {
  register,
  getCollabInvitationInfo,
  acceptCollabInvitation,
  login,
  chooseAccount,
  verifyTwoFaLogin,
  verifyEmail,
  resendVerification,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getMe,
  getSessionPolicy,
  getRegistrationPolicy,
  isAuthenticated,
};