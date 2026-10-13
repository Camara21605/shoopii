/**
 * Explorer — mêmes adresses que la page /explorer du site
 * (shopi-frontend/src/modules/home/components/explorer) :
 *   GET /public/explore                 grille paginée (search, category, minPrice, maxPrice, ville)
 *   GET /public/explore/pour-vous       recommandations (personnalisées si connecté, sinon tendances)
 *   GET /public/explore/tendances       produits tendance (cache recalculé toutes les heures)
 *   GET /public/explore/nouveautes      derniers produits publiés
 *   GET /public/explore/proches?ville=  produits des boutiques de cette ville
 *   GET /location/addresses             ville de l'adresse par défaut (pré-remplit « Proches de vous »)
 */
import { z } from 'zod';

import { shopProductSchema } from '@/features/shop/api';
import { apiFetch } from '@/lib/api/client';

export const exploreProductSchema = shopProductSchema.extend({
  companyId: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyVerified: z.boolean().optional(),
});
export type ExploreProduct = z.infer<typeof exploreProductSchema>;

export type ExploreFilters = {
  search?: string;
  category?: string;
  /** Sous-catégorie (uuid) */
  subCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  ville?: string;
};

export const PAGE_SIZE = 20;

export async function fetchExplorePage(page: number, f: ExploreFilters) {
  return apiFetch('/public/explore', {
    auth: false,
    schema: z.object({ data: z.array(exploreProductSchema), total: z.coerce.number().catch(0) }).passthrough(),
    query: {
      page,
      limit: PAGE_SIZE,
      search: f.search?.trim() || undefined,
      category: f.category,
      subCategory: f.subCategory,
      minPrice: f.minPrice,
      maxPrice: f.maxPrice,
      ville: f.ville,
    },
  });
}

export type ExploreSection = 'pour-vous' | 'tendances' | 'nouveautes' | 'proches';

/** « Pour vous » est personnalisé quand le jeton est envoyé (garde JWT optionnelle côté serveur). */
export function fetchExploreSection(kind: ExploreSection, ville?: string) {
  return apiFetch(`/public/explore/${kind}`, {
    auth: kind === 'pour-vous',
    schema: z.array(exploreProductSchema).catch([]),
    query: { limit: 12, ville: kind === 'proches' ? ville : undefined },
  });
}

/** Ville de l'adresse par défaut du client (sinon de sa première adresse). */
export async function fetchDefaultCity(): Promise<string | null> {
  const list = await apiFetch('/location/addresses', {
    schema: z.array(z.object({ ville: z.string().nullable().optional(), estDefaut: z.boolean().optional() }).passthrough()).catch([]),
  });
  return (list.find((a) => a.estDefaut) ?? list[0])?.ville ?? null;
}
