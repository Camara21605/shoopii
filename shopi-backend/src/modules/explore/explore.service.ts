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
import { Company, CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Category } from 'src/database/entities/entreprise.table/category.entity';
import { TrendingProduct } from 'src/database/entities/entreprise.table/trending-product.entity';
import { ProductCooccurrence } from 'src/database/entities/entreprise.table/product-cooccurrence.entity';
import { CommandeItem } from 'src/database/entities/commande/commande-item.entity';
import { ProductLike } from 'src/database/entities/entreprise.table/product-like.entity';
import { Client } from 'src/database/entities/profiles/client-profile.entity';
import type { PublicProduitResponse } from '../public/public.service';
import {
  EXPLORE_DEFAULT_LIMIT, EXPLORE_MAX_LIMIT,
  EXPLORE_SECTION_DEFAULT_LIMIT, EXPLORE_SECTION_MAX_LIMIT,
} from './explore.constants';
import { VerificationStatus as CompanyVerificationStatus } from 'src/common/enums/verification-status.enum';
import { applySearchTokens, relevanceSql, searchTokens, setSearchRankParams, unaccentSql } from './search-text.util';

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
    @InjectRepository(CommandeItem)
    private readonly commandeItemRepo: Repository<CommandeItem>,
    @InjectRepository(ProductLike)
    private readonly likeRepo: Repository<ProductLike>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
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
      /* BUG CORRIGÉ — les produits d'une boutique suspendue ou en attente
       * de validation sortaient dans la recherche, puis la fiche produit
       * répondait « introuvable » au clic (/public/produits/:id filtre
       * déjà Company.status — voir PublicService.listProduits). */
      .andWhere('company.status = :companyStatus', { companyStatus: CompanyStatus.ACTIVE })
      /* BUG CORRIGÉ — voir le commentaire sur loadPublicProducts() plus bas. */
      .andWhere('(company."showOutOfStock" = true OR p.stock > 0)')
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const tokens = searchTokens(query.search);
    if (tokens.length) {
      /* Chaque mot doit se retrouver quelque part, sans tenir compte des
       * accents ni de l'ordre (voir search-text.util.ts) — avant, la
       * phrase entière devait apparaître telle quelle : « telephone »
       * ne trouvait pas « Téléphone », « galaxy samsung » ne trouvait rien. */
      applySearchTokens(qb, ['p.nom', 'p.marque', 'p.tags', 'p.description', 'category.nom', 'subCategory.nom'], tokens);

      /* Pertinence : nom exact > nom commence par la recherche > un mot du
       * nom commence par la recherche > … > trouvé seulement dans la
       * description (le moins fiable, classé en dernier).
       * .orderBy() REMPLACE le tri par défaut (createdAt DESC) posé plus
       * haut ; .addOrderBy() le réinjecte ensuite comme critère secondaire. */
      const descOnly = tokens
        .map((_, i) => `(${['p.nom', 'p.marque', 'p.tags', 'category.nom', 'subCategory.nom']
          .map(c => `${unaccentSql(c)} LIKE :tk${i} ESCAPE '\\'`).join(' OR ')})`)
        .join(' AND ');
      qb.addSelect(
        `CASE WHEN ${descOnly} THEN ${relevanceSql('p.nom', tokens)} ELSE 6 END`,
        'relevance',
      );
      setSearchRankParams(qb, query.search!);
      qb.orderBy('relevance', 'ASC').addOrderBy('p.createdAt', 'DESC');
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
    return { data: await this.toPublicProduits(products), total, page, pages: Math.ceil(total / limit) };
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

    return this.toPublicProduits(rows
      .map(r => byId.get(r.productId))
      .filter((p): p is Product => !!p)
      .slice(0, max));
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
      .andWhere('(company."showOutOfStock" = true OR p.stock > 0)')
      .orderBy('p.createdAt', 'DESC')
      .take(max)
      .getMany();

    return this.toPublicProduits(products);
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
      .andWhere('(company."showOutOfStock" = true OR p.stock > 0)')
      .andWhere('LOWER(company.ville) = LOWER(:ville)', { ville: ville.trim() })
      .orderBy('p.createdAt', 'DESC')
      .take(max)
      .getMany();

    return this.toPublicProduits(products);
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

    return this.toPublicProduits(rows
      .map(r => byId.get(r.relatedProductId))
      .filter((p): p is Product => !!p));
  }

  // ── Pour vous — personnalisé à partir des likes + achats du client,
  // via le cache product_cooccurrence déjà calculé (pas de nouveau
  // moteur ML : on réutilise le signal "souvent acheté avec" existant,
  // ancré sur les produits que CE client a lui-même aimés/achetés).
  // Gouverné par Client.privacySettings.perso (section "Confidentialité
  // du profil") — absent/true = personnalisé, false = repli sur les
  // tendances globales (mêmes résultats pour tout le monde). ──────────

  async pourVous(userId: string | undefined, limit = EXPLORE_SECTION_DEFAULT_LIMIT): Promise<PublicProduitResponse[]> {
    const max = Math.min(limit, EXPLORE_SECTION_MAX_LIMIT);

    if (!userId) return this.tendances(max);

    const client = await this.clientRepo.findOne({ where: { userId }, select: ['id', 'privacySettings'] });
    if (!client) return this.tendances(max);

    const privacy = (client.privacySettings ?? {}) as Record<string, unknown>;
    if (privacy.perso === false) return this.tendances(max);

    const seedIds = await this.recentSignalProductIds(client.id);
    if (seedIds.length === 0) return this.tendances(max);

    const coocRows = await this.coocRepo
      .createQueryBuilder('c')
      .where('c.productId IN (:...ids)', { ids: seedIds })
      .andWhere('c.relatedProductId NOT IN (:...exclude)', { exclude: seedIds })
      .getMany();

    if (coocRows.length === 0) return this.tendances(max);

    /* Agrège les scores si plusieurs produits "vus" par le client pointent
     * vers le même produit recommandé (plus il revient, plus il est pertinent). */
    const scoreByProduct = new Map<string, number>();
    for (const row of coocRows) {
      scoreByProduct.set(row.relatedProductId, (scoreByProduct.get(row.relatedProductId) ?? 0) + row.coOccurrenceCount);
    }

    const rankedIds = [...scoreByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([id]) => id);

    const products = await this.loadPublicProducts(rankedIds);
    const byId = new Map(products.map(p => [p.id, p]));
    const result = await this.toPublicProduits(rankedIds.map(id => byId.get(id)).filter((p): p is Product => !!p));

    /* Le cache de cooccurrence peut être plus court que `max` (produits
     * dépubliés, peu de recoupements) — complète avec les tendances
     * globales sans doublons plutôt que de renvoyer une liste partielle. */
    if (result.length < max) {
      const seen = new Set([...seedIds, ...result.map(p => p.id)]);
      const filler = (await this.tendances(max)).filter(p => !seen.has(p.id));
      result.push(...filler.slice(0, max - result.length));
    }

    return result;
  }

  /** Produits likés + achetés récemment par ce client (signal de
   * personnalisation) — bornés pour ne pas construire une clause IN
   * démesurée sur un gros historique. */
  private async recentSignalProductIds(clientId: string): Promise<string[]> {
    const [likes, purchased] = await Promise.all([
      this.likeRepo.find({
        where: { clientId }, select: { productId: true },
        order: { createdAt: 'DESC' }, take: 20,
      }),
      this.commandeItemRepo
        .createQueryBuilder('ci')
        .innerJoin('ci.commande', 'cmd')
        .where('cmd.clientId = :clientId', { clientId })
        .andWhere('ci.productId IS NOT NULL')
        .orderBy('ci.createdAt', 'DESC')
        .limit(20)
        .getMany(),
    ]);

    const ids = new Set<string>();
    for (const l of likes) ids.add(l.productId);
    for (const p of purchased) if (p.productId) ids.add(p.productId);
    return [...ids];
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
      /* BUG CORRIGÉ — même correctif que PublicService.getBoutiqueProduits/
       * listProduits : Company.showOutOfStock était enregistré mais jamais
       * lu, y compris ici (grille "Explorer"). */
      .andWhere('(company."showOutOfStock" = true OR p.stock > 0)')
      .getMany();
  }

  private toPublicProduits(products: Product[]): Promise<PublicProduitResponse[]> {
    return Promise.all(products.map(p => this.toPublicProduit(p)));
  }

  /** Même mapping que PublicService.toPublicProduit() — dupliqué volontairement
   *  pour ne pas coupler ExploreModule à l'implémentation interne de PublicService
   *  (méthode privée non exportée). Garder les deux synchronisées si le format
   *  PublicProduitResponse évolue. */
  private async toPublicProduit(p: Product): Promise<PublicProduitResponse> {
    /* BUG CORRIGÉ — p.company est une relation lazy : même chargée par
     * leftJoinAndSelect, la lire sans await renvoie une Promise, d'où un
     * nom/logo/ville de boutique toujours vides et le réglage « prix
     * barré » ignoré sur l'Explorer et la recherche (même correctif que
     * PublicService.toPublicProduit). Aucune requête en plus : la
     * Promise est déjà résolue avec la donnée jointe. */
    const company = (await p.company) as Company | undefined;
    const hasPromo = p.prixPromo != null && Number(p.prixPromo) < Number(p.prix);
    const prix       = hasPromo ? Number(p.prixPromo) : Number(p.prix);
    const prixAncienRaw = hasPromo ? Number(p.prix) : (p.prixAncien != null ? Number(p.prixAncien) : null);
    /* BUG CORRIGÉ — même correctif que PublicService : Company.showStrikePrice
     * était enregistré mais jamais lu ici non plus. */
    const prixAncien = (company?.showStrikePrice ?? true) ? prixAncienRaw : null;

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
        .map(img => ({ id: img.id, url: img.url, ordre: img.ordre, alt: img.alt, type: img.type })),
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
      companyVerified: company?.verificationStatus === CompanyVerificationStatus.VERIFIED,
      companyVille:    company?.ville ?? null,
      companyPays:     company?.pays  ?? 'GN',
      /* Non chargés par les requêtes Explorer (grille/carrousels — pas
       * besoin des specs/variantes détaillées) : valeurs par défaut,
       * jamais consommées côté grille (voir CardProduit). */
      condition: p.condition ?? 'neuf',
      garantie:  p.garantie  ?? '',
      specs:     [],
      variantes: [],
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
      returnPolicy: company?.returnPolicy ?? null,
      createdAt:    p.createdAt.toISOString(),
    };
  }
}
