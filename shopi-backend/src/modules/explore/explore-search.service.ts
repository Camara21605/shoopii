/* ============================================================
 * FICHIER : src/modules/explore/explore-search.service.ts
 *
 * RÔLE : Suggestions de la barre de recherche principale (home).
 *        GET /public/explore/suggest?q=…&scope=…&limit=…
 *
 * AVANT : le frontend lançait jusqu'à 5 requêtes HTTP par frappe
 * (produits, services, boutiques, livreurs, correspondants), chacune
 * chargeant des entités complètes (médias, paliers de gros, sous-
 * catégorie…) plus un COUNT(*) inutile pour une liste de suggestions.
 * Sur un réseau mobile lent, c'était l'essentiel de la lenteur.
 *
 * ICI : une seule requête HTTP ; les 5 recherches tournent en parallèle
 * côté serveur, chacune ne lit que les colonnes affichées (nom, prix,
 * première image…) avec un LIMIT, sans COUNT. Résultat mis en cache
 * 60 s (Redis) : la même recherche tapée par plusieurs clients ne
 * repasse pas par la base.
 *
 * PRÉCISION : voir search-text.util.ts (accents, ordre des mots,
 * pluriels) et le classement par pertinence (nom exact d'abord).
 * Mêmes règles de visibilité que les listes publiques : boutique
 * active, produits épuisés masqués si la boutique le demande,
 * « Apparaître dans la recherche » respecté.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Service, ServiceVisibility } from 'src/database/entities/entreprise.table/service.entity';
import { Company, CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery, DeliveryStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent, CorrespondantStatus } from 'src/database/entities/profiles/correspondant-profile.entity';
import { UserStatus } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { actorLocation } from 'src/common/utils/actor-location.util';
import { RedisCacheService } from 'src/modules/performance-engine/services/redis-cache.service';
import {
  applySearchTokens, relevanceSql, searchPhrase, searchTokens, setSearchRankParams,
} from './search-text.util';

export type SuggestScope = 'tout' | 'produits' | 'services' | 'boutiques' | 'livreurs' | 'correspondants';
export const SUGGEST_SCOPES: SuggestScope[] = ['tout', 'produits', 'services', 'boutiques', 'livreurs', 'correspondants'];

export interface SuggestItem {
  id:           string;
  label:        string;
  /** Pertinence du nom (0 = nom exact … 5 = trouvé ailleurs) — permet au
   *  frontend de mélanger les types en scope « Tout » sans perdre l'ordre. */
  rank:         number;
  image:        string | null;
  /** Ville / quartier (boutiques, livreurs, correspondants) */
  location?:    string | null;
  /** Produits et services */
  prix?:        number | null;
  pricingType?: string | null;
  companyId?:   string;
  companyName?: string | null;
}

export interface SuggestResponse {
  produits:       SuggestItem[];
  services:       SuggestItem[];
  boutiques:      SuggestItem[];
  livreurs:       SuggestItem[];
  correspondants: SuggestItem[];
}

const SUGGEST_DEFAULT_LIMIT = 5;
const SUGGEST_MAX_LIMIT     = 10;
const SUGGEST_CACHE_TTL_SEC = 60;

const empty = (): SuggestResponse => ({ produits: [], services: [], boutiques: [], livreurs: [], correspondants: [] });

@Injectable()
export class ExploreSearchService {

  constructor(
    @InjectRepository(Product)       private readonly productRepo:       Repository<Product>,
    @InjectRepository(Service)       private readonly serviceRepo:       Repository<Service>,
    @InjectRepository(Company)       private readonly companyRepo:       Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo:      Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly correspondantRepo: Repository<Correspondent>,
    private readonly cache: RedisCacheService,
  ) {}

  async suggest(q: string | undefined, scope: SuggestScope = 'tout', limit = SUGGEST_DEFAULT_LIMIT): Promise<SuggestResponse> {
    const tokens = searchTokens(q);
    if (tokens.length === 0 || searchPhrase(q).length < 2) return empty();

    const max = Math.min(Math.max(limit, 1), SUGGEST_MAX_LIMIT);
    const cacheKey = `explore:suggest:${scope}:${max}:${searchPhrase(q)}`;
    const cached = await this.cache.get<SuggestResponse>(cacheKey);
    if (cached) return cached;

    const raw = q!.trim();
    const want = (s: SuggestScope) => scope === 'tout' || scope === s;
    const none = Promise.resolve([] as SuggestItem[]);

    const [produits, services, boutiques, livreurs, correspondants] = await Promise.all([
      want('produits')       ? this.produits(raw, tokens, max)       : none,
      want('services')       ? this.services(raw, tokens, max)       : none,
      want('boutiques')      ? this.boutiques(raw, tokens, max)      : none,
      want('livreurs')       ? this.livreurs(raw, tokens, max)       : none,
      want('correspondants') ? this.correspondants(raw, tokens, max) : none,
    ]);

    const result: SuggestResponse = { produits, services, boutiques, livreurs, correspondants };
    await this.cache.set(cacheKey, result, SUGGEST_CACHE_TTL_SEC);
    return result;
  }

