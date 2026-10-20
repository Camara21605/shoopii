/**
 * Paramètres du compte client — mêmes routes que la page « Paramètres » du
 * site (shopi-frontend/src/modules/home/components/settings/api/settings.api.ts),
 * contrôleur ClientParametresController côté serveur :
 *   profil · coordonnées (+ vérification e-mail) · points · sécurité
 *   (mot de passe, alertes) · sessions · activité · notifications ·
 *   confidentialité · mes données (export, rapport) · zone de danger.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const BASE = '/client/parametres';

/* ── Profil ─────────────────────────────────────────────────────── */

export const profilSchema = z
  .object({
    id: z.string(),
    firstName: z.string().nullable().transform((v) => v ?? ''),
    lastName: z.string().nullable().transform((v) => v ?? ''),
    email: z.string().nullable().transform((v) => v ?? ''),
    phone: z.string().nullable().optional().transform((v) => v ?? ''),
    username: z.string().nullable().optional().transform((v) => v ?? ''),
    emailVerified: z.boolean().optional().default(false),
    phoneVerified: z.boolean().optional().default(false),
    profilePicture: z.string().nullable().optional().transform((v) => v || null),
    dateNaissance: z.string().nullable().optional().transform((v) => v ?? ''),
    genre: z.string().nullable().optional().transform((v) => v ?? ''),
    bio: z.string().nullable().optional().transform((v) => v ?? ''),
  })
  .passthrough();
export type Profil = z.infer<typeof profilSchema>;

export type ProfilForm = {
  firstName: string;
  lastName: string;
  username: string;
  dateNaissance: string;
  genre: string;
  bio: string;
};

export const fetchProfil = () => apiFetch(`${BASE}/profil`, { schema: profilSchema });
export const updateProfil = (dto: ProfilForm) =>
  apiFetch(`${BASE}/profil`, { method: 'PATCH', body: dto, schema: profilSchema });

/** Envoie l'image (même route que le site) puis enregistre son adresse sur le profil. */
export async function uploadAvatar(uri: string, mimeType: string, fileName: string) {
  const form = new FormData();
  // React Native accepte { uri, name, type } comme fichier ; le web attend un Blob.
  if (typeof document !== 'undefined') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, fileName);
  } else {
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
  }
  const { url } = await apiFetch('/upload/avatar', {
    method: 'POST',
    formData: form,
    schema: z.object({ url: z.string().min(1) }).passthrough(),
  });
  await apiFetch(`${BASE}/profil/avatar`, { method: 'PATCH', body: { url } });
  return url;
}
export const removeAvatar = () => apiFetch(`${BASE}/profil/avatar`, { method: 'PATCH', body: { url: '' } });

const coordonneesSchema = z
  .object({ message: z.string().optional().default(''), emailCodeSent: z.boolean().optional().default(false) })
  .passthrough();
export const updateCoordonnees = (dto: { email?: string; phone?: string; currentPassword: string }) =>
  apiFetch(`${BASE}/coordonnees`, { method: 'PATCH', body: dto, schema: coordonneesSchema });
export const sendEmailCode = () =>
  apiFetch(`${BASE}/coordonnees/email/code`, {
    method: 'POST',
    schema: z.object({ sent: z.boolean().optional().default(true), message: z.string().optional().default('') }).passthrough(),
  });
export const confirmEmailCode = (code: string) =>
  apiFetch(`${BASE}/coordonnees/email/verifier`, { method: 'POST', body: { code } });

/* ── Points ─────────────────────────────────────────────────────── */

export const pointsSchema = z
  .object({
    points: z.coerce.number().default(0),
    pointsGagnes: z.coerce.number().default(0),
    pointsUtilises: z.coerce.number().default(0),
    niveau: z.string().default(''),
    prochainNiveau: z.string().nullable().optional(),
    seuilProchain: z.coerce.number().nullable().optional(),
    progression: z.coerce.number().default(0),
    expirationProchaine: z.string().nullable().optional(),
    actif: z.boolean().optional().default(false),
  })
  .passthrough();
export type Points = z.infer<typeof pointsSchema>;
export const fetchPoints = () => apiFetch(`${BASE}/points`, { schema: pointsSchema });

/* ── Sécurité ───────────────────────────────────────────────────── */

export const securiteSchema = z
  .object({
    emailVerified: z.boolean().optional().default(false),
    phoneVerified: z.boolean().optional().default(false),
    twoFaEnabled: z.boolean().optional().default(false),
    codesSecours: z.coerce.number().optional().default(0),
    dernierChangementMdp: z.string().nullable().optional(),
  })
  .passthrough();
export type Securite = z.infer<typeof securiteSchema>;
export const fetchSecurite = () => apiFetch(`${BASE}/securite`, { schema: securiteSchema });
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch(`${BASE}/securite/password`, { method: 'PATCH', body: { currentPassword, newPassword } });

