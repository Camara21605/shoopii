// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/services/authService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';
import type {
  AuthResponse,
  PublicUser,
  RegisterPayload,
  LoginPayload,
  ForgotPasswordPayload,
  RegisterFormData,
  Role,
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

  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body:   payload,
    public: true,
  });

  tokenStorage.set(data.accessToken);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body:   payload,
    public: true,
  });
  tokenStorage.set(data.accessToken);
  return data;
}

export function logout(): void {
  tokenStorage.remove();
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
  logout,
  forgotPassword,
  getMe,
  isAuthenticated,
};