/* ============================================================
 * FICHIER      : src/modules/explore/explore.service.spec.ts
 * RÔLE         : Tests unitaires de ExploreService.
 *
 * Comme call.service.spec.ts, tous les repos TypeORM sont mockés —
 * pas de connexion DB réelle. ExploreService utilise createQueryBuilder()
 * pour toutes ses lectures (filtres dynamiques) : le mock expose une
 * chaîne fluide dont chaque méthode de filtrage retourne `this`, et
 * dont le terminal (getMany/getManyAndCount) est configurable par test.
 *
 * COUVERTURE :
 *   ✅ grid() — catégorie passée en UUID direct (pas de lookup slug)
 *   ✅ grid() — catégorie passée en slug → résolue via categoryRepo
 *   ✅ grid() — slug de catégorie inconnu → résultat vide (pas de filtre ignoré)
 *   ✅ grid() — pagination par défaut (page=1, limit=EXPLORE_DEFAULT_LIMIT)
 *   ✅ tendances() — ignore les lignes de cache dont le produit n'est
 *                    plus public/existant (dépublié depuis le calcul)
 *   ✅ tendances() — respecte l'ordre du cache (score DESC), pas l'ordre
 *                    de retour de loadPublicProducts()
 *   ✅ proches() — ville absente → tableau vide, aucune requête émise
 *   ✅ souventAcheteAvec() — préserve l'ordre de coOccurrenceCount DESC
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ExploreService } from './explore.service';
import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Category } from 'src/database/entities/entreprise.table/category.entity';
import { TrendingProduct } from 'src/database/entities/entreprise.table/trending-product.entity';
import { ProductCooccurrence } from 'src/database/entities/entreprise.table/product-cooccurrence.entity';
import { EXPLORE_DEFAULT_LIMIT } from './explore.constants';

/** Chaîne QueryBuilder mockée — chaque méthode de filtre retourne `this`. */
function makeQbMock(terminal: Partial<Record<'getMany' | 'getManyAndCount' | 'getOne', jest.Mock>> = {}) {
  const qb: any = {
    leftJoinAndSelect: jest.fn(() => qb),
    innerJoinAndSelect: jest.fn(() => qb),
    where:      jest.fn(() => qb),
    andWhere:   jest.fn(() => qb),
    orderBy:    jest.fn(() => qb),
    skip:       jest.fn(() => qb),
    take:       jest.fn(() => qb),
    getMany:          terminal.getMany          ?? jest.fn().mockResolvedValue([]),
    getManyAndCount:  terminal.getManyAndCount  ?? jest.fn().mockResolvedValue([[], 0]),
    getOne:           terminal.getOne           ?? jest.fn().mockResolvedValue(null),
  };
  return qb;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return Object.assign(new Product(), {
    id: 'prod-1', nom: 'Produit test', prix: 100_000, prixAncien: null, prixPromo: null,
    marque: null, urlSlug: null, stock: 10, visibilite: ProductVisibility.PUBLIC,
    media: [], category: { id: 'cat-1', nom: 'Cat', icone: null }, subCategory: null,
    companyId: 'company-1', company: { companyName: 'Boutique', logo: null },
    livraisonStandard: true, livraisonLivreur: true, livraisonCorrespondant: false,
    fraisLivraisonLocal: null, delaiLivraison: '1-3 jours', venteEnGros: false, moq: null,
    wholesaleTiers: [],
    ...overrides,
  } as any);
}

describe('ExploreService', () => {
  let service: ExploreService;
  let productRepo: any;
  let categoryRepo: any;
  let trendingRepo: any;
  let coocRepo: any;

  beforeEach(async () => {
    productRepo  = { createQueryBuilder: jest.fn() };
    categoryRepo = { findOne: jest.fn() };
    trendingRepo = { createQueryBuilder: jest.fn() };
    coocRepo     = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExploreService,
        { provide: getRepositoryToken(Product),            useValue: productRepo },
        { provide: getRepositoryToken(Category),            useValue: categoryRepo },
        { provide: getRepositoryToken(TrendingProduct),     useValue: trendingRepo },
        { provide: getRepositoryToken(ProductCooccurrence), useValue: coocRepo },
      ],
    }).compile();

    service = module.get(ExploreService);
  });

  describe('grid()', () => {
    it('utilise directement un UUID de catégorie sans consulter categoryRepo', async () => {
      const qb = makeQbMock({ getManyAndCount: jest.fn().mockResolvedValue([[makeProduct()], 1]) });
      productRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.grid({ category: '11111111-1111-1111-1111-111111111111' });

      expect(categoryRepo.findOne).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith('p.categoryId = :catId', { catId: '11111111-1111-1111-1111-111111111111' });
      expect(result.total).toBe(1);
    });

    it('résout un slug de catégorie via categoryRepo avant de filtrer', async () => {
      const qb = makeQbMock({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      productRepo.createQueryBuilder.mockReturnValue(qb);
      categoryRepo.findOne.mockResolvedValue({ id: 'cat-resolved', slug: 'electronique' });

      await service.grid({ category: 'electronique' });

      expect(categoryRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'electronique' } });
      expect(qb.andWhere).toHaveBeenCalledWith('p.categoryId = :catId', { catId: 'cat-resolved' });
    });

    it('renvoie un résultat vide sans exécuter la requête si le slug est inconnu', async () => {
      const qb = makeQbMock();
      productRepo.createQueryBuilder.mockReturnValue(qb);
      categoryRepo.findOne.mockResolvedValue(null);

      const result = await service.grid({ category: 'inconnu' });

      expect(result).toEqual({ data: [], total: 0, page: 1, pages: 0 });
      expect(qb.getManyAndCount).not.toHaveBeenCalled();
    });

    it('applique la pagination par défaut quand page/limit sont absents', async () => {
      const qb = makeQbMock({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      productRepo.createQueryBuilder.mockReturnValue(qb);

      await service.grid({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(EXPLORE_DEFAULT_LIMIT);
    });
  });

  describe('tendances()', () => {
    it('ignore les produits du cache qui ne sont plus publics/existants', async () => {
      const cacheQb = makeQbMock({
        getMany: jest.fn().mockResolvedValue([
          { productId: 'prod-1', score: 50 },
          { productId: 'prod-depublie', score: 30 },
        ]),
      });
      trendingRepo.createQueryBuilder.mockReturnValue(cacheQb);

      const loadQb = makeQbMock({ getMany: jest.fn().mockResolvedValue([makeProduct({ id: 'prod-1' })]) });
      productRepo.createQueryBuilder.mockReturnValue(loadQb);

      const result = await service.tendances(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prod-1');
    });

    it("respecte l'ordre du cache (score DESC) même si loadPublicProducts renvoie un ordre différent", async () => {
      const cacheQb = makeQbMock({
        getMany: jest.fn().mockResolvedValue([
          { productId: 'prod-A', score: 90 },
          { productId: 'prod-B', score: 50 },
        ]),
      });
      trendingRepo.createQueryBuilder.mockReturnValue(cacheQb);

      // La requête SQL renvoie B avant A (ordre non garanti) — le mapping doit re-suivre le cache.
      const loadQb = makeQbMock({
        getMany: jest.fn().mockResolvedValue([makeProduct({ id: 'prod-B' }), makeProduct({ id: 'prod-A' })]),
      });
      productRepo.createQueryBuilder.mockReturnValue(loadQb);

      const result = await service.tendances(10);

      expect(result.map(p => p.id)).toEqual(['prod-A', 'prod-B']);
    });
  });

  describe('proches()', () => {
    it("renvoie un tableau vide sans requête si aucune ville n'est fournie", async () => {
      const result = await service.proches(undefined);
      expect(result).toEqual([]);
      expect(productRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("filtre par ville (insensible à la casse) quand elle est fournie", async () => {
      const qb = makeQbMock({ getMany: jest.fn().mockResolvedValue([]) });
      productRepo.createQueryBuilder.mockReturnValue(qb);

      await service.proches('Conakry');

      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(company.ville) = LOWER(:ville)', { ville: 'Conakry' });
    });
  });

  describe('souventAcheteAvec()', () => {
    it('préserve l\'ordre de coOccurrenceCount DESC issu du cache', async () => {
      const cacheQb = makeQbMock({
        getMany: jest.fn().mockResolvedValue([
          { relatedProductId: 'prod-top', coOccurrenceCount: 12 },
          { relatedProductId: 'prod-second', coOccurrenceCount: 4 },
        ]),
      });
      coocRepo.createQueryBuilder.mockReturnValue(cacheQb);

      const loadQb = makeQbMock({
        getMany: jest.fn().mockResolvedValue([makeProduct({ id: 'prod-second' }), makeProduct({ id: 'prod-top' })]),
      });
      productRepo.createQueryBuilder.mockReturnValue(loadQb);

      const result = await service.souventAcheteAvec('prod-1');

      expect(result.map(p => p.id)).toEqual(['prod-top', 'prod-second']);
    });

    it('renvoie un tableau vide si aucune paire en cache', async () => {
      const cacheQb = makeQbMock({ getMany: jest.fn().mockResolvedValue([]) });
      coocRepo.createQueryBuilder.mockReturnValue(cacheQb);

      const result = await service.souventAcheteAvec('prod-sans-historique');

      expect(result).toEqual([]);
      expect(productRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