export const ALERT_TYPES = ['connex', 'mdp', 'tentatives', 'transaction', 'pays'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
const alertsSchema = z.record(z.string(), z.object({ email: z.boolean() }).passthrough());
export type AlertSettings = z.infer<typeof alertsSchema>;
export const fetchAlerts = () => apiFetch(`${BASE}/securite/alertes`, { schema: alertsSchema });
export const updateAlert = (type: AlertType, email: boolean) =>
  apiFetch(`${BASE}/securite/alertes`, { method: 'PATCH', body: { type, email }, schema: alertsSchema });

/* ── Sessions & activité ────────────────────────────────────────── */

export const sessionSchema = z
  .object({
    id: z.string(),
    device: z.string().optional().default(''),
    browser: z.string().optional().default(''),
    os: z.string().optional().default(''),
    ip: z.string().optional().default(''),
    location: z.string().optional().default(''),
    lastSeen: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    isCurrent: z.boolean().optional().default(false),
    suspect: z.boolean().optional().default(false),
  })
  .passthrough();
export type Session = z.infer<typeof sessionSchema>;
export const fetchSessions = () => apiFetch(`${BASE}/sessions`, { schema: z.array(sessionSchema) });
export const revokeSession = (id: string) => apiFetch(`${BASE}/sessions/${id}/revoquer`, { method: 'PATCH' });
export const revokeOtherSessions = () => apiFetch(`${BASE}/sessions/revoquer-toutes`, { method: 'PATCH' });

export const activiteSchema = z
  .object({
    code: z.string().optional().default(''),
    type: z.string().optional().default('profile'),
    title: z.string().optional().default(''),
    device: z.string().optional().default(''),
    location: z.string().optional().default(''),
    ip: z.string().optional().default(''),
    time: z.string(),
    success: z.boolean().optional().default(true),
  })
  .passthrough();
export type Activite = z.infer<typeof activiteSchema>;
export const fetchActivite = () =>
  apiFetch(`${BASE}/activite`, { query: { limit: 50 }, schema: z.array(activiteSchema) });

/* ── Notifications (préférences RÉELLES) ────────────────────────── */

const channelSchema = z.object({ push: z.boolean(), email: z.boolean() }).passthrough();
export const notifsSchema = z
  .object({
    global: channelSchema,
    dnd: z
      .object({ enabled: z.boolean(), start: z.string(), end: z.string(), timezone: z.string() })
      .passthrough(),
    groups: z.record(z.string(), channelSchema),
  })
  .passthrough();
export type Notifs = z.infer<typeof notifsSchema>;
export const fetchNotifs = () => apiFetch(`${BASE}/notifs`, { schema: notifsSchema });
/** Mise à jour partielle (UpdateNotifsDto) : seuls les champs envoyés changent. */
export type NotifsPatch = {
  global?: { push?: boolean; email?: boolean };
  dnd?: { enabled?: boolean; start?: string; end?: string; timezone?: string };
  groups?: Record<string, { push?: boolean; email?: boolean }>;
};
export const updateNotifs = (dto: NotifsPatch) =>
  apiFetch(`${BASE}/notifs`, { method: 'PATCH', body: dto, schema: notifsSchema });

/* ── Confidentialité ────────────────────────────────────────────── */

export const PRIVACY_DEFAULTS = { visibilite: 'public', historique: false, wishlist: true, perso: true, localisation: true };
export type Privacy = typeof PRIVACY_DEFAULTS;
const privacyResponse = z.object({ privacySettings: z.unknown().optional() }).passthrough();

function toPrivacy(raw: unknown): Privacy {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = {}; }
  }
  return { ...PRIVACY_DEFAULTS, ...((value && typeof value === 'object' ? value : {}) as Partial<Privacy>) };
}
export const fetchPrivacy = async () => toPrivacy((await apiFetch(`${BASE}/privacy`, { schema: privacyResponse })).privacySettings);
/** Le serveur attend l'objet complet sérialisé en texte (UpdatePrivacyDto.privacySettings: string). */
export const updatePrivacy = async (p: Privacy) =>
  toPrivacy(
    (await apiFetch(`${BASE}/privacy`, { method: 'PATCH', body: { privacySettings: JSON.stringify(p) }, schema: privacyResponse }))
      .privacySettings,
  );

/* ── Zone de danger ─────────────────────────────────────────────── */

export const deactivateAccount = (password: string) =>
  apiFetch(`${BASE}/danger/desactiver`, { method: 'PATCH', body: { password } });
export const resetPreferences = () => apiFetch(`${BASE}/danger/reinitialiser`, { method: 'PATCH' });
export const deleteAccount = (password: string) =>
  apiFetch(`${BASE}/danger/supprimer`, { method: 'DELETE', body: { password } });

/* ── Mes données (RGPD) ─────────────────────────────────────────── */

export type ExportScope = 'all' | 'commandes' | 'factures';

/** Données du compte en JSON (jamais : mot de passe, secrets 2FA, jetons). 5 exports par heure. */
export const exportDonnees = (type: ExportScope) =>
  apiFetch<unknown>(`${BASE}/donnees/export`, { query: { type }, timeoutMs: 60_000 });

const rapportSchema = z
  .object({
    donneesCollectees: z.array(z.string()).catch([]),
    partageeAvec: z.array(z.string()).catch([]),
    conservationDuree: z.string().catch(''),
    droits: z.array(z.string()).catch([]),
    contact: z.string().catch(''),
  })
  .passthrough();
export type RapportDonnees = z.infer<typeof rapportSchema>;
export const fetchRapportDonnees = () => apiFetch(`${BASE}/donnees/rapport`, { schema: rapportSchema });
