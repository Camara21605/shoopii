/**
 * Paramètres du livreur — mêmes routes que le site
 * (dashboards/livreur/hooks/useLivreurParametres.ts + pages/params/Sec*.tsx) :
 *
 *   GET    /dashboard/livreur/parametres              toutes les données (+ session actuelle)
 *   PATCH  …/profil · …/zone · …/vehicule             réponse = fiche livreur (fusionnée)
 *   PATCH  …/horaires  { horaires: [{ jour, actif, ouverture, fermeture }] }  réponse = jours
 *   POST   …/photo · …/documents/:type   multipart « file »
 *   PATCH  …/securite/password · …/securite/2fa (désactivation : mot de passe + code)
 *   GET/PATCH …/notifications   préférences RÉELLES (canaux + familles)
 *   GET/PATCH …/confidentialite showInSearch · showRating · showDeliveryCount · shareLocation
 *   GET    …/danger   PATCH …/danger/pause · desactiver · reprendre   DELETE …/danger/supprimer
 *
 * Le serveur refuse tout champ inconnu (forbidNonWhitelisted) : chaque appel
 * n'envoie que les champs de son DTO.
 */
import { z } from 'zod';

import { appendFile, type LocalFile } from '@/features/settings-kit/upload';
import { apiFetch } from '@/lib/api/client';

export const BASE = '/dashboard/livreur/parametres';

const str = z.string().nullable().optional().catch(null);
const num = z.coerce.number().catch(0);
const strList = z.array(z.string()).nullable().optional().catch(null);

export const horaireSchema = z.object({
  jour: z.string(),
  ouverture: z.string().nullable().catch(null),
  fermeture: z.string().nullable().catch(null),
  actif: z.boolean().catch(false),
});
export type Horaire = z.infer<typeof horaireSchema>;

const sessionSchema = z
  .object({
    device: z.string().catch(''),
    browser: z.string().catch(''),
    ipAddress: z.string().nullable().catch(null),
    connectedSince: z.string().nullable().catch(null),
  })
  .nullable()
  .optional()
  .catch(null);

export const settingsSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch(''),
    firstName: str,
    lastName: str,
    phone: str,
    email: str,
    photoUrl: str,
    bio: str,
    langues: str,
    ville: str,
    commune: str,
    quartier: str,
    deliveryEmoji: z.string().catch('🛵'),
    verificationStatus: z.string().catch('pending'),
    /* Pièces : le serveur ne renvoie qu'un marqueur « •••••• » (présence), jamais le fichier. */
    documentCni: str,
    documentPermis: str,
    documentAssurance: str,
    documentCasier: str,
    deliveryType: str,
    deliveryTypeSetAt: str,
    communesActives: strList,
    /* null = jamais choisi → toutes les zones actives sont disponibles (règle du site) */
    zonesDisponibles: strList,
    horaires: z.array(horaireSchema).catch([]),
    VehicleType: z.string().catch('moto'),
    vehiculeMarque: str,
    vehiculeModele: str,
    vehiculeAnnee: z.coerce.number().nullable().optional().catch(null),
    vehiculeCouleur: str,
    vehiculePlaque: str,
    twoFaEnabled: z.boolean().catch(false),
    currentSession: sessionSchema,
    totalDeliveries: num,
    averageRating: num,
  })
  .passthrough();
export type LivreurSettings = z.infer<typeof settingsSchema>;

export const fetchSettings = () => apiFetch(BASE, { schema: settingsSchema });

/** PATCH d'une section ; la réponse est fusionnée dans le cache par le hook. */
export const patchSection = (path: string, body: unknown) =>
  apiFetch<Record<string, unknown> | unknown[]>(`${BASE}/${path}`, {
    method: 'PATCH',
    body,
  });

/* ── Fichiers (multipart « file ») ─────────────────────────────────── */

export type { LocalFile } from '@/features/settings-kit/upload';

export async function uploadFile(path: string, file: LocalFile) {
  const formData = new FormData();
  await appendFile(formData, 'file', file);
  return apiFetch<Record<string, unknown>>(`${BASE}/${path}`, {
    method: 'POST',
    formData,
  });
}

export const uploadPhoto = (file: LocalFile) => uploadFile('photo', file).then((r) => z.object({ photoUrl: z.string() }).parse(r));

export type DocKey = 'cni' | 'permis' | 'assurance' | 'casier';
export const uploadDocument = (type: DocKey, file: LocalFile) =>
  uploadFile(`documents/${type}`, file).then((r) =>
    z
      .object({
        present: z.boolean().catch(false),
        verificationStatus: z.string().optional(),
      })
      .parse(r),
  );

