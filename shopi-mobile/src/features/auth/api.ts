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
  z.object({ requiresAccountChoice: z.literal(true) }),
  z.object({ requiresEmailVerification: z.literal(true), email: z.string(), userId: z.string() }),
]);

export type LoginOutcome =
  | { kind: 'success'; accessToken: string; refreshToken: string; user: PublicUser; sessionReplaced: boolean }
  | { kind: 'twoFa'; challengeToken: string }
  | { kind: 'sessionConfirm' }
  | { kind: 'accountChoice' }
  | { kind: 'emailVerification'; email: string; userId: string };

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
  if ('requiresAccountChoice' in data) return { kind: 'accountChoice' };
  return { kind: 'emailVerification', email: data.email, userId: data.userId };
}

export function fetchMe() {
  return apiFetch('/auth/me', { schema: publicUserSchema });
}

export function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}