  // ── Produits ─────────────────────────────────────────────────────

  private async produits(raw: string, tokens: string[], max: number): Promise<SuggestItem[]> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .innerJoin('p.company', 'company')
      .leftJoin('p.category', 'category')
      .leftJoin('p.subCategory', 'subCategory')
      .select('p.id', 'id')
      .addSelect('p.nom', 'nom')
      .addSelect('p.prix', 'prix')
      .addSelect('p.prixPromo', 'prixPromo')
      .addSelect('p.companyId', 'companyId')
      .addSelect('company.companyName', 'companyName')
      .addSelect(`(SELECT m.url FROM product_media m WHERE m."productId" = p.id ORDER BY m.ordre ASC LIMIT 1)`, 'image')
      .where('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .andWhere('company.status = :companyStatus', { companyStatus: CompanyStatus.ACTIVE })
      .andWhere('(company."showOutOfStock" = true OR p.stock > 0)');

    /* La description n'entre pas dans les suggestions : un mot cité en
     * passant (« compatible iPhone ») remontait des produits sans rapport. */
    applySearchTokens(qb, ['p.nom', 'p.marque', 'p.tags', 'category.nom', 'subCategory.nom'], tokens);
    this.rank(qb, 'p.nom', raw, tokens);
    qb.addOrderBy('p.stock > 0', 'DESC').addOrderBy('p.createdAt', 'DESC').limit(max);

    const rows = await qb.getRawMany();
    return rows.map(r => {
      const prix  = r.prix != null ? Number(r.prix) : null;
      const promo = r.prixPromo != null ? Number(r.prixPromo) : null;
      return {
        id: r.id, rank: Number(r.relevance), label: r.nom, image: r.image ?? null,
        prix: promo != null && prix != null && promo < prix ? promo : prix,
        companyId: r.companyId, companyName: r.companyName ?? null,
      };
    });
  }

  // ── Services ─────────────────────────────────────────────────────

