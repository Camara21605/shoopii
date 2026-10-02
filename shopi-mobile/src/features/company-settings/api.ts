/**
 * Paramètres de la boutique (espace entreprise) — mêmes routes que le site
 * (dashboards/entreprise/hooks/useParametres.ts) :
 *
 *   GET    /dashboard/entreprise/parametres              toutes les sections
 *   PATCH  …/boutique · contact · catalogue · livraison · paiement · commissions
 *   PATCH  …/horaires            { horaires: [{ jour, ouverture, fermeture, actif }] }
 *   POST   …/logo · cover        multipart « file »     DELETE …/logo
 *   POST   …/documents/:type     multipart « file »     (cni, rccm, bancaire, photo, nif)
 *   PATCH  …/securite/password   PATCH …/securite/2fa (désactivation)
 *   GET/PATCH …/notifications · PATCH …/confidentialite
 *   PATCH  …/danger/pause · …/danger/desactiver   DELETE …/danger/supprimer
 *
 * Les réponses PATCH ne contiennent que la section modifiée : elles sont
 * fusionnées dans le cache (qk.company.settings), comme setData du site.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export const BASE = '/dashboard/entreprise/parametres';

const str = z.string().nullable().optional().catch(null);
const bool = (d: boolean) => z.boolean().catch(d);
const num = z.coerce.number().catch(0);

export const horaireSchema = z.object({
  jour: z.string(),
  ouverture: z.string().nullable().catch(null),
  fermeture: z.string().nullable().catch(null),
  actif: z.boolean().catch(false),
});
export type Horaire = z.infer<typeof horaireSchema>;

export const settingsSchema = z
  .object({
    id: z.string(),
    companyName: z.string().catch(''),
    description: str,
    logo: str,
    coverImage: str,
    status: z.string().catch('active'),
    slogan: str,
    tags: str,
    website: str,
    companyTypeId: str,
    businessModel: z.string().catch('products'),
    ownerFirstName: str,
    ownerLastName: str,
    ownerStatus: z.string().nullable().optional().catch(null),
    productCount: num,
    quartier: str,
    suspendedUntil: str,
    businessPhone: str,
    businessEmail: str,
    whatsapp: str,
    adresse: str,
    commune: str,
    ville: str,
    repere: str,
    latitude: z.number().nullable().optional().catch(null),
    longitude: z.number().nullable().optional().catch(null),
    horaires: z.array(horaireSchema).optional().catch([]),
    showOutOfStock: bool(true),
    autoPublish: bool(false),
    showStrikePrice: bool(true),
    allowReviews: bool(true),
    devise: z.string().nullable().optional().catch('GNF'),
    returnPolicy: str,
    livraisonStandard: bool(true),
    livraisonShopi: bool(false),
    livraisonCorresp: bool(false),
    clickCollect: bool(true),
    zonesLivraison: z.array(z.string()).nullable().optional().catch([]),
    nif: str,
    rccm: str,
    raisonSociale: str,
    plan: z.string().catch('standard'),
    ownerIdDocument: str,
    documentRccm: str,
    documentBancaire: str,
    documentPhoto: str,
    documentNif: str,
    verificationStatus: z.string().catch('pending'),
    twoFaEnabled: bool(false),
    twoFaMethod: str,
    currentSession: z
      .object({ device: z.string().catch(''), browser: z.string().catch(''), ipAddress: str, connectedSince: z.string().catch('') })
      .nullable()
      .optional()
      .catch(null),
    privacySettings: z.record(z.string(), z.unknown()).nullable().optional().catch(null),
  })
  .passthrough();
export type Settings = z.infer<typeof settingsSchema>;

export const fetchSettings = () => apiFetch(`${BASE}`, { schema: settingsSchema });

/** PATCH d'une section — renvoie la portion mise à jour (fusionnée ensuite dans le cache). */
export const patchSection = (path: string, body: unknown, method: 'PATCH' | 'PUT' | 'POST' = 'PATCH') =>
  apiFetch<Record<string, unknown>>(`${BASE}/${path}`, { method, body });

/* ── Images et documents (multipart « file ») ───────────────────────── */

export type LocalFile = { uri: string; name: string; mimeType: string };

export async function uploadFile(path: string, file: LocalFile) {
  const formData = new FormData();
  // RN FormData : objet {uri, name, type} — pris en charge nativement par fetch.
  formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return apiFetch<Record<string, unknown>>(`${BASE}/${path}`, { method: 'POST', formData });
}

export const deleteLogo = () => apiFetch(`${BASE}/logo`, { method: 'DELETE' });

/* ── Catégories proposées par la boutique ───────────────────────────── */

export const categoriesSchema = z
  .object({
    usingFallback: z.boolean().catch(false),
    selectedIds: z.array(z.string()).catch([]),
    available: z
      .array(z.object({ id: z.string(), nom: z.string().catch(''), icone: str, couleur: str }).passthrough())
      .catch([]),
  })
  .passthrough();
export const fetchMyCategories = () => apiFetch(`${BASE}/boutique/categories`, { schema: categoriesSchema });
export const saveMyCategories = (categoryIds: string[]) =>
  apiFetch(`${BASE}/boutique/categories`, { method: 'PUT', body: { categoryIds }, schema: categoriesSchema });