/* ── Sécurité ──────────────────────────────────────────────────────── */

export const changePassword = (body: { currentPassword: string; newPassword: string; confirmPassword: string }) => apiFetch(`${BASE}/securite/password`, { retryOn401: false, method: 'PATCH', body });
export const disableTwoFa = (currentPassword: string, code: string) => apiFetch(`${BASE}/securite/2fa`, { retryOn401: false, method: 'PATCH', body: { twoFaEnabled: false, currentPassword, code } });
/* Activation : routes communes à tous les comptes (comme TwoFaSetupModal du site). */
export const startTwoFaSetup = () =>
  apiFetch('/auth/2fa/setup', {
    method: 'POST',
    schema: z.object({ secret: z.string(), otpauthUri: z.string() }).passthrough(),
  });
export const confirmTwoFa = (code: string) => apiFetch('/auth/2fa/confirm', { method: 'POST', body: { code } });

/* ── Notifications (préférences réelles) ───────────────────────────── */

export const notifsSchema = z.object({
  global: z.object({
    push: z.boolean().catch(true),
    email: z.boolean().catch(true),
  }),
  items: z.record(z.string(), z.boolean()).catch({}),
});
export type NotifPrefs = z.infer<typeof notifsSchema>;
export const fetchNotifPrefs = () => apiFetch(`${BASE}/notifications`, { schema: notifsSchema });
export const patchNotifPrefs = (body: { global?: Partial<NotifPrefs['global']>; items?: Record<string, boolean> }) =>
  apiFetch(`${BASE}/notifications`, {
    method: 'PATCH',
    body,
    schema: notifsSchema,
  });

/* ── Confidentialité ───────────────────────────────────────────────── */

export const PRIVACY_KEYS = ['showInSearch', 'showRating', 'showDeliveryCount', 'shareLocation'] as const;
export type PrivacyKey = (typeof PRIVACY_KEYS)[number];
export const privacySchema = z.object({
  showInSearch: z.boolean().catch(true),
  showRating: z.boolean().catch(true),
  showDeliveryCount: z.boolean().catch(true),
  shareLocation: z.boolean().catch(true),
});
export type Privacy = z.infer<typeof privacySchema>;
export const fetchPrivacy = () => apiFetch(`${BASE}/confidentialite`, { schema: privacySchema });
export const patchPrivacy = (key: PrivacyKey, value: boolean) =>
  apiFetch(`${BASE}/confidentialite`, {
    method: 'PATCH',
    body: { [key]: value },
    schema: privacySchema,
  });

/* ── Zone sensible ─────────────────────────────────────────────────── */

export type AccountState = 'actif' | 'pause' | 'desactive' | 'suspendu' | 'banni';
const dangerSchema = z.object({
  etat: z.enum(['actif', 'pause', 'desactive', 'suspendu', 'banni']).catch('actif'),
  jusquau: z.string().nullable().catch(null),
});
export type DangerState = z.infer<typeof dangerSchema>;
export const fetchDanger = () => apiFetch(`${BASE}/danger`, { schema: dangerSchema });
export const pauseAccount = (password: string) => apiFetch(`${BASE}/danger/pause`, { retryOn401: false, method: 'PATCH', body: { password }, schema: dangerSchema });
export const deactivateAccount = (password: string) => apiFetch(`${BASE}/danger/desactiver`, { retryOn401: false, method: 'PATCH', body: { password }, schema: dangerSchema });
export const resumeAccount = () =>
  apiFetch(`${BASE}/danger/reprendre`, {
    method: 'PATCH',
    schema: dangerSchema,
  });
export const deleteAccount = (password: string) => apiFetch(`${BASE}/danger/supprimer`, { retryOn401: false, method: 'DELETE', body: { password } });

/* ── Référentiel géographique (zones actives) ──────────────────────── */

const geoItemSchema = z.object({
  id: z.string(),
  nom: z.string().catch(''),
  code: z.string().nullable().catch(null),
});
export type GeoItem = z.infer<typeof geoItemSchema>;
export const fetchGeoLevel = (niveau: string) =>
  apiFetch('/geo/items', {
    query: { niveau },
    schema: z.array(geoItemSchema).catch([]),
  });

/* ── Données d'affichage (mêmes listes que le site) ────────────────── */

