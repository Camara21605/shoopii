/**
 * Paramètres du correspondant (point relais) — mêmes routes que le site
 * (dashboards/correspondant/hooks/useCorrespondantParametres.ts) :
 *   GET    /correspondant/parametres            fiche complète (User + point relais + horaires + session actuelle)
 *   PATCH  /correspondant/parametres/profil     prénom, nom, e-mail, téléphone (compte) · bio, langues, type (point relais)
 *   POST   /correspondant/parametres/profil/photo   multipart « photo » (JPG / PNG / WebP, 5 MB)
 * Les autres sections sont ajoutées étape par étape (dépôt, zone & horaires…).
 * Le serveur refuse tout champ inconnu : chaque appel n'envoie que les champs
 * de son DTO.
 */
import { z } from 'zod';

import { uploadFiles, type LocalFile } from '@/features/settings-kit/upload';
import { apiFetch } from '@/lib/api/client';

export const BASE = '/correspondant/parametres';

const str = z.string().nullable().optional().catch(null);
const num = z.coerce.number().catch(0);
const flags = z.record(z.string(), z.boolean()).nullable().optional().catch(null);
const nested = z.record(z.string(), z.record(z.string(), z.boolean()).catch({})).nullable().optional().catch(null);

export const horaireSchema = z.object({
  jour: z.string(),
  ouverture: z.string().catch('08:00'),
  fermeture: z.string().catch('18:00'),
  actif: z.boolean().catch(false),
});
export type Horaire = z.infer<typeof horaireSchema>;

export const settingsSchema = z
  .object({
    /* Compte (User) */
    firstName: z.string().nullable().catch(''),
    lastName: z.string().nullable().catch(''),
    email: z.string().nullable().catch(''),
    phone: str,
    profilePicture: str,
    /* Point relais (Correspondent) */
    id: z.string(),
    fullName: z.string().nullable().catch(''),
    bio: str,
    langues: str,
    typeCorrespondant: z.string().catch('regional'),
    status: z.string().catch('active'),
    verificationStatus: z.string().catch('unverified'),
    /* Dépôt */
    depotNom: str,
    depotAdresse: str,
    depotCommune: str,
    depotQuartier: str,
    depotVille: str,
    depotRepere: str,
    depotLatitude: z.coerce.number().nullable().optional().catch(null),
    depotLongitude: z.coerce.number().nullable().optional().catch(null),
    depotPhone: str,
    depotCapacite: str,
    depotTypeLocal: str,
    depotAcces: str,
    depotAccessOptions: flags,
    /* Zone & horaires */
    zonesActives: z.array(z.string()).nullable().catch(null),
    zoneAutoRules: flags,
    horaires: z.array(horaireSchema).catch([]),
    /* Colis */
    colisDelaiMax: num,
    /* Documents (valeurs masquées « •••••• » par le serveur : seule la présence compte) */
    documentCni: str,
    documentBail: str,
    documentAssurance: str,
    documentCasier: str,
    documentRegistre: str,
    documentPhotos: z.array(z.string()).nullable().catch(null),
    /* Sécurité */
    twoFaEnabled: z.boolean().catch(false),
    /* Notifications et confidentialité : JSON { groupe: { clé: booléen } } */
    notifSettings: nested,
    privacySettings: nested,
    currentSession: z
      .object({ device: z.string().catch(''), browser: z.string().catch(''), ipAddress: str, connectedSince: z.string().catch('') })
      .nullable()
      .optional()
      .catch(null),
  })
  .passthrough();
export type CorrespondantSettings = z.infer<typeof settingsSchema>;

export const fetchSettings = () => apiFetch(BASE, { schema: settingsSchema });

/** PATCH / PUT d'une section ; la réponse (fiche ou liste) est fusionnée dans le cache par le hook. */
export const saveSection = (path: string, body: unknown, method: 'PATCH' | 'PUT' = 'PATCH') => apiFetch<Record<string, unknown> | unknown[]>(`${BASE}/${path}`, { method, body });

/* ── §1 Profil ── */

export type ProfilBody = { firstName: string; lastName: string; email: string; phone: string; bio: string; langues: string; typeCorrespondant: string };

export const uploadPhoto = (file: LocalFile) => uploadFiles(`${BASE}/profil/photo`, 'photo', [file]).then((r) => z.object({ profilePicture: z.string() }).parse(r));

/* ── §2 Point de dépôt ── */

export type DepotBody = {
  depotNom: string;
  depotAdresse: string;
  depotVille: string;
  depotCommune: string;
  depotQuartier: string;
  depotRepere: string;
  depotPhone: string;
  depotLatitude: number | null;
  depotLongitude: number | null;
  depotCapacite: string;
  depotTypeLocal: string;
  depotAcces: string;
  depotAccessOptions: Record<string, boolean>;
};

