/**
 * Espace entreprise › Fournisseurs — mêmes adresses que la page du site
 * (FournisseursPage.tsx) : un fournisseur est une autre boutique Shoneya qui
 * vend en gros (produits publics « vente en gros »).
 *   GET    /fournisseurs                    fournisseurs connectés           (fournisseurs.view)
 *   GET    /fournisseurs/recherche?search=  boutiques vendant en gros (30)   (fournisseurs.view)
 *   POST   /fournisseurs { supplierCompanyId }  se connecter                 (fournisseurs.connect)
 *   GET    /fournisseurs/:companyId/catalogue   catalogue de gros (connecté) (fournisseurs.view)
 *   DELETE /fournisseurs/:linkId            se déconnecter                   (fournisseurs.disconnect)
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

const supplierSchema = z
  .object({
    linkId: z.string(),
    companyId: z.string(),
    nom: z.string().catch('Fournisseur'),
    logo: z.string().nullable().catch(null),
    description: z.string().nullable().catch(null),
    produitsGrosCount: num,
    connecteLe: z.string().catch(''),
  })
  .passthrough();
export type Supplier = z.infer<typeof supplierSchema>;

const candidateSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch('Boutique'),
    logo: z.string().nullable().catch(null),
    description: z.string().nullable().catch(null),
    produitsGrosCount: num,
    dejaConnecte: z.boolean().catch(false),
  })
  .passthrough();
export type Candidate = z.infer<typeof candidateSchema>;

const tierSchema = z.object({ quantiteMin: num, quantiteMax: z.coerce.number().nullable().catch(null), prixUnitaire: num });
const catalogueSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    prix: num,
    moq: z.coerce.number().nullable().catch(null),
    conditionnement: z.coerce.number().nullable().catch(null),
    image: z.string().nullable().catch(null),
    wholesaleTiers: z.array(tierSchema).catch([]),
  })
  .passthrough();
export type CatalogueItem = z.infer<typeof catalogueSchema>;
export type Tier = z.infer<typeof tierSchema>;

export const fetchSuppliers = () => apiFetch('/fournisseurs', { schema: z.array(supplierSchema).catch([]) });
export const searchCandidates = (q: string, signal?: AbortSignal) =>
  apiFetch('/fournisseurs/recherche', { signal, query: { search: q.trim() || undefined }, schema: z.array(candidateSchema).catch([]) });
export const connectSupplier = (supplierCompanyId: string) =>
  apiFetch('/fournisseurs', { method: 'POST', body: { supplierCompanyId }, schema: supplierSchema });
export const disconnectSupplier = (linkId: string) => apiFetch(`/fournisseurs/${linkId}`, { method: 'DELETE' });
export const fetchCatalogue = (companyId: string) =>
  apiFetch(`/fournisseurs/${companyId}/catalogue`, { schema: z.array(catalogueSchema).catch([]) });

export const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;
export const tierRange = (t: Tier) => (t.quantiteMax ? `${t.quantiteMin} à ${t.quantiteMax}` : `${t.quantiteMin} et +`);
/** Meilleur prix unitaire en gros (palier le plus bas), sinon le prix de détail. */
export const bestPrice = (p: CatalogueItem) => (p.wholesaleTiers.length ? Math.min(...p.wholesaleTiers.map((t) => t.prixUnitaire)) : p.prix);
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