  private async services(raw: string, tokens: string[], max: number): Promise<SuggestItem[]> {
    const qb = this.serviceRepo
      .createQueryBuilder('s')
      .innerJoin('s.company', 'company')
      .leftJoin('s.category', 'category')
      .leftJoin('s.subCategory', 'subCategory')
      .select('s.id', 'id')
      .addSelect('s.nom', 'nom')
      .addSelect('s.prix', 'prix')
      .addSelect('s.pricingType', 'pricingType')
      .addSelect('s.companyId', 'companyId')
      .addSelect('company.companyName', 'companyName')
      .addSelect(`(SELECT m.url FROM service_media m WHERE m."serviceId" = s.id ORDER BY m.ordre ASC LIMIT 1)`, 'image')
      .where('s.visibilite = :vis', { vis: ServiceVisibility.PUBLIC })
      .andWhere('company.status = :companyStatus', { companyStatus: CompanyStatus.ACTIVE });

    applySearchTokens(qb, ['s.nom', 's.tags', 'category.nom', 'subCategory.nom'], tokens);
    this.rank(qb, 's.nom', raw, tokens);
    qb.addOrderBy('s.createdAt', 'DESC').limit(max);

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id: r.id, rank: Number(r.relevance), label: r.nom, image: r.image ?? null,
      prix: r.prix != null ? Number(r.prix) : null, pricingType: r.pricingType ?? null,
      companyId: r.companyId, companyName: r.companyName ?? null,
    }));
  }

  // ── Boutiques ────────────────────────────────────────────────────

  private async boutiques(raw: string, tokens: string[], max: number): Promise<SuggestItem[]> {
    const qb = this.companyRepo
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.companyName', 'companyName')
      .addSelect('c.logo', 'logo')
      .addSelect('c.ville', 'ville')
      .addSelect('c.commune', 'commune')
      .addSelect('c.quartier', 'quartier')
      .where('c.status = :status', { status: CompanyStatus.ACTIVE })
      /* Paramètres > Confidentialité « Apparaître dans la recherche » — même condition que /public/boutiques */
      .andWhere(`(c."privacySettings"->>'showInSearch') IS DISTINCT FROM 'false'`);

    /* Les mots-clés de la boutique (« restaurant », « pharmacie »…) comptent
     * aussi : avant, seul le nom exact de la boutique la faisait sortir. */
    applySearchTokens(qb, ['c.companyName', 'c.tags'], tokens);
    this.rank(qb, 'c.companyName', raw, tokens);
    qb.addOrderBy('c.averageRating', 'DESC', 'NULLS LAST').limit(max);

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id: r.id, rank: Number(r.relevance), label: r.companyName, image: r.logo ?? null,
      location: actorLocation({ ville: r.ville, commune: r.commune, quartier: r.quartier }).localisation,
    }));
  }

  // ── Livreurs ─────────────────────────────────────────────────────

  private async livreurs(raw: string, tokens: string[], max: number): Promise<SuggestItem[]> {
    /* Mêmes filtres que LivreursClientService.buildBaseQuery() (liste /livreurs) */
    const qb = this.deliveryRepo
      .createQueryBuilder('lp')
      .innerJoin('lp.user', 'u')
      .select('lp.id', 'id')
      .addSelect('lp.fullName', 'fullName')
      .addSelect('lp.photoUrl', 'photoUrl')
      .addSelect('lp.zone', 'zone')
      .addSelect('lp.ville', 'ville')
      .addSelect('lp.commune', 'commune')
      .addSelect('lp.quartier', 'quartier')
      .where('u.role = :role', { role: UserRole.DELIVERY })
      .andWhere('u.status = :uStatus', { uStatus: UserStatus.ACTIVE })
      .andWhere(`(lp."privacySettings"->>'showInSearch') IS DISTINCT FROM 'false'`)
      .andWhere('lp.status NOT IN (:...horsService)', { horsService: [DeliveryStatus.SUSPENDED, DeliveryStatus.BANNED] })
      .andWhere('lp.suspendedUntil IS NULL');

    applySearchTokens(qb, ['lp.fullName', 'lp.quartier', 'lp.commune', 'lp.ville'], tokens);
    this.rank(qb, 'lp.fullName', raw, tokens);
    qb.addOrderBy('lp.averageRating', 'DESC', 'NULLS LAST').limit(max);

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id: r.id, rank: Number(r.relevance), label: r.fullName, image: r.photoUrl ?? null,
      location: actorLocation({ ville: r.ville, commune: r.commune, quartier: r.quartier }).localisation ?? r.zone ?? null,
    }));
  }

  // ── Correspondants ───────────────────────────────────────────────

  private async correspondants(raw: string, tokens: string[], max: number): Promise<SuggestItem[]> {
    /* Mêmes filtres que SuivisCorrespondantService (liste /correspondants) */
    const qb = this.correspondantRepo
      .createQueryBuilder('cor')
      .leftJoin('cor.user', 'user')
      .select('cor.id', 'id')
      .addSelect('cor.fullName', 'fullName')
      .addSelect('user.profilePicture', 'profilePicture')
      .addSelect('cor.depotVille', 'ville')
      .addSelect('cor.depotCommune', 'commune')
      .addSelect('cor.depotQuartier', 'quartier')
      .where('cor.status IN (:...statuses)', { statuses: [CorrespondantStatus.ACTIVE, CorrespondantStatus.PENDING] })
      .andWhere(`(cor."privacySettings"->'visibilite'->>'apparaitreRecherche') IS DISTINCT FROM 'false'`);

    applySearchTokens(qb, ['cor.fullName', 'cor.depotQuartier', 'cor.depotCommune', 'cor.depotVille'], tokens);
    this.rank(qb, 'cor.fullName', raw, tokens);
    qb.addOrderBy('cor.averageRating', 'DESC', 'NULLS LAST').limit(max);

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      id: r.id, rank: Number(r.relevance), label: r.fullName || 'Sans nom', image: r.profilePicture ?? null,
      location: actorLocation({ ville: r.ville, commune: r.commune, quartier: r.quartier }).localisation,
    }));
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Trie par pertinence du nom (exact > commence par > contient…). */
  private rank(qb: SelectQueryBuilder<any>, nameCol: string, raw: string, tokens: string[]): void {
    qb.addSelect(relevanceSql(nameCol, tokens), 'relevance');
    setSearchRankParams(qb, raw);
    qb.orderBy('relevance', 'ASC');
  }
}
