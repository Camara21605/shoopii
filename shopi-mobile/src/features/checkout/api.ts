/**
 * Passage de commande (écran /commande) — mêmes adresses et MÊMES RÈGLES que le
 * serveur (shopi-backend commande-creation.service) :
 *   POST /client/commandes          { delMode, livreurId?, correspondantId?, adresse… }
 *   GET  /location/addresses        adresses enregistrées du client
 *   GET  /client/parametres/profil  prénom, nom, téléphone (pré-remplissage)
 *   GET  /suivis/mes-abonnements    livreurs et points relais suivis par le client
 *   GET  /public/boutiques/:id[/livreurs|/correspondants]   réglages et équipe de chaque boutique
 *   GET  /geo/frais-livraison?ville= tarif de la zone (livreur Shoneya uniquement)
 *
 * Règles des modes (une commande est créée PAR boutique, le mode choisi doit
 * être accepté par CHAQUE boutique du panier, sinon le serveur refuse) :
 *   · « Par la boutique » : livraison standard (si la commune est dans ses zones,
 *     ou aucune zone choisie) OU retrait en boutique — gratuit ;
 *   · « Livreur Shoneya » : la boutique accepte les livreurs Shoneya — frais de la
 *     zone de destination, par boutique ;
 *   · « Point relais » : la boutique a activé les correspondants — gratuit.
 */
import { z } from 'zod';

import type { ShopDetail } from '@/features/shop/api';
import { apiFetch } from '@/lib/api/client';

export type DeliveryMode = 'std' | 'lvr' | 'relay';

/* ── Disponibilité des modes ────────────────────────────────────────── */

/** Nom de commune comparable : minuscules, sans accents ni espaces superflus. */
export const normCommune = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

type Livraison = NonNullable<ShopDetail['livraison']>;
const DEFAULT_LIVRAISON: Livraison = { standard: true, livreursShopi: true, correspondants: false, clickCollect: true, zones: [] };

/** La boutique livre-t-elle elle-même cette commune ? (aucune zone choisie = partout) */
function livreCommune(l: Livraison, commune: string | null) {
  if (!l.standard) return false;
  if (!commune || !l.zones.length) return true;
  const c = normCommune(commune);
  return l.zones.some((z) => normCommune(z) === c);
}

export type ModeAvailability = { ok: boolean; blockedBy: string[] };
export type Modes = Record<DeliveryMode, ModeAvailability> & {
  /** Libellé du mode boutique selon ce que proposent les boutiques. */
  stdKind: 'livraison' | 'retrait' | 'les-deux';
  /** Boutiques qui ne livrent pas la commune (retrait seulement). */
  outOfZone: string[];
};

export function resolveModes(shops: Pick<ShopDetail, 'companyName' | 'livraison'>[], commune: string | null): Modes {
  const std: string[] = [];
  const lvr: string[] = [];
  const relay: string[] = [];
  const outOfZone: string[] = [];
  let deliver = 0;
  let pickup = 0;
  for (const s of shops) {
    const l = s.livraison ?? DEFAULT_LIVRAISON;
    const livre = livreCommune(l, commune);
    if (!livre && !l.clickCollect) std.push(s.companyName);
    else {
      if (livre) deliver++;
      if (l.clickCollect) pickup++;
      if (l.standard && !livre) outOfZone.push(s.companyName);
    }
    if (!l.livreursShopi) lvr.push(s.companyName);
    if (!l.correspondants) relay.push(s.companyName);
  }
  const stdKind = shops.length === 0 || (deliver === shops.length && pickup === shops.length) ? 'les-deux' : deliver === shops.length ? 'livraison' : pickup === shops.length ? 'retrait' : 'les-deux';
  return {
    std: { ok: std.length === 0, blockedBy: std },
    lvr: { ok: lvr.length === 0, blockedBy: lvr },
    relay: { ok: relay.length === 0, blockedBy: relay },
    stdKind,
    outOfZone,
  };
}

/* ── Données du formulaire ──────────────────────────────────────────── */

const str = z.string().nullable().optional();

const savedAddressSchema = z
  .object({
    id: z.string(),
    libelle: str,
    typeAdresse: str,
    rue: str,
    quartier: str,
    commune: str,
    ville: z.string().catch(''),
    telephone: str,
    estDefaut: z.boolean().catch(false),
  })
  .passthrough();
export type SavedAddress = z.infer<typeof savedAddressSchema>;

export const fetchSavedAddresses = () => apiFetch('/location/addresses', { schema: z.array(savedAddressSchema).catch([]) });

export const fetchContact = () =>
  apiFetch('/client/parametres/profil', {
    schema: z.object({ firstName: z.string().catch(''), lastName: z.string().catch(''), phone: str }).passthrough(),
  });

/** Livreurs et points relais suivis par le client (proposés en plus de ceux de la boutique). */
const followedSchema = z.object({ id: z.string(), nom: z.string().catch(''), categorie: z.string().catch(''), emoji: z.string().catch(''), note: z.coerce.number().catch(0) }).passthrough();
export const fetchFollowedTeam = () =>
  apiFetch('/suivis/mes-abonnements', {
    schema: z.object({ livreurs: z.array(followedSchema).catch([]), correspondants: z.array(followedSchema).catch([]) }).passthrough(),
  });
export type FollowedActor = z.infer<typeof followedSchema>;

/* ── Création ───────────────────────────────────────────────────────── */

export type OrderInput = {
  mode: DeliveryMode;
  driverId?: string;
  relayId?: string;
  firstName: string;
  lastName: string;
  phone: string; // 9 chiffres, sans indicatif
  city: string;
  commune: string;
  address: string;
  instructions?: string;
};

/** Le serveur accepte delMode 'std' | 'lvr' ; le point relais = 'std' + correspondantId. */
export function createOrder(o: OrderInput) {
  return apiFetch('/client/commandes', {
    method: 'POST',
    schema: z.object({ id: z.string() }).passthrough(),
    body: {
      delMode: o.mode === 'lvr' ? 'lvr' : 'std',
      livreurId: o.mode === 'lvr' ? o.driverId : undefined,
      correspondantId: o.mode === 'relay' ? o.relayId : undefined,
      payMode: 'wallet',
      destination: o.commune || o.city,
      prenomLivraison: o.firstName.trim(),
      nomLivraison: o.lastName.trim(),
      telephoneLivraison: `+224${o.phone}`,
      villeLivraison: o.city,
      communeLivraison: o.commune || undefined,
      adressePrecise: o.address.trim(),
      instructions: o.instructions?.trim() || undefined,
    },
  });
}

/** « +224 620 10 26 44 » / « 620102644 » → « 620102644 » (9 chiffres guinéens). */
export function localPhone(p?: string | null) {
  const d = (p ?? '').replace(/\D/g, '');
  return d.startsWith('224') ? d.slice(3, 12) : d.slice(0, 9);
}
