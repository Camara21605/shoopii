// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/services/authService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';
import { getOrCreateDeviceId }    from '../../../shared/services/deviceId';
import type {
  AuthResponse,
  LoginResult,
  PublicUser,
  RegisterPayload,
  LoginPayload,
  ForgotPasswordPayload,
  RegisterFormData,
  Role,
  TwoFaChallengeResponse,
  AccountChoiceResponse,
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
): Promise<AuthResponse> {
  const payload = buildRegisterPayload(formData);
  payload.deviceId = getOrCreateDeviceId();

  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body:   payload,
    public: true,
  });

  tokenStorage.set(data.accessToken);
  return data;
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
  tokenStorage.set(data.accessToken);
  return data;
}

/** 2e appel quand login() a renvoyé requiresAccountChoice — le mot de passe
 *  est revérifié côté serveur contre le userId choisi. */
export async function chooseAccount(
  identifier: string, password: string, userId: string, rememberMe?: boolean,
): Promise<AuthResponse | TwoFaChallengeResponse> {
  const data = await apiFetch<AuthResponse | TwoFaChallengeResponse>('/auth/login/choose-account', {
    method: 'POST',
    body:   { identifier, password, userId, rememberMe, deviceId: getOrCreateDeviceId() },
    public: true,
  });
  if ('requiresTwoFa' in data) return data;
  tokenStorage.set(data.accessToken);
  return data;
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

export function isAuthenticated(): boolean {
  return !!tokenStorage.get();
}

export const authService = {
  register,
  login,
  chooseAccount,
  verifyTwoFaLogin,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getMe,
  isAuthenticated,
};