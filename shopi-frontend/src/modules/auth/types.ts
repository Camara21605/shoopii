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
}

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
}

export interface LoginPayload {
  identifier:  string;
  password:    string;
  rememberMe?: boolean;
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