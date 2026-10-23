/**
 * Bascule compte professionnel ↔ compte client lié (« Mon espace » du site :
 * shared/services/accountLink.ts + hooks/useAccountSwitch.ts) — mêmes routes :
 *   GET  /auth/client-account/status → { linked, otherUserId?, otherRole?,
 *                                        existingClientFound?, matchedBy? }
 *   POST /auth/switch-account        → nouvelle session sur le compte lié, ou
 *                                      { requiresTwoFa, challengeToken } puis
 *                                      POST /auth/2fa/verify-login { challengeToken, code }
 *   POST /auth/create-linked-client  { password, firstName, lastName } → crée le compte client
 *                                      (même e-mail / téléphone / nom) et s'y connecte
 *   POST /auth/link-existing-client  { password } → lie un compte client déjà
 *                                      existant (preuve : son mot de passe) et s'y connecte
 * Deux comptes distincts, jamais fusionnés : le compte client a son propre
 * mot de passe, ses commandes, son portefeuille.
 */
import { z } from 'zod';

import { publicUserSchema, type PublicUser } from '@/features/auth/api';
import { apiFetch } from '@/lib/api/client';

/** Rôles professionnels pouvant posséder un compte client lié (PRO_ROLES du serveur). */
export const PRO_ROLES = ['company', 'delivery', 'correspondent', 'partner', 'admin'];

export const statusSchema = z.object({
  linked: z.boolean().catch(false),
  otherUserId: z.string().optional().catch(undefined),
  otherRole: z.string().optional().catch(undefined),
  existingClientFound: z.boolean().optional().catch(undefined),
  matchedBy: z.enum(['email', 'phone']).optional().catch(undefined),
});
export type LinkStatus = z.infer<typeof statusSchema>;

const sessionSchema = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1), user: publicUserSchema });
const switchSchema = z.union([sessionSchema, z.object({ requiresTwoFa: z.literal(true), challengeToken: z.string() })]);

export type SwitchOutcome =
  | { kind: 'session'; accessToken: string; refreshToken: string; user: PublicUser }
  | { kind: 'twoFa'; challengeToken: string };

const toOutcome = (d: z.infer<typeof switchSchema>): SwitchOutcome =>
  'accessToken' in d ? { kind: 'session', ...d } : { kind: 'twoFa', challengeToken: d.challengeToken };

export const fetchLinkStatus = () => apiFetch('/auth/client-account/status', { schema: statusSchema });

export const switchAccount = async () => toOutcome(await apiFetch('/auth/switch-account', { method: 'POST', schema: switchSchema }));

export const verifySwitchCode = async (challengeToken: string, code: string) =>
  toOutcome(await apiFetch('/auth/2fa/verify-login', { method: 'POST', auth: false, body: { challengeToken, code: code.trim() }, schema: sessionSchema }));

/** names : prénom et nom de la PERSONNE (obligatoires pour une entreprise). */
export const createLinkedClient = async (password: string, names: { firstName: string; lastName: string }) =>
  toOutcome(await apiFetch('/auth/create-linked-client', { method: 'POST', body: { password, ...names }, schema: switchSchema }));

export const linkExistingClient = async (password: string) =>
  toOutcome(await apiFetch('/auth/link-existing-client', { method: 'POST', body: { password }, schema: switchSchema }));

/** Libellé court d'un espace (« Espace client », « Espace entreprise »…). */
export const SPACE_LABEL: Record<string, string> = {
  client: 'Espace client',
  company: 'Espace entreprise',
  delivery: 'Espace livreur',
  correspondent: 'Espace point relais',
  partner: 'Espace partenaire',
  admin: 'Espace administrateur',
};

/** Icône représentant un espace (avatar du compte lié). */
export const SPACE_ICON: Record<string, string> = {
  client: 'bag-handle',
  company: 'storefront',
  delivery: 'bicycle',
  correspondent: 'location',
  partner: 'briefcase',
  admin: 'shield-checkmark',
};
