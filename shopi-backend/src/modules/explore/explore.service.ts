/* ============================================================
 * FICHIER : src/modules/explore/explore.service.ts
 *
 * RÔLE : Lectures pour l'onglet Explorer (home client) :
 *          - grille principale filtrée/paginée (recherche, catégorie,
 *            prix, ville) — requête live, filtres indexés (voir
 *            migration 1721400000006)
 *          - Tendances       — LIT trending_products (cache, voir
 *                              ExploreScheduler), jamais recalculé ici
 *          - Nouveautés      — tri createdAt DESC, requête live (pas de
 *                              cache : un ORDER BY indexé n'est pas un
 *                              calcul coûteux, contrairement au scoring
 *                              de tendance ou au self-join de cooccurrence)
 *          - Proches de vous — filtre Company.ville, requête live
 *          - Souvent acheté avec — LIT product_cooccurrence (cache)
 *
 * Réutilise le format PublicProduitResponse (public.service.ts) pour
 * que le frontend consomme ces endpoints avec le composant CardProduit
 * déjà existant, sans aucune adaptation.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Category } from 'src/database/entities/entreprise.table/category.entity';
import { TrendingProduct } from 'src/database/entities/entreprise.table/trending-product.entity';
import { ProductCooccurrence } from 'src/database/entities/entreprise.table/product-cooccurrence.entity';
import type { PublicProduitResponse } from '../public/public.service';
import {
  EXPLORE_DEFAULT_LIMIT, EXPLORE_MAX_LIMIT,
  EXPLORE_SECTION_DEFAULT_LIMIT, EXPLORE_SECTION_MAX_LIMIT,
} from './explore.constants';

export interface ExploreQuery {
  page?:     number;
  limit?:    number;
  search?:   string;
  category?: string;  // id (uuid) ou slug
  minPrice?: number;
  maxPrice?: number;
  ville?:    string;  // filtre géographique — voir écart signalé en Phase 0 (pas de zoneId sur Product/Company)
}

export interface ExploreListResponse {
  data:  PublicProduitResponse[];
  total: number;
  page:  number;
  pages: number;
}

@Injectable()
export class ExploreService {

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(TrendingProduct)
    private readonly trendingRepo: Repository<TrendingProduct>,
    @InjectRepository(ProductCooccurrence)
    private readonly coocRepo: Repository<ProductCooccurrence>,
  ) {}

  // ── Grille principale — recherche + filtres + pagination ────────

  async grid(query: ExploreQuery): Promise<ExploreListResponse> {
    const page  = query.page  && query.page  > 0 ? query.page : 1;
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : EXPLORE_DEFAULT_LIMIT, EXPLORE_MAX_LIMIT);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',          'images')
      .leftJoinAndSelect('p.category',       'category')
      .leftJoinAndSelect('p.subCategory',    'subCategory')
      .leftJoinAndSelect('p.company',        'company')
      .leftJoinAndSelect('p.wholesaleTiers', 'tiers')
      .where('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(p.nom) LIKE :term OR LOWER(COALESCE(p.marque,'')) LIKE :term OR LOWER(COALESCE(p.tags,'')) LIKE :term)`,
        { term },
      );
    }

    if (query.category) {
      const categoryId = await this.resolveCategoryId(query.category);
      if (categoryId) qb.andWhere('p.categoryId = :catId', { catId: categoryId });
      else return { data: [], total: 0, page, pages: 0 }; // catégorie inconnue → aucun résultat plutôt qu'ignorer le filtre
    }

    if (query.minPrice != null) qb.andWhere('p.prix >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice != null) qb.andWhere('p.prix <= :maxPrice', { maxPrice: query.maxPrice });

    if (query.ville?.trim()) {
      qb.andWhere('LOWER(company.ville) = LOWER(:ville)', { ville: query.ville.trim() });
    }

    const [products, total] = await qb.getManyAndCount();
    return { data: products.map(p => this.toPublicProduit(p)), total, page, pages: Math.ceil(total / limit) };
  }

  /** Accepte un id UUID direct ou un slug de catégorie (ex: ?category=electronique). */
  private async resolveCategoryId(idOrSlug: string): Promise<string | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) return idOrSlug;
    const cat = await this.categoryRepo.findOne({ where: { slug: idOrSlug } });
    return cat?.id ?? null;
  }

  // ── Tendances — lit le cache trending_products ──────────────────

  async tendances(limit = EXPLORE_SECTION_DEFAULT_LIMIT): Promise<PublicProduitResponse[]> {
    const max = Math.min(limit, EXPLORE_SECTION_MAX_LIMIT);

    const rows = await this.trendingRepo
      .createQueryBuilder('t')
      .orderBy('t.score', 'DESC')
      .take(max * 2) // marge : certains produits du cache peuvent avoir été dépubliés depuis le dernier calcul
      .getMany();

    if (rows.length === 0) return [];

    const products = await this.loadPublicProducts(rows.map(r => r.productId));
    const byId = new Map(products.map(p => [p.id, p]));

    return rows
      .map(r => byId.get(r.productId))
      .filter((p): p is Product => !!p)
      .slice(0, max)
      .map(p => this.toPublicProduit(p));
  }

  // ── Nouveautés — requête live, tri par date (index existant) ────

  async nouveautes(limit = EXPLORE_SECTION_DEFAULT_LIMIT): Promise<PublicProduitResponse[]> {
    const max = Math.min(limit, EXPLORE_SECTION_MAX_LIMIT);
    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',    'images')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.company',  'company')
      .where('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('p.createdAt', 'DESC')
      .take(max)
      .getMany();

    return products.map(p => this.toPublicProduit(p));
  }

  // ── Proches de vous — filtre Company.ville, requête live ────────
  //
  // Écart signalé en Phase 0 : ni Product ni Company n'ont de zoneId
  // (les geo_zones couvrent des zones de LIVRAISON, pas un rattachement
  // direct produit/entreprise). Le filtre se fait donc sur la ville
  // texte de la boutique, comparée à celle transmise par le client
  // (son adresse par défaut, résolue côté frontend).

  async proches(ville: string | undefined, limit = EXPLORE_SECTION_DEFAULT_LIMIT): Promise<PublicProduitResponse[]> {
    if (!ville?.trim()) return [];
    const max = Math.min(limit, EXPLORE_SECTION_MAX_LIMIT);

    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',    'images')
      .leftJoinAndSelect('p.category', 'category')
      .innerJoinAndSelect('p.company', 'company')
      .where('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .andWhere('LOWER(company.ville) = LOWER(:ville)', { ville: ville.trim() })
      .orderBy('p.createdAt', 'DESC')
      .take(max)
      .getMany();

    return products.map(p => this.toPublicProduit(p));
  }

  // ── Souvent acheté avec — lit le cache product_cooccurrence ─────

  async souventAcheteAvec(productId: string, limit = 6): Promise<PublicProduitResponse[]> {
    const max = Math.min(limit, EXPLORE_SECTION_MAX_LIMIT);

    const rows = await this.coocRepo
      .createQueryBuilder('c')
      .where('c.productId = :productId', { productId })
      .orderBy('c.coOccurrenceCount', 'DESC')
      .take(max)
      .getMany();

    if (rows.length === 0) return [];

    const products = await this.loadPublicProducts(rows.map(r => r.relatedProductId));
    const byId = new Map(products.map(p => [p.id, p]));

    return rows
      .map(r => byId.get(r.relatedProductId))
      .filter((p): p is Product => !!p)
      .map(p => this.toPublicProduit(p));
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async loadPublicProducts(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',          'images')
      .leftJoinAndSelect('p.category',       'category')
      .leftJoinAndSelect('p.subCategory',    'subCategory')
      .leftJoinAndSelect('p.company',        'company')
      .leftJoinAndSelect('p.wholesaleTiers', 'tiers')
      .where('p.id IN (:...ids)', { ids })
      .andWhere('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .getMany();
  }

  /** Même mapping que PublicService.toPublicProduit() — dupliqué volontairement
   *  pour ne pas coupler ExploreModule à l'implémentation interne de PublicService
   *  (méthode privée non exportée). Garder les deux synchronisées si le format
   *  PublicProduitResponse évolue. */
  private toPublicProduit(p: Product): PublicProduitResponse {
    const company = p.company as Company | undefined;
    const hasPromo = p.prixPromo != null && Number(p.prixPromo) < Number(p.prix);
    const prix       = hasPromo ? Number(p.prixPromo) : Number(p.prix);
    const prixAncien = hasPromo ? Number(p.prix) : (p.prixAncien != null ? Number(p.prixAncien) : null);

    return {
      id:          p.id,
      nom:         p.nom,
      description: p.description,
      prix,
      prixAncien,
      marque:      p.marque,
      urlSlug:     p.urlSlug,
      stock:       p.stock,
      visibilite:  p.visibilite,
      images: (p.media ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(img => ({ id: img.id, url: img.url, ordre: img.ordre, alt: img.alt })),
      category: {
        id:    p.category?.id    ?? '',
        nom:   p.category?.nom   ?? '',
        icone: p.category?.icone ?? null,
      },
      subCategory: p.subCategory
        ? { id: p.subCategory.id, nom: p.subCategory.nom }
        : null,
      companyId:   p.companyId,
      companyName: company?.companyName ?? '',
      companyLogo: company?.logo        ?? null,
      livraisonStandard:      p.livraisonStandard      ?? true,
      livraisonLivreur:       p.livraisonLivreur        ?? true,
      livraisonCorrespondant: p.livraisonCorrespondant  ?? false,
      fraisLivraisonLocal:    p.fraisLivraisonLocal      ?? null,
      delaiLivraison:         p.delaiLivraison,
      venteEnGros:    p.venteEnGros ?? false,
      moq:            p.moq         ?? null,
      wholesaleTiers: (p.wholesaleTiers ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(t => ({
          quantiteMin:  t.quantiteMin,
          quantiteMax:  t.quantiteMax,
          prixUnitaire: Number(t.prixUnitaire),
          ordre:        t.ordre,
        })),
    };
  }
}