/** Mêmes listes que SecDepot du site (affichées sur le profil public : « Capacité de stockage », « Type de local »). */
/* Libellés identiques au site (apostrophe droite comprise) : une valeur choisie sur le site reste sélectionnée ici. */
export const DEPOT_CAPACITES = ["Jusqu'à 10 colis", "Jusqu'à 25 colis", "Jusqu'à 50 colis", '+50 colis (grand espace)'];
export const DEPOT_TYPES_LOCAL = ['Local commercial', 'Centre commercial', 'Bureau professionnel', 'Domicile sécurisé', 'Entrepôt'];
export const DEPOT_ACCES = ['Oui — accès contrôlé', 'Non — accès libre', 'Partiel — selon horaires'];
/** Équipements : mêmes clés que le site (libellé en minuscules, espaces → « _ »). */
export const DEPOT_EQUIPEMENTS = [
  { key: 'accès_pmr_(mobilité_réduite)', label: 'Accès PMR (mobilité réduite)', sub: 'Le point de dépôt est accessible aux personnes à mobilité réduite' },
  { key: 'parking_disponible', label: 'Parking disponible', sub: 'Un espace de stationnement est disponible à proximité' },
  { key: 'vidéosurveillance', label: 'Vidéosurveillance', sub: 'Le local est équipé d’une caméra de sécurité' },
  { key: 'stockage_climatisé', label: 'Stockage climatisé', sub: 'Pour les colis sensibles à la température' },
];

/* ── §3 Zone & horaires ── */

export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const DAY_LABEL: Record<string, string> = { Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi', Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche' };
/** « 07:00:00 » (colonne time) → « 07:00 » (format exigé par le serveur). */
export const hhmm = (v: string) => (/^\d{1,2}:\d{2}/.test(v) ? v.slice(0, 5).padStart(5, '0') : v);
/** Les 7 jours dans l'ordre (un jour absent est fermé, 08:00 → 18:00 proposé). */
export const weekOf = (list: Horaire[]): Horaire[] =>
  DAYS.map((jour) => {
    const h = list.find((x) => x.jour === jour);
    return h ? { jour, ouverture: hhmm(h.ouverture), fermeture: hhmm(h.fermeture), actif: h.actif } : { jour, ouverture: '08:00', fermeture: '18:00', actif: false };
  });
/** Créneaux proposés : toutes les 30 minutes. */
export const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Zones du site (communes de Conakry + Coyah) — leurs identifiants restent ceux du site. */
export const SITE_ZONES = [
  { id: 'kaloum', nom: 'Kaloum' },
  { id: 'dixinn', nom: 'Dixinn' },
  { id: 'matam', nom: 'Matam' },
  { id: 'ratoma', nom: 'Ratoma' },
  { id: 'matoto', nom: 'Matoto' },
  { id: 'coyah', nom: 'Coyah' },
];
/** Identifiant d'une commune : son nom en minuscules (« Kaloum » → « kaloum », comme le site). */
export const zoneId = (nom: string) => nom.trim().toLowerCase();
/** Nom affiché d'une zone enregistrée (« kaloum » → « Kaloum »). */
export const zoneLabel = (id: string) => SITE_ZONES.find((z) => z.id === id)?.nom ?? id.replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

/* ── §7 Documents ── */

export type DocKey = 'cni' | 'bail' | 'assurance' | 'casier' | 'registre';
export const DOC_FIELD: Record<DocKey, keyof CorrespondantSettings> = {
  cni: 'documentCni',
  bail: 'documentBail',
  assurance: 'documentAssurance',
  casier: 'documentCasier',
  registre: 'documentRegistre',
};
/** Pièces qui déclenchent l'examen du dossier (« en cours d'examen » dès que les deux sont reçues). */
export const REQUIRED_DOCS: DocKey[] = ['cni', 'bail'];
/** POST …/documents/:type — multipart « document » (PDF, JPG, PNG, WebP · 10 MB, 10 envois / heure). */
export const uploadDocument = (type: DocKey, file: LocalFile) =>
  uploadFiles(`${BASE}/documents/${type}`, 'document', [file]).then((r) => z.object({ present: z.boolean().catch(false), verificationStatus: z.string().optional() }).parse(r));
export const deleteDocument = (type: DocKey) => apiFetch(`${BASE}/documents/${type}`, { method: 'DELETE' });
/** Lien signé à usage immédiat (le fichier n'est jamais public). */
export const documentUrl = (type: DocKey) => apiFetch(`${BASE}/documents/${type}/url`, { schema: z.object({ url: z.string() }) }).then((r) => r.url);

/* ── §8 Sécurité ── */