/* ── Livraison : communes de la zone attribuée ──────────────────────── */

export const fetchZonesDispo = () =>
  apiFetch(`${BASE}/livraison/zones-disponibles`, {
    schema: z
      .object({ zoneId: str, zoneNom: str, communes: z.array(z.object({ id: z.string(), nom: z.string() })).catch([]) })
      .catch({ zoneId: null, zoneNom: null, communes: [] }),
  });

/* ── Portefeuille (section Paiement) ────────────────────────────────── */

export const walletSummarySchema = z
  .object({
    withdrawableBalance: num,
    settlementLocked: num,
    dailyWithdrawLimit: num,
    todayWithdrawAmount: num,
    paymentMethods: z
      .array(z.object({ id: z.string(), type: z.string().catch(''), label: z.string().catch(''), number: z.string().catch(''), isDefault: z.boolean().catch(false) }))
      .catch([]),
  })
  .passthrough();
export type WalletSummary = z.infer<typeof walletSummarySchema>;
export const fetchWalletSummary = () => apiFetch('/wallet', { schema: walletSummarySchema });

/* ── Commissions ────────────────────────────────────────────────────── */

const grilleEntry = z.object({ taux: num, label: z.string().catch('') });
export const commissionsSchema = z
  .object({
    planActuel: z.string().catch('standard'),
    tauxActuel: grilleEntry.catch({ taux: 0, label: '' }),
    grille: z.record(z.string(), grilleEntry).catch({}),
    plans: z.array(z.string()).catch(['standard', 'pro', 'premium']),
    settlementDelayDays: z.coerce.number().optional().catch(undefined),
  })
  .passthrough();
export type Commissions = z.infer<typeof commissionsSchema>;
export const fetchCommissions = () => apiFetch(`${BASE}/commissions`, { schema: commissionsSchema });

/* ── Notifications (vraies préférences : canaux + familles) ─────────── */

export const notifsSchema = z.object({
  global: z.object({ push: z.boolean().catch(true), email: z.boolean().catch(true) }),
  items: z.record(z.string(), z.boolean()).catch({}),
});
export type NotifsView = z.infer<typeof notifsSchema>;
export const fetchNotifs = () => apiFetch(`${BASE}/notifications`, { schema: notifsSchema });
export const patchNotifs = (body: { global?: Partial<NotifsView['global']>; items?: Record<string, boolean> }) =>
  apiFetch(`${BASE}/notifications`, { method: 'PATCH', body, schema: notifsSchema });

/* ── Sécurité ───────────────────────────────────────────────────────── */

export const changePassword = (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
  apiFetch(`${BASE}/securite/password`, { method: 'PATCH', body });

export const disableTwoFa = (currentPassword: string, code: string) =>
  apiFetch(`${BASE}/securite/2fa`, { method: 'PATCH', body: { twoFaEnabled: false, currentPassword, code } });

/** Activation : secret TOTP généré par le serveur, confirmé par un code à 6 chiffres. */
export const startTwoFaSetup = () =>
  apiFetch('/auth/2fa/setup', { method: 'POST', schema: z.object({ secret: z.string(), otpauthUri: z.string() }).passthrough() });
export const confirmTwoFa = (code: string) => apiFetch('/auth/2fa/confirm', { method: 'POST', body: { code } });

/* ── Zone sensible (mot de passe requis) ────────────────────────────── */

export const pauseShop = (password: string) => apiFetch(`${BASE}/danger/pause`, { method: 'PATCH', body: { password } });
export const disableShop = (password: string) =>
  apiFetch(`${BASE}/danger/desactiver`, { method: 'PATCH', body: { password }, schema: z.object({ reactivationAt: z.string().nullable().optional() }).passthrough() });
export const deleteShop = (password: string) => apiFetch(`${BASE}/danger/supprimer`, { method: 'DELETE', body: { password } });

/* ── Règles partagées par les écrans ────────────────────────────────── */

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/** Les 6 étapes de complétion de la boutique (même calcul que le site). */
export function completion(s: Settings) {
  const steps = [
    { key: 'logo', label: 'Logo', ok: !!s.logo },
    { key: 'companyName', label: 'Nom & description', ok: !!s.companyName },
    { key: 'contact', label: 'Contact', ok: !!(s.businessPhone || s.businessEmail) },
    { key: 'products', label: 'Produits', ok: s.productCount > 0 },
    { key: 'coverImage', label: 'Photo de couverture', ok: !!s.coverImage },
    { key: 'returnPolicy', label: 'Politique retour', ok: !!s.returnPolicy },
  ];
  const done = steps.filter((x) => x.ok).length;
  return { steps, pct: Math.round((done / steps.length) * 100), missing: steps.filter((x) => !x.ok).map((x) => x.label) };
}

/** Statut public de la boutique, comme l'en-tête du menu Paramètres du site. */
export function statusOf(status: string | null | undefined) {
  if (status === 'active') return { label: 'Active', emoji: '🟢', tone: 'success' as const };
  if (status === 'suspended') return { label: 'En pause', emoji: '🟡', tone: 'warning' as const };
  if (status === 'pending') return { label: 'En validation', emoji: '🟡', tone: 'warning' as const };
  return { label: 'Privée', emoji: '🔴', tone: 'danger' as const };
}
