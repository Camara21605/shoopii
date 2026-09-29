import * as Crypto from 'expo-crypto';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';
import { STORAGE_KEYS, secureStorage } from '@/lib/storage/secure-storage';

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  role: z.string(),
  status: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

const authSuccessSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: publicUserSchema,
  sessionReplaced: z.boolean().optional(),
  twoFaSetupRequired: z.boolean().optional(),
});

/** Toutes les réponses possibles de POST /auth/login (voir auth.controller.ts). */
const loginResponseSchema = z.union([
  authSuccessSchema,
  z.object({ requiresTwoFa: z.literal(true), challengeToken: z.string() }),
  z.object({ requiresSessionConfirm: z.literal(true) }),
  z.object({
    requiresAccountChoice: z.literal(true),
    accounts: z.array(z.object({ userId: z.string(), role: z.string() })),
  }),
  z.object({ requiresEmailVerification: z.literal(true), email: z.string(), userId: z.string() }),
]);

export type AccountOption = { userId: string; role: string };

export type LoginOutcome =
  | { kind: 'success'; accessToken: string; refreshToken: string; user: PublicUser; sessionReplaced: boolean }
  | { kind: 'twoFa'; challengeToken: string }
  | { kind: 'sessionConfirm' }
  | { kind: 'accountChoice'; accounts: AccountOption[] }
  | { kind: 'emailVerification'; email: string; userId: string };

/** Libellé d'un rôle serveur pour l'écran « Choisissez votre compte ». */
export const ROLE_LABELS: Record<string, string> = {
  client: 'Compte client',
  company: 'Compte entreprise',
  delivery: 'Compte livreur',
  partner: 'Compte partenaire',
  correspondent: 'Compte correspondant',
  admin: 'Compte administrateur',
  super_admin: 'Compte super-administrateur',
};

function toOutcome(data: z.infer<typeof loginResponseSchema>): LoginOutcome {
  if ('accessToken' in data) {
    return {
      kind: 'success',
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      sessionReplaced: data.sessionReplaced ?? false,
    };
  }
  if ('requiresTwoFa' in data) return { kind: 'twoFa', challengeToken: data.challengeToken };
  if ('requiresSessionConfirm' in data) return { kind: 'sessionConfirm' };
  if ('requiresAccountChoice' in data) return { kind: 'accountChoice', accounts: data.accounts };
  return { kind: 'emailVerification', email: data.email, userId: data.userId };
}

/** Identifiant d'appareil stable (métadonnée de session unique côté serveur, pas une preuve d'identité). */
export async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.get(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureStorage.set(STORAGE_KEYS.deviceId, id);
  return id;
}

export async function login(input: {
  identifier: string;
  password: string;
  confirmDisconnectOther?: boolean;
}): Promise<LoginOutcome> {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    auth: false,
    schema: loginResponseSchema,
    body: {
      identifier: input.identifier.trim(),
      password: input.password,
      rememberMe: true,
      deviceId: await getDeviceId(),
      confirmDisconnectOther: input.confirmDisconnectOther,
    },
  });
  return toOutcome(data);
}

/** Même identifiant pour plusieurs comptes (ex. entreprise + client lié) : connexion au compte choisi. */
export async function chooseAccount(input: {
  identifier: string;
  password: string;
  userId: string;
  confirmDisconnectOther?: boolean;
}): Promise<LoginOutcome> {
  const data = await apiFetch('/auth/login/choose-account', {
    method: 'POST',
    auth: false,
    schema: loginResponseSchema,
    body: {
      identifier: input.identifier.trim(),
      password: input.password,
      userId: input.userId,
      rememberMe: true,
      deviceId: await getDeviceId(),
      confirmDisconnectOther: input.confirmDisconnectOther,
    },
  });
  return toOutcome(data);
}

/** Étape 2 de la connexion 2FA : code de l'application d'authentification (ou code de secours). */
export async function verifyTwoFa(challengeToken: string, code: string): Promise<LoginOutcome> {
  const data = await apiFetch('/auth/2fa/verify-login', {
    method: 'POST',
    auth: false,
    schema: authSuccessSchema,
    body: { challengeToken, code: code.trim() },
  });
  return toOutcome(data);
}

/* ── Inscription ───────────────────────────────────────────────────
 * Même contenu que shopi-frontend/src/modules/auth/services/authService.ts
 * (buildRegisterPayload) : champs communs + localisation GPS (client) ou
 * localisation choisie dans le référentiel géo (entreprise). */

export type Gender = 'male' | 'female' | 'other' | 'prefer_not';

export type RegisterPayload = {
  role: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  /** Numéro complet avec indicatif, ex. « +224620102644 » (comme le site). */
  phone: string;
  birthDate: string;
  gender: Gender;
  countryCode: string;
  countryName: string;
  dialCode: string;
  activationCode?: string;
  // Entreprise
  shopName?: string;
  companyName?: string;
  businessModel?: 'products' | 'services';
  companyTypeId?: string;
  categoryIds?: string[];
  companyPaysId?: string;
  companyVilleId?: string;
  // Localisation (GPS pour le client, référentiel pour l'entreprise)
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  address?: string;
  city?: string;
  district?: string;
  quartier?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  gpsEnabled?: boolean;
};

export async function register(payload: RegisterPayload): Promise<LoginOutcome> {
  /* Retire les champs vides (le site n'envoie que ce qui est rempli) */
  const body: Record<string, unknown> = { deviceId: await getDeviceId() };
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    body[k] = typeof v === 'string' && k !== 'password' ? v.trim() : v;
  }
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    auth: false,
    schema: z.union([
      authSuccessSchema,
      z.object({ requiresEmailVerification: z.literal(true), email: z.string(), userId: z.string() }),
    ]),
    body,
  });
  return toOutcome(data);
}

/** Logo de l'entreprise — envoyé APRÈS l'inscription, une fois connecté
 *  (comme le site : POST /dashboard/entreprise/parametres/logo, multipart). */
export async function uploadCompanyLogo(uri: string, mimeType = 'image/jpeg') {
  const form = new FormData();
  const ext = mimeType.split('/')[1] ?? 'jpg';
  form.append('file', { uri, name: `logo.${ext}`, type: mimeType } as unknown as Blob);
  return apiFetch('/dashboard/entreprise/parametres/logo', { method: 'POST', formData: form });
}

/** Code à 6 chiffres reçu par email après l'inscription → ouvre la session. */
export async function verifyEmail(userId: string, code: string): Promise<LoginOutcome> {
  const data = await apiFetch('/auth/verify-email', {
    method: 'POST',
    auth: false,
    schema: authSuccessSchema,
    body: { userId, code: code.trim() },
  });
  return toOutcome(data);
}

export function resendEmailCode(userId: string) {
  return apiFetch<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    auth: false,
    body: { userId },
  });
}

/** Politique d'inscription : client ouvert ? entreprise sans code ? (Paramètres plateforme) */
export function fetchRegistrationPolicy() {
  return apiFetch('/public/registration-policy', {
    auth: false,
    schema: z
      .object({ openSignup: z.boolean(), codeRequiredForCompany: z.boolean().optional().default(true) })
      .passthrough(),
  });
}

const geoItemSchema = z.object({ id: z.string(), nom: z.string() }).passthrough();
export type GeoItem = z.infer<typeof geoItemSchema>;

/** Villes (préfectures) d'un pays, par indicatif téléphonique (ex. « +224 »). */
export function fetchVilles(indicatif = '+224') {
  return apiFetch('/geo/villes', { auth: false, query: { indicatif }, schema: z.array(geoItemSchema) });
}

/** Référentiel géo par niveau (pays → région → préfecture → commune → quartier). */
export function fetchGeoItems(niveau: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier', parentId?: string) {
  return apiFetch('/geo/items', { auth: false, query: { niveau, parentId }, schema: z.array(geoItemSchema) });
}

const typeOptionSchema = z
  .object({ id: z.string(), nom: z.string(), icone: z.string().nullable().optional(), actif: z.boolean().optional() })
  .passthrough();

/** Types d'entreprise pour « Produits » ou « Services » (+ types neutres), comme le site. */
export async function fetchCompanyTypesByNature(nature: 'products' | 'services') {
  const list = await apiFetch('/company-types', { auth: false, query: { nature }, schema: z.array(typeOptionSchema) });
  return list.filter((t) => t.actif !== false);
}

/** Catégories d'un type d'entreprise (étape « Vos catégories »). */
export async function fetchTypeCategories(typeId: string) {
  const list = await apiFetch(`/company-types/${typeId}/categories`, {
    auth: false,
    query: { tri: 'ordre' },
    schema: z.array(typeOptionSchema),
  });
  return list.filter((c) => c.actif !== false);
}

/* ── Mot de passe oublié (3 étapes) ────────────────────────────────
 * 1. POST /auth/forgot-password : code à 6 chiffres par email (10 min).
 *    Réponse identique que le compte existe ou non (anti-énumération).
 * 2. POST /auth/verify-otp : code → resetToken (15 min) ; si l'identifiant
 *    ouvre plusieurs comptes → requiresAccountChoice, puis même appel
 *    avec accountUserId.
 * 3. POST /auth/reset-password : nouveau mot de passe ; toutes les sessions
 *    ouvertes sont fermées par le serveur. */

export function requestPasswordReset(identifier: string) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    schema: z.object({ message: z.string() }),
    body: { identifier: identifier.trim() },
  });
}

export type OtpOutcome =
  | { kind: 'resetToken'; resetToken: string }
  | { kind: 'accountChoice'; accounts: AccountOption[] };

export async function verifyResetCode(identifier: string, code: string, accountUserId?: string): Promise<OtpOutcome> {
  const data = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    auth: false,
    schema: z.union([
      z.object({ resetToken: z.string().min(1) }),
      z.object({
        requiresAccountChoice: z.literal(true),
        accounts: z.array(z.object({ userId: z.string(), role: z.string() })),
      }),
    ]),
    body: { identifier: identifier.trim(), code: code.trim(), accountUserId },
  });
  return 'resetToken' in data
    ? { kind: 'resetToken', resetToken: data.resetToken }
    : { kind: 'accountChoice', accounts: data.accounts };
}

export function resetPassword(resetToken: string, newPassword: string) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    auth: false,
    schema: z.object({ message: z.string() }),
    body: { resetToken, newPassword },
  });
}

export function fetchMe() {
  return apiFetch('/auth/me', { schema: publicUserSchema });
}

export function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}