/** POST …/securite/password — 8 caractères, minuscule, majuscule, chiffre ; ferme toutes les sessions (5 essais / 15 min). */
export const changePassword = (body: { currentPassword: string; newPassword: string }) => apiFetch(`${BASE}/securite/password`, { method: 'POST', body, retryOn401: false });
/** Désactivation : mot de passe actuel + code TOTP (PATCH …/securite). */
export const disableTwoFa = (currentPassword: string, code: string) => apiFetch(`${BASE}/securite`, { method: 'PATCH', body: { twoFaEnabled: false, currentPassword, code }, retryOn401: false });
/* Activation : routes communes à tous les comptes (comme TwoFaSetupModal du site). */
export const startTwoFaSetup = () => apiFetch('/auth/2fa/setup', { method: 'POST', schema: z.object({ secret: z.string(), otpauthUri: z.string() }).passthrough() });
export const confirmTwoFa = (code: string) => apiFetch('/auth/2fa/confirm', { method: 'POST', body: { code } });

/* ── §9 Notifications · §10 Confidentialité ── */

export type Nested = Record<string, Record<string, boolean>>;
/** Valeur d'une clé « groupe.clé » (absente = activée, comme le serveur). */
export const flagOf = (n: Nested | null | undefined, path: string) => {
  const [g, k] = path.split('.');
  return n?.[g]?.[k] !== false;
};
/** Copie du JSON avec des clés modifiées — les autres clés (réglées sur le site) sont conservées. */
export const withFlags = (n: Nested | null | undefined, changes: Record<string, boolean>): Nested => {
  const out: Nested = Object.fromEntries(Object.entries(n ?? {}).map(([g, v]) => [g, { ...v }]));
  for (const [path, v] of Object.entries(changes)) {
    const [g, k] = path.split('.');
    out[g] = { ...(out[g] ?? {}), [k]: v };
  }
  return out;
};

/* ── §11 Zone sensible ── */

/** Pause volontaire (statut « disabled ») — mot de passe exigé, 5 essais / 15 min. */
export const pauseAccount = (password: string) => apiFetch(`${BASE}/danger/suspendre`, { method: 'POST', body: { password }, retryOn401: false, schema: z.object({ status: z.string() }).passthrough() });
export const resumeAccount = () => apiFetch(`${BASE}/danger/reprendre`, { method: 'POST', schema: z.object({ status: z.string() }).passthrough() });
/** Refusée s'il reste des commandes en cours par le relais ou de l'argent au portefeuille ; ferme toutes les sessions. */
export const deleteAccount = (password: string) => apiFetch(`${BASE}/danger/supprimer`, { method: 'DELETE', body: { password }, retryOn401: false });

/* ── Données d'affichage ── */

export const RELAY_TYPES = [
  { value: 'regional', label: 'Régional', sub: 'Une ville (ex. Conakry)' },
  { value: 'zonal', label: 'Zonal', sub: 'Plusieurs villes d’une région' },
  { value: 'national', label: 'National', sub: 'Tout le pays' },
] as const;

export const VERIFICATION: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  unverified: { label: 'Non vérifié', tone: 'neutral' },
  reviewing: { label: 'En cours d’examen', tone: 'info' },
  verified: { label: 'Compte vérifié', tone: 'success' },
  rejected: { label: 'Dossier refusé', tone: 'danger' },
};

/** Étapes de complétion — mêmes 7 que SecProfil du site (une liste vide ne compte pas). */
export const COMPLETION_STEPS: { label: string; done: (d: CorrespondantSettings) => boolean }[] = [
  { label: 'Photo', done: (d) => !!d.profilePicture },
  { label: 'Identité', done: (d) => !!(d.firstName && d.lastName) },
  { label: 'Dépôt', done: (d) => !!d.depotAdresse },
  { label: 'Zone', done: (d) => !!d.zonesActives?.length },
  { label: 'Horaires', done: (d) => d.horaires.some((h) => h.actif) },
  { label: 'Infos fiscales', done: (d) => !!d.documentRegistre },
  { label: 'Assurance', done: (d) => !!d.documentAssurance },
];
export const completionPct = (d: CorrespondantSettings) => Math.round((COMPLETION_STEPS.filter((s) => s.done(d)).length / COMPLETION_STEPS.length) * 100);

export const displayName = (d: CorrespondantSettings) => [d.firstName, d.lastName].filter(Boolean).join(' ') || d.fullName || '';

/** Partenaire qui a recruté ce correspondant (carte « Votre partenaire Shoneya » du site) — null s'il n'y a rien à montrer. */
export const fetchRecruiter = () =>
  apiFetch('/partenaire-recruteur', {
    schema: z
      .object({
        partenaire: z
          .object({ nom: z.string().catch(''), zone: str, telephone: str })
          .nullable()
          .catch(null),
      })
      .catch({ partenaire: null }),
  }).then((r) => r.partenaire);
