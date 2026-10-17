/**
 * Prestations de service de l'ENTREPRISE (comptes « services ») — mêmes
 * adresses que les pages du site (ServicesPage.tsx, AjouterServicePage.tsx) :
 *   GET    /prestations?limit=100          mes prestations (tous statuts)
 *   GET    /prestations/categories         catégories CHOISIES par l'entreprise
 *   GET    /prestations/:id                détail (modification)
 *   POST   /prestations                    créer · PATCH /prestations/:id modifier
 *   PATCH  /prestations/:id/publish        publier (≥ 1 photo, prix ou « sur devis »)
 *   PATCH  /prestations/:id/archive        retirer du catalogue
 *   DELETE /prestations/:id                supprimer
 * Une prestation sans photo reste en BROUILLON (règle du serveur).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const str = z.string().nullable().optional().catch(null);
const numOrNull = z.coerce.number().nullable().optional().catch(null);

export type ServiceVisibility = 'public' | 'draft' | 'private';
export type PricingType = 'fixe' | 'horaire' | 'sur_devis';
export type ResponseDelay = 'immediate' | '24h' | '48h' | '7j';
export type CancellationPolicy = 'flexible' | 'moderee' | 'stricte' | 'non_remboursable';

const mediaSchema = z.object({ url: z.string(), type: z.string().catch('image'), ordre: z.coerce.number().catch(0) }).passthrough();

export const serviceSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    description: str,
    tags: str,
    visibilite: z.enum(['public', 'draft', 'private']).catch('draft'),
    pricingType: z.enum(['fixe', 'horaire', 'sur_devis']).catch('fixe'),
    prix: numOrNull,
    prixAncien: numOrNull,
    dureeMinMinutes: numOrNull,
    dureeMaxMinutes: numOrNull,
    capaciteMax: numOrNull,
    surPlaceEntreprise: z.boolean().catch(true),
    aDomicile: z.boolean().catch(false),
    aDistance: z.boolean().catch(false),
    zoneCouverture: str,
    fraisDeplacement: numOrNull,
    reservationRequise: z.boolean().catch(true),
    delaiReponse: z.enum(['immediate', '24h', '48h', '7j']).catch('24h'),
    politiqueAnnulation: z.enum(['flexible', 'moderee', 'stricte', 'non_remboursable']).catch('moderee'),
    category: z.object({ id: z.string(), nom: z.string().catch('') }).nullable().optional().catch(null),
    subCategory: z.object({ id: z.string(), nom: z.string().catch('') }).nullable().optional().catch(null),
    media: z.array(mediaSchema).catch([]),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type Service = z.infer<typeof serviceSchema>;

export const fetchMyServices = () =>
  apiFetch('/prestations', { query: { limit: 100 }, schema: z.object({ data: z.array(serviceSchema).catch([]) }).passthrough() }).then((r) => r.data);

export const fetchService = (id: string) => apiFetch(`/prestations/${id}`, { schema: serviceSchema });

const categorySchema = z
  .object({ id: z.string(), nom: z.string(), subCategories: z.array(z.object({ id: z.string(), nom: z.string() })).catch([]) })
  .passthrough();
export type ServiceCategory = z.infer<typeof categorySchema>;
export const fetchServiceCategories = () => apiFetch('/prestations/categories', { schema: z.array(categorySchema).catch([]) });

const saved = serviceSchema.pick({ id: true, visibilite: true }).passthrough();
export const createService = (dto: Record<string, unknown>) => apiFetch('/prestations', { method: 'POST', body: dto, schema: saved });
export const updateService = (id: string, dto: Record<string, unknown>) => apiFetch(`/prestations/${id}`, { method: 'PATCH', body: dto, schema: saved });
export const publishService = (id: string) => apiFetch(`/prestations/${id}/publish`, { method: 'PATCH' });
export const archiveService = (id: string) => apiFetch(`/prestations/${id}/archive`, { method: 'PATCH' });
export const deleteService = (id: string) => apiFetch(`/prestations/${id}`, { method: 'DELETE' });

/* ── Présentation ─────────────────────────────────────────────────────── */

export const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;

/** « 150 000 GNF », « 20 000 GNF / h », « Sur devis ». */
export function priceLabel(s: Pick<Service, 'pricingType' | 'prix'>): string {
  if (s.pricingType === 'sur_devis' || !s.prix) return 'Sur devis';
  return s.pricingType === 'horaire' ? `${gnf(s.prix)} / h` : gnf(s.prix);
}

/** « 2 h », « 30 min – 1 h 30 ». */
export function durationLabel(min?: number | null, max?: number | null): string | null {
  const f = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
  if (min && max && max !== min) return `${f(min)} – ${f(max)}`;
  if (min) return f(min);
  if (max) return f(max);
  return null;
}

export const VISIBILITY: Record<ServiceVisibility, { label: string; color: string; bg: string }> = {
  public: { label: 'Publiée', color: '#047857', bg: '#ECFDF5' },
  draft: { label: 'Brouillon', color: '#B45309', bg: '#FFF7E6' },
  private: { label: 'Retirée', color: '#6B7280', bg: '#F3F4F6' },
};

export const PRICING: { value: PricingType; label: string }[] = [
  { value: 'fixe', label: 'Prix fixe' },
  { value: 'horaire', label: 'À l’heure' },
  { value: 'sur_devis', label: 'Sur devis' },
];
export const DELAYS: { value: ResponseDelay; label: string }[] = [
  { value: 'immediate', label: 'Immédiat' },
  { value: '24h', label: 'Sous 24 h' },
  { value: '48h', label: 'Sous 48 h' },
  { value: '7j', label: 'Sous 7 jours' },
];
export const POLICIES: { value: CancellationPolicy; label: string }[] = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'moderee', label: 'Modérée' },
  { value: 'stricte', label: 'Stricte' },
  { value: 'non_remboursable', label: 'Non remboursable' },
];

export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