/** Emojis acceptés par le serveur (LIVREUR_EMOJIS de profil-livreur.service.ts). */
export const EMOJIS = ['🛵', '🚴', '🚗', '🛺', '🏍️', '📦', '⚡', '🌟'];

export const DELIVERY_TYPES = [
  {
    key: 'entre_pays',
    em: '🌍',
    label: 'Entre pays',
    sub: 'Livraisons internationales',
    niveau: 'pays',
  },
  {
    key: 'entre_regions',
    em: '🗺️',
    label: 'Entre régions',
    sub: 'D’une région à l’autre',
    niveau: 'region',
  },
  {
    key: 'entre_prefectures',
    em: '🏛️',
    label: 'Entre préfectures',
    sub: 'Entre zones administratives',
    niveau: 'prefecture',
  },
  {
    key: 'entre_villes',
    em: '🏙️',
    label: 'Entre villes',
    sub: 'D’une ville à l’autre',
    niveau: 'prefecture',
  },
  {
    key: 'entre_communes',
    em: '🏘️',
    label: 'Entre communes',
    sub: 'Dans la même agglomération',
    niveau: 'commune',
  },
  {
    key: 'entre_quartiers',
    em: '📍',
    label: 'Entre quartiers',
    sub: 'Livraisons de proximité',
    niveau: 'quartier',
  },
] as const;

export const VEHICLE_TYPES = [
  {
    value: 'moto',
    em: '🛵',
    label: 'Moto',
    sub: 'Livraisons rapides en ville · Idéal Conakry',
  },
  {
    value: 'voiture',
    em: '🚗',
    label: 'Voiture',
    sub: 'Colis volumineux · Grand rayon',
  },
  {
    value: 'velo',
    em: '🚴',
    label: 'Vélo',
    sub: 'Courses courtes · Éco-responsable',
  },
  {
    value: 'tricycle',
    em: '🛺',
    label: 'Tricycle',
    sub: 'Grande capacité · Zones périurbaines',
  },
] as const;

export const VERIFICATION: Record<
  string,
  {
    label: string;
    tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    help: string;
  }
> = {
  pending: {
    label: 'Non soumis',
    tone: 'neutral',
    help: 'Envoyez votre CNI et votre permis ({n}/2) : la vérification démarre dès que les deux sont reçus.',
  },
  reviewing: {
    label: 'En cours d’examen',
    tone: 'info',
    help: 'Vos pièces sont en cours de vérification par l’équipe Shoneya.',
  },
  verified: {
    label: 'Compte vérifié',
    tone: 'success',
    help: 'Dossier vérifié. Vous pouvez renouveler une pièce expirée à tout moment.',
  },
  rejected: {
    label: 'Dossier refusé',
    tone: 'danger',
    help: 'Dossier refusé : renvoyez une CNI et un permis lisibles et valides.',
  },
};

/** Pièces qui déclenchent la vérification du dossier. */
export const REQUIRED_DOCS: DocKey[] = ['cni', 'permis'];
export const docField: Record<DocKey, keyof LivreurSettings> = {
  cni: 'documentCni',
  permis: 'documentPermis',
  assurance: 'documentAssurance',
  casier: 'documentCasier',
};

/** Étapes de complétion du profil (une liste vide ne compte pas), comme SecProfil du site. */
export const COMPLETION_STEPS: { label: string; key: keyof LivreurSettings }[] = [
  { label: 'Photo', key: 'photoUrl' },
  { label: 'Identité', key: 'fullName' },
  { label: 'Zones', key: 'communesActives' },
  { label: 'Véhicule', key: 'VehicleType' },
  { label: 'Horaires', key: 'horaires' },
  { label: 'Documents', key: 'documentCni' },
];
export const stepDone = (d: LivreurSettings, key: keyof LivreurSettings) => {
  const v = d[key];
  return Array.isArray(v) ? v.length > 0 : !!v;
};
export const completionPct = (d: LivreurSettings) => Math.round((COMPLETION_STEPS.filter((s) => stepDone(d, s.key)).length / COMPLETION_STEPS.length) * 100);

/** Verrou du type de livraison : 6 mois après le dernier choix. */
export function typeLock(setAt: string | null | undefined) {
  if (!setAt) return { locked: false, unlockDate: '' };
  const d = new Date(setAt);
  if (Number.isNaN(d.getTime())) return { locked: false, unlockDate: '' };
  d.setMonth(d.getMonth() + 6);
  return {
    locked: Date.now() < d.getTime(),
    unlockDate: d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

export const gnf = (n: number) => `${String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
