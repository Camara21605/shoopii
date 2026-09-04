// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'company'
  | 'delivery'
  | 'partner'
  | 'correspondent'
  | 'client';

// Alias historique de UserRole, encore utilisé dans certains fichiers
// (useLoginPage, LoginForm, ...).
export type Role = UserRole;

export interface PublicUser {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  username:  string;
  role:      UserRole;
  status:    'active' | 'pending' | 'suspended' | 'banned';
}

export interface AuthResponse {
  accessToken: string;
  user:        PublicUser;
  /** true si cette connexion a fermé une session déjà active sur un
   *  autre appareil — affiche une notification informative. */
  sessionReplaced?: boolean;
  /** true si PlatformSettings.adminTwoFaRequired est activé, que ce
   *  compte est ADMIN/SUPER_ADMIN et que sa 2FA n'est pas encore
   *  configurée — affiche TwoFaSetupModal en mode non-fermable avant
   *  de laisser l'accès normal au dashboard. */
  twoFaSetupRequired?: boolean;
}

/** Réponse de /auth/login quand le compte a la 2FA activée — aucun
 *  cookie n'est posé, il faut échanger challengeToken + code via
 *  /auth/2fa/verify-login pour obtenir l'AuthResponse complet. */
export interface TwoFaChallengeResponse {
  requiresTwoFa:  true;
  challengeToken: string;
}

/** Réponse de /auth/login quand l'identifiant + mot de passe saisis
 *  correspondent à DEUX comptes liés (pro + client, même email/téléphone,
 *  mot de passe coïncidant sur les deux) — cas rare. Il faut rappeler
 *  /auth/login/choose-account avec le userId choisi par l'utilisateur. */
export interface AccountChoiceResponse {
  requiresAccountChoice: true;
  accounts: { userId: string; role: UserRole }[];
}

/** Réponse de /auth/login quand ce compte a déjà une session active sur
 *  un autre appareil et que le client n'a pas encore confirmé vouloir la
 *  fermer — aucun token émis. Il faut demander confirmation à l'utilisateur
 *  puis rappeler /auth/login avec confirmDisconnectOther:true. */
export interface SessionConfirmResponse {
  requiresSessionConfirm: true;
}

/** Réponse de /auth/register ou /auth/login quand PlatformSettings.
 *  emailVerifRequired est activé et que ce compte n'a pas encore confirmé
 *  son adresse email — aucun cookie posé. Il faut afficher l'écran de code
 *  puis appeler /auth/verify-email avec userId + code. */
export interface EmailVerificationRequiredResponse {
  requiresEmailVerification: true;
  email:  string;
  userId: string;
}

export type RegisterResult = AuthResponse | EmailVerificationRequiredResponse;
export type LoginResult = AuthResponse | TwoFaChallengeResponse | AccountChoiceResponse | SessionConfirmResponse | EmailVerificationRequiredResponse;

/** Métadonnées pays extraites du numéro de téléphone */
export interface PhoneCountryMeta {
  countryCode: string;   // "GN"
  countryName: string;   // "Guinée"
  dialCode:    string;   // "+224"
}

/** Résultat de géolocalisation au moment de l'inscription */
export interface RegistrationLocation {
  latitude?:         number;
  longitude?:        number;
  locationAccuracy?: number;
  address?:          string;
  city?:             string;
  district?:         string;
  region?:           string;
  country?:          string;
  postalCode?:       string;
  gpsEnabled?:       boolean;
}

export interface RegisterPayload {
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string;
  password:       string;
  role:           UserRole;
  activationCode?: string;
  companyName?:    string;
  companyTypeId?:  string;
  // Pays détecté via indicatif
  countryCode?:    string;
  countryName?:    string;
  dialCode?:       string;
  // Localisation GPS
  latitude?:       number;
  longitude?:      number;
  locationAccuracy?: number;
  address?:        string;
  city?:           string;
  district?:       string;
  region?:         string;
  country?:        string;
  postalCode?:     string;
  gpsEnabled?:     boolean;
  deviceId?:       string;
}

export interface LoginPayload {
  identifier:  string;
  password:    string;
  rememberMe?: boolean;
  /** true seulement au 2e appel, après confirmation explicite de
   *  l'utilisateur qu'il veut déconnecter son autre appareil (réponse
   *  à un 1er appel qui a renvoyé requiresSessionConfirm). */
  confirmDisconnectOther?: boolean;
}

export interface ForgotPasswordPayload {
  identifier: string;
}

export interface LoginFormData {
  email:      string;
  password:   string;
  rememberMe: boolean;
}

export interface RegisterFormData {
  firstName:       string;
  lastName:        string;
  email:           string;
  phone:           string;
  password:        string;
  confirmPassword: string;
  activationCode:  string;
  shopName?:       string;
  terms?:          boolean;
  companyTypeId?:  string;
  birthDate?:      string;
  gender?:         string;
  // Pays détecté via indicatif téléphonique
  countryCode?:    string;
  countryName?:    string;
  dialCode?:       string;
  // Localisation GPS / manuelle
  latitude?:       number | null;
  longitude?:      number | null;
  locationAccuracy?: number;
  address?:        string;
  city?:           string;
  district?:       string;
  region?:         string;
  country?:        string;
  postalCode?:     string;
  gpsEnabled?:     boolean;
}

export type CorrespondantType = 'company' | 'delivery';

export interface FormErrors {
  email?:           string;
  password?:        string;
  confirmPassword?: string;
  firstName?:       string;
  lastName?:        string;
  phone?:           string;
  activationCode?:  string;
  terms?:           string;
  general?:         string;
}

export interface RoleConfig {
  icon:             string;
  label:            string;
  sub:              string;
  info:             string;
  code:             boolean;
  shop:             boolean;
  codeType?:        'single' | 'choice';
  codeLength?:      number;
  codeLabel?:       string;
  codeNote?:        string;
  codePlaceholder?: string;
  codeIcon?:        string;
  codeFrom?:        string;
}