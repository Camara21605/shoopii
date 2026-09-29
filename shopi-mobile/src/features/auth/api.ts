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

/* ── Inscription (compte CLIENT) ───────────────────────────────────
 * Les comptes entreprise / livreur / partenaire demandent des étapes
 * propres au site (type d'activité, catégories, code d'activation,
 * localisation de la boutique…) : ils se créent sur shoneya.com. */

export type Gender = 'male' | 'female' | 'other' | 'prefer_not';

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  /** Chiffres locaux, sans indicatif (ex. « 620102644 »). */
  phone: string;
  password: string;
  /** AAAA-MM-JJ */
  birthDate: string;
  gender: Gender;
  /** Nom de la ville (préfecture) du référentiel géo. */
  city: string;
};

export async function register(input: RegisterInput): Promise<LoginOutcome> {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    auth: false,
    schema: z.union([
      authSuccessSchema,
      z.object({ requiresEmailVerification: z.literal(true), email: z.string(), userId: z.string() }),
    ]),
    body: {
      role: 'client',
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone ? `+224${input.phone}` : undefined,
      password: input.password,
      birthDate: input.birthDate,
      gender: input.gender,
      city: input.city,
      countryCode: 'GN',
      countryName: 'Guinée',
      dialCode: '+224',
      deviceId: await getDeviceId(),
    },
  });
  return toOutcome(data);
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

/** L'inscription client est-elle ouverte ? (Paramètres plateforme) */
export function fetchRegistrationPolicy() {
  return apiFetch('/public/registration-policy', {
    auth: false,
    schema: z.object({ openSignup: z.boolean() }).passthrough(),
  });
}

/** Villes (préfectures) de Guinée — référentiel géo géré par les administrateurs. */
export function fetchVilles() {
  return apiFetch('/geo/villes', {
    auth: false,
    query: { indicatif: '+224' },
    schema: z.array(z.object({ id: z.string(), nom: z.string() }).passthrough()),
  });
}

export function fetchMe() {
  return apiFetch('/auth/me', { schema: publicUserSchema });
}

export function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}
