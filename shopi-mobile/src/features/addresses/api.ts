/**
 * Mes adresses (client) — mêmes adresses et mêmes règles que le site
 * (client-address.controller.ts / SectionAddresses.tsx) :
 *   GET    /location/addresses              liste (par défaut d'abord, puis la plus récente)
 *   POST   /location/addresses              créer (la 1re devient d'office l'adresse par défaut)
 *   PATCH  /location/addresses/:id          modifier ('' ou null vide un champ)
 *   DELETE /location/addresses/:id          supprimer (le « par défaut » passe à la plus récente)
 *   PATCH  /location/addresses/:id/default  définir par défaut (renvoie la liste à jour)
 * 20 adresses au plus par compte. La ville est obligatoire.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export const MAX_ADDRESSES = 20;

export type AddressType = 'domicile' | 'bureau' | 'boutique' | 'entrepot' | 'relais' | 'autre';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Types proposés au client (mêmes que TYPE_OPTIONS du site), avec icône et teinte. */
export const ADDRESS_TYPES: { value: AddressType; label: string; icon: IconName; color: string }[] = [
  { value: 'domicile', label: 'Domicile', icon: 'home', color: '#1F1F1F' },
  { value: 'bureau', label: 'Bureau', icon: 'briefcase', color: '#2563EB' },
  { value: 'boutique', label: 'Boutique', icon: 'storefront', color: '#D97706' },
  { value: 'entrepot', label: 'Entrepôt', icon: 'cube', color: '#7C3AED' },
  { value: 'relais', label: 'Point relais', icon: 'location', color: '#059669' },
  { value: 'autre', label: 'Autre', icon: 'pin', color: '#6B7280' },
];
export const typeMeta = (t?: string | null) => ADDRESS_TYPES.find((x) => x.value === t) ?? ADDRESS_TYPES[ADDRESS_TYPES.length - 1];

const str = z.string().nullable().optional();
/* Les colonnes decimal de PostgreSQL arrivent en texte : « 9.641200 » → 9.6412 */
const coord = z.preprocess((v) => (v === null || v === undefined || v === '' ? null : Number(v)), z.number().finite().nullable().catch(null));

export const addressSchema = z
  .object({
    id: z.string(),
    typeAdresse: z.string().catch('domicile'),
    libelle: str,
    rue: str,
    quartier: str,
    commune: str,
    ville: z.string().catch(''),
    pays: str,
    latitude: coord,
    longitude: coord,
    instructions: str,
    telephone: str,
    estDefaut: z.boolean().catch(false),
  })
  .passthrough();
export type Address = z.infer<typeof addressSchema>;

/** Corps envoyé au serveur : '' = champ vidé (le serveur le met à NULL). */
export type AddressInput = {
  typeAdresse: AddressType;
  libelle: string;
  rue: string;
  quartier: string;
  commune: string;
  ville: string;
  /** Code du pays du référentiel (« GN »), ou son nom s'il n'a pas de code. */
  pays: string;
  instructions: string;
  telephone: string;
  latitude: number | null;
  longitude: number | null;
  estDefaut: boolean;
};

export const fetchAddresses = () => apiFetch('/location/addresses', { schema: z.array(addressSchema) });

export const createAddress = (body: AddressInput) =>
  apiFetch('/location/addresses', { method: 'POST', body: { ...body, pays: body.pays || 'GN' }, schema: addressSchema });

export const updateAddress = (id: string, body: Partial<AddressInput>) =>
  apiFetch(`/location/addresses/${id}`, { method: 'PATCH', body, schema: addressSchema });

export const deleteAddress = (id: string) => apiFetch(`/location/addresses/${id}`, { method: 'DELETE' });

export const setDefaultAddress = (id: string) =>
  apiFetch(`/location/addresses/${id}/default`, { method: 'PATCH', schema: z.array(addressSchema) });

/* ── Affichage ──────────────────────────────────────────────────────── */

/** Titre de la carte : libellé, sinon le type (« Domicile »). */
export const addressTitle = (a: Pick<Address, 'libelle' | 'typeAdresse'>) => a.libelle?.trim() || typeMeta(a.typeAdresse).label;

/** « Rue 12, Boussoura · Kaloum, Conakry » */
export function addressLines(a: Pick<Address, 'rue' | 'quartier' | 'commune' | 'ville'>) {
  const place = [a.quartier, a.commune].filter(Boolean).join(' · ');
  return { street: a.rue?.trim() || null, place: [place, a.ville].filter(Boolean).join(', ') };
}

/** +224 620000000 → « +224 620 00 00 00 » (lecture plus facile). */
export function formatPhone(p?: string | null) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  const local = d.startsWith('224') && d.length === 12 ? d.slice(3) : d;
  if (local.length !== 9) return p;
  return `+224 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}
