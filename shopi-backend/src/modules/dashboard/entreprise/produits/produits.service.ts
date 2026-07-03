/* ============================================================
 * FICHIER : src/modules/produits/produits.service.ts
 *
 * CORRECTIONS :
 *  1. CompanyType correctement injecté dans le constructeur
 *  2. Ajout de getCategoriesPourEntreprise() → filtre les
 *     catégories selon le companyTypeId de l'entreprise
 *  3. createProduct() → vérifie que la catégorie choisie
 *     appartient bien au type de l'entreprise connectée
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CompanyType } from 'src/database/entities/entreprise.table/company-type.entity';
import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { ProductMedia }   from 'src/database/entities/entreprise.table/product-media.entity';
import { ProductVariant } from 'src/database/entities/entreprise.table/product-variant.entity';
import { ProductSpec }    from 'src/database/entities/entreprise.table/product-spec.entity';
import { ProductWholesaleTier } from 'src/database/entities/entreprise.table/product-wholesale-tier.entity';
import { ProductStory, StoryMediaType, StoryStatus } from 'src/database/entities/entreprise.table/product-story.entity';
import { Category }       from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory }    from 'src/database/entities/entreprise.table/sub-category.entity';
import { Company }        from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }           from 'src/database/entities/user.entity';
import { UserRole }       from 'src/common/enums/user-role.enum';

import {
  CreateProductDto,
  UpdateProductDto,
  FilterProductsDto,
} from './dto/create-product.dto';

export interface ProductResponse {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  stock:       number;
  seuil:       number | null;
  visibilite:  string;
  condition:   string;
  garantie:    string;
  marque:      string | null;
  tags:        string | null;
  reference:   string | null;
  langue:      string;
  paysOrigine: string;
  poids:       number | null;
  longueur:    number | null;
  largeur:     number | null;
  hauteur:     number | null;
  politiqueRetour:        string;
  contenuBoite:           string | null;
  livraisonStandard:      boolean;
  livraisonLivreur:       boolean;
  livraisonCorrespondant: boolean;
  fraisLivraisonLocal:    number | null;
  delaiLivraison:         string;
  garantiePaiement:  boolean;
  garantieRetour:    boolean;
  garantieAuthentic: boolean;
  garantieSupport:   boolean;
  titreSeo:       string | null;
  descriptionSeo: string | null;
  urlSlug:        string | null;
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  variantes:   { id: string; type: string; vals: string }[];
  venteEnGros:          boolean;
  moq:                  number | null;
  conditionnement:      number | null;
  delaiPreparationGros: string | null;
  wholesaleTiers:       { id: string; quantiteMin: number; quantiteMax: number | null; prixUnitaire: number; ordre: number }[];
  companyId:   string;
  createdAt:   string;
  updatedAt:   string;
}

export interface ProductListResponse {
  data:  ProductResponse[];
  total: number;
  page:  number;
  pages: number;
}

// Réponse pour la liste des catégories filtrées
export interface CategorieDisponible {
  id:            string;
  nom:           string;
  icone:         string | null;
  subCategories: { id: string; nom: string }[];
}

@Injectable()
export class ProduitsService {

  private readonly logger = new Logger(ProduitsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductMedia)
    private readonly imageRepo: Repository<ProductMedia>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(ProductSpec)
    private readonly specRepo: Repository<ProductSpec>,

    @InjectRepository(ProductWholesaleTier)
    private readonly wholesaleTierRepo: Repository<ProductWholesaleTier>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(SubCategory)
    private readonly subCatRepo: Repository<SubCategory>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    // ✅ CORRECTION : CompanyType injecté (était importé mais pas injecté)
    @InjectRepository(CompanyType)
    private readonly companyTypeRepo: Repository<CompanyType>,

    @InjectRepository(ProductStory)
    private readonly storyRepo: Repository<ProductStory>,

    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // NOUVELLE MÉTHODE : getCategoriesPourEntreprise()
  //
  // Appelée par GET /produits/categories
  // Retourne uniquement les catégories du type de l'entreprise connectée.
  //
  // Logique :
  //  1. Récupère le profil Company de l'utilisateur
  //  2. Lit son companyTypeId
  //  3. Si companyTypeId → filtre : catégories de ce type + catégories génériques
  //  4. Si pas de companyTypeId → toutes les catégories (fallback)
  // ══════════════════════════════════════════════════════════════════════════

  async getCategoriesPourEntreprise(user: User): Promise<CategorieDisponible[]> {
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');

    const qb = this.categoryRepo
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.subCategories', 'sub', 'sub.actif = :actif', { actif: true })
      .where('cat.actif = :actif', { actif: true })
      .orderBy('cat.ordre', 'ASC')
      .addOrderBy('sub.ordre', 'ASC');

    // ✅ Filtre par type si l'entreprise en a un
    // Inclut aussi les catégories "génériques" (companyTypeId IS NULL)
    // qui sont accessibles à tous les types d'entreprise
    if (company.companyTypeId) {
      qb.andWhere(
        '(cat.companyTypeId = :typeId OR cat.companyTypeId IS NULL)',
        { typeId: company.companyTypeId },
      );
    }
    // Si pas de type assigné → toutes les catégories (fallback)

    const cats = await qb.getMany();

    return cats.map(c => ({
      id:    c.id,
      nom:   c.nom,
      icone: c.icone,
      subCategories: (c.subCategories ?? []).map(s => ({ id: s.id, nom: s.nom })),
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // createProduct()
  // ══════════════════════════════════════════════════════════════════════════

  async createProduct(dto: CreateProductDto, user: User): Promise<ProductResponse> {

    // ── Résolution catégorie ──────────────────────────────────────────────
    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Catégorie introuvable (ID: ${dto.categoryId}).`);
    }

    let subCategory: SubCategory | null = null;
    if (dto.subCategoryId) {
      subCategory = await this.subCatRepo.findOne({
        where: { id: dto.subCategoryId, category: { id: dto.categoryId } },
      });
      if (!subCategory) {
        throw new NotFoundException(
          `Sous-catégorie introuvable ou n'appartient pas à la catégorie sélectionnée.`,
        );
      }
    }

    // ── Résolution profil Company ──────────────────────────────────────────
    const companyProfile = await this.companyRepo
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId: user.id })
      .getOne();

    if (!companyProfile) {
      throw new NotFoundException(
        `Profil entreprise introuvable. Vérifiez que le compte a été créé avec le rôle company.`,
      );
    }

    // ✅ CORRECTION : Vérifie que la catégorie appartient au type de l'entreprise
    // Bloque si les deux ont un type ET qu'ils sont différents
    if (
      companyProfile.companyTypeId &&
      category.companyTypeId &&
      category.companyTypeId !== companyProfile.companyTypeId
    ) {
      throw new BadRequestException(
        `La catégorie "${category.nom}" n'appartient pas au type d'entreprise de votre compte. ` +
        `Veuillez choisir une catégorie correspondant à votre type d'activité.`,
      );
    }

    // ── Génération slug ───────────────────────────────────────────────────
    const slug = dto.urlSlug
      ? this.normalizeSlug(dto.urlSlug)
      : await this.generateUniqueSlug(dto.nom);

    const slugExists = await this.productRepo.findOne({ where: { urlSlug: slug } });
    if (slugExists) {
      throw new ConflictException(`L'URL slug "${slug}" est déjà utilisé par un autre produit.`);
    }

    // ── Transaction atomique ──────────────────────────────────────────────
    let newProduct: Product;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const productEntity = new Product();
      Object.assign(productEntity, {
        nom:          dto.nom.trim(),
        description:  dto.description?.trim()  ?? null,
        contenuBoite: dto.contenuBoite?.trim()  ?? null,
        marque:       dto.marque?.trim()         ?? null,
        tags:         dto.tags?.trim()           ?? null,
        reference:    dto.reference?.trim()      ?? null,
        garantie:     dto.garantie              ?? '12 mois',
        langue:       dto.langue                ?? 'fr',
        categoryId:   category.id,
        subCategoryId: subCategory?.id          ?? null,
        prix:         dto.prix,
        prixAncien:   dto.prixAncien            ?? null,
        stock:        dto.stock                 ?? 0,
        seuil:        dto.seuil                 ?? null,
        visibilite:   dto.visibilite            ?? ProductVisibility.DRAFT,
        condition:    dto.condition             ?? 'neuf',
        paysOrigine:  dto.paysOrigine           ?? 'GN',
        poids:        dto.poids                 ?? null,
        longueur:     dto.longueur              ?? null,
        largeur:      dto.largeur               ?? null,
        hauteur:      dto.hauteur               ?? null,
        politiqueRetour:        dto.politiqueRetour        ?? '7j',
        livraisonStandard:      dto.livraisonStandard      ?? true,
        livraisonLivreur:       dto.livraisonLivreur       ?? true,
        livraisonCorrespondant: dto.livraisonCorrespondant ?? false,
        fraisLivraisonLocal:    dto.fraisLivraisonLocal    ?? null,
        delaiLivraison:         dto.delaiLivraison         ?? '1-3 jours',
        garantiePaiement:  dto.garantiePaiement  ?? true,
        garantieRetour:    dto.garantieRetour     ?? true,
        garantieAuthentic: dto.garantieAuthentic  ?? true,
        garantieSupport:   dto.garantieSupport    ?? true,
        titreSeo:       dto.titreSeo?.trim()       ?? null,
        descriptionSeo: dto.descriptionSeo?.trim() ?? null,
        urlSlug:        slug,
        companyId:      companyProfile.id,
        venteEnGros:          dto.venteEnGros          ?? false,
        moq:                  dto.moq                  ?? null,
        conditionnement:      dto.conditionnement      ?? null,
        delaiPreparationGros: dto.delaiPreparationGros ?? null,
      });

      newProduct = await qr.manager.save(Product, productEntity);

      if (dto.images?.length) {
        const imageEntities = dto.images.map((img, idx) =>
          this.imageRepo.create({
            url:       img.url,
            ordre:     img.ordre ?? idx,
            alt:       img.alt   ?? null,
            productId: newProduct.id,
          }),
        );
        await qr.manager.save(ProductMedia, imageEntities);
      }

      if (dto.specs?.length) {
        const nonEmptySpecs = dto.specs.filter(s => s.cle?.trim() && s.valeur?.trim());
        if (nonEmptySpecs.length) {
          const specEntities = nonEmptySpecs.map((spec, idx) =>
            this.specRepo.create({
              cle:     spec.cle.trim(),
              valeur:  spec.valeur.trim(),
              ordre:   spec.ordre ?? idx,
              product: { id: newProduct.id } as Product,
            }),
          );
          await qr.manager.save(ProductSpec, specEntities);
        }
      }

      if (dto.variantes?.length) {
        const nonEmptyVariants = dto.variantes.filter(v => v.vals.trim());
        if (nonEmptyVariants.length) {
          const variantEntities = nonEmptyVariants.map(v => {
            const variant = new ProductVariant();
            variant.type      = v.type.trim();
            variant.vals      = v.vals.trim();
            variant.productId = newProduct.id; // ✅ assigné directement sur l'instance
            return variant;
          });
          await qr.manager.save(ProductVariant, variantEntities);
        }
      }

      if (dto.venteEnGros && dto.wholesaleTiers?.length) {
        const tierEntities = dto.wholesaleTiers.map((t, idx) =>
          this.wholesaleTierRepo.create({
            quantiteMin:  t.quantiteMin,
            quantiteMax:  t.quantiteMax  ?? null,
            prixUnitaire: t.prixUnitaire,
            ordre:        t.ordre ?? idx,
            productId:    newProduct.id,
          }),
        );
        await qr.manager.save(ProductWholesaleTier, tierEntities);
      }

      if (dto.stories?.length) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const storyEntities = dto.stories.map(s =>
          this.storyRepo.create({
            productId:  newProduct.id,
            companyId:  companyProfile.id,
            mediaUrl:   s.mediaUrl,
            mediaType:  StoryMediaType.IMAGE,
            caption:    s.caption?.trim() ?? null,
            heureDebut: s.heureDebut ?? null,
            heureFin:   s.heureFin   ?? null,
            jours:      s.jours?.length ? s.jours : null,
            status:     StoryStatus.PUBLISHED,
            expiresAt,
            duration:   5,
          }),
        );
        await qr.manager.save(ProductStory, storyEntities);
      }

      await qr.commitTransaction();

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`[CREATE PRODUCT ❌] Rollback — User=${user.id} | ${(err as Error).message}`);
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(`[CREATE PRODUCT ✅] ID=${newProduct.id} | Nom="${dto.nom}" | Company=${companyProfile.id}`);
    return this.getProduct(newProduct.id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // updateProduct() — inchangé
  // ══════════════════════════════════════════════════════════════════════════

  async updateProduct(productId: string, dto: UpdateProductDto, user: User): Promise<ProductResponse> {
    const product = await this.findAndVerifyOwnership(productId, user);

    if (dto.urlSlug && dto.urlSlug !== product.urlSlug) {
      const normalized = this.normalizeSlug(dto.urlSlug);
      const conflict   = await this.productRepo.findOne({ where: { urlSlug: normalized } });
      if (conflict && conflict.id !== productId) {
        throw new ConflictException(`Le slug "${normalized}" est déjà utilisé.`);
      }
      dto.urlSlug = normalized;
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      Object.assign(product, {
        nom:            dto.nom?.trim()            ?? product.nom,
        description:    dto.description?.trim()    ?? product.description,
        contenuBoite:   dto.contenuBoite?.trim()   ?? product.contenuBoite,
        marque:         dto.marque?.trim()          ?? product.marque,
        tags:           dto.tags?.trim()            ?? product.tags,
        reference:      dto.reference?.trim()       ?? product.reference,
        garantie:       dto.garantie               ?? product.garantie,
        langue:         dto.langue                 ?? product.langue,
        categoryId:     dto.categoryId             ?? product.categoryId,
        subCategoryId:  dto.subCategoryId          ?? product.subCategoryId,
        prix:           dto.prix                   ?? product.prix,
        prixAncien:     dto.prixAncien             ?? product.prixAncien,
        stock:          dto.stock                  ?? product.stock,
        seuil:          dto.seuil                  ?? product.seuil,
        visibilite:     dto.visibilite             ?? product.visibilite,
        condition:      dto.condition              ?? product.condition,
        paysOrigine:    dto.paysOrigine            ?? product.paysOrigine,
        poids:          dto.poids                  ?? product.poids,
        longueur:       dto.longueur               ?? product.longueur,
        largeur:        dto.largeur                ?? product.largeur,
        hauteur:        dto.hauteur                ?? product.hauteur,
        politiqueRetour:        dto.politiqueRetour        ?? product.politiqueRetour,
        livraisonStandard:      dto.livraisonStandard      ?? product.livraisonStandard,
        livraisonLivreur:       dto.livraisonLivreur       ?? product.livraisonLivreur,
        livraisonCorrespondant: dto.livraisonCorrespondant ?? product.livraisonCorrespondant,
        fraisLivraisonLocal:    dto.fraisLivraisonLocal    ?? product.fraisLivraisonLocal,
        delaiLivraison:         dto.delaiLivraison         ?? product.delaiLivraison,
        garantiePaiement:  dto.garantiePaiement  ?? product.garantiePaiement,
        garantieRetour:    dto.garantieRetour     ?? product.garantieRetour,
        garantieAuthentic: dto.garantieAuthentic  ?? product.garantieAuthentic,
        garantieSupport:   dto.garantieSupport    ?? product.garantieSupport,
        titreSeo:       dto.titreSeo?.trim()       ?? product.titreSeo,
        descriptionSeo: dto.descriptionSeo?.trim() ?? product.descriptionSeo,
        urlSlug:        dto.urlSlug               ?? product.urlSlug,
        venteEnGros:          dto.venteEnGros          ?? product.venteEnGros,
        moq:                  dto.moq                  ?? product.moq,
        conditionnement:      dto.conditionnement      ?? product.conditionnement,
        delaiPreparationGros: dto.delaiPreparationGros ?? product.delaiPreparationGros,
      });

      await qr.manager.save(Product, product);

      if (dto.images !== undefined) {
        await qr.manager.delete(ProductMedia, { product: { id: productId } });
        if (dto.images.length) {
          const imgs = dto.images.map((img, idx) =>
            this.imageRepo.create({ ...img, ordre: img.ordre ?? idx, productId }),
          );
          await qr.manager.save(ProductMedia, imgs);
        }
      }

      if (dto.specs !== undefined) {
        await qr.manager.delete(ProductSpec, { product: { id: productId } });
        const nonEmpty = dto.specs.filter(s => s.cle?.trim() && s.valeur?.trim());
        if (nonEmpty.length) {
          const specs = nonEmpty.map((s, idx) =>
            this.specRepo.create({ ...s, ordre: s.ordre ?? idx, product: { id: productId } as Product }),
          );
          await qr.manager.save(ProductSpec, specs);
        }
      }

      if (dto.variantes !== undefined) {
        await qr.manager.delete(ProductVariant, { productId });
        const nonEmpty = dto.variantes.filter(v => v.vals.trim());
        if (nonEmpty.length) {
          const vars = nonEmpty.map(v => this.variantRepo.create({ ...v, productId }));
          await qr.manager.save(ProductVariant, vars);
        }
      }

      if (dto.wholesaleTiers !== undefined) {
        await qr.manager.delete(ProductWholesaleTier, { productId });
        if (dto.venteEnGros !== false && dto.wholesaleTiers.length) {
          const tiers = dto.wholesaleTiers.map((t, idx) =>
            this.wholesaleTierRepo.create({
              quantiteMin:  t.quantiteMin,
              quantiteMax:  t.quantiteMax ?? null,
              prixUnitaire: t.prixUnitaire,
              ordre:        t.ordre ?? idx,
              productId,
            }),
          );
          await qr.manager.save(ProductWholesaleTier, tiers);
        }
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(`[UPDATE PRODUCT ✅] ID=${productId} | Par=${user.id}`);
    return this.getProduct(productId, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Méthodes restantes — inchangées
  // ══════════════════════════════════════════════════════════════════════════

  async publishProduct(productId: string, user: User): Promise<ProductResponse> {
    const product = await this.findAndVerifyOwnership(productId, user);
    if (!product.nom?.trim())
      throw new BadRequestException('Le produit doit avoir un nom avant d\'être publié.');
    if (!product.prix || product.prix <= 0)
      throw new BadRequestException('Le produit doit avoir un prix valide avant d\'être publié.');
    if (!product.media?.length)
      throw new BadRequestException('Le produit doit avoir au moins une image avant d\'être publié.');
    await this.productRepo.update(productId, { visibilite: ProductVisibility.PUBLIC });
    this.logger.log(`[PUBLISH ✅] ID=${productId} | Par=${user.id}`);
    return this.getProduct(productId, user);
  }

  async archiveProduct(productId: string, user: User): Promise<{ message: string }> {
    await this.findAndVerifyOwnership(productId, user);
    await this.productRepo.update(productId, { visibilite: ProductVisibility.PRIVATE });
    this.logger.log(`[ARCHIVE] ID=${productId} | Par=${user.id}`);
    return { message: 'Produit archivé avec succès.' };
  }

  async deleteProduct(productId: string, user: User): Promise<{ message: string }> {
    const product = await this.findAndVerifyOwnership(productId, user);
    await this.productRepo.remove(product);
    this.logger.log(`[DELETE] ID=${productId} | Par=${user.id}`);
    return { message: 'Produit supprimé avec succès.' };
  }

  async getProduct(productId: string, user?: User): Promise<ProductResponse> {
    const product = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',       'images')
      .leftJoinAndSelect('p.specs',       'specs')
      .leftJoinAndSelect('p.variantes',   'variantes')
      .leftJoinAndSelect('p.wholesaleTiers', 'wholesaleTiers')
      .leftJoinAndSelect('p.category',    'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .where('p.id = :id', { id: productId })
      .orderBy('images.ordre', 'ASC')
      .addOrderBy('specs.ordre', 'ASC')
      .addOrderBy('wholesaleTiers.ordre', 'ASC')
      .getOne();

    if (!product) throw new NotFoundException(`Produit introuvable (ID: ${productId}).`);

    if (user && user.role !== UserRole.SUPER_ADMIN) {
      const companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
      if (companyProfile && product.companyId !== companyProfile.id) {
        if (product.visibilite !== ProductVisibility.PUBLIC)
          throw new ForbiddenException('Ce produit n\'est pas accessible.');
      }
    }

    return this.toProductResponse(product);
  }

  async listProducts(dto: FilterProductsDto, user: User): Promise<ProductListResponse> {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',       'images')
      .leftJoinAndSelect('p.category',    'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
      if (companyProfile) {
        qb.andWhere('p.companyId = :companyId', { companyId: companyProfile.id });
      } else {
        return { data: [], total: 0, page, pages: 0 };
      }
    }

    if (dto.visibilite)    qb.andWhere('p.visibilite = :vis',        { vis:      dto.visibilite });
    if (dto.categoryId)    qb.andWhere('p.categoryId = :catId',      { catId:    dto.categoryId });
    if (dto.subCategoryId) qb.andWhere('p.subCategoryId = :subCatId', { subCatId: dto.subCategoryId });
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(p.nom) LIKE :term
          OR LOWER(COALESCE(p.marque, '')) LIKE :term
          OR LOWER(COALESCE(p.tags, '')) LIKE :term
          OR LOWER(COALESCE(p.reference, '')) LIKE :term)`,
        { term },
      );
    }

    const [products, total] = await qb.getManyAndCount();
    return { data: products.map(p => this.toProductResponse(p)), total, page, pages: Math.ceil(total / limit) };
  }

  async getProductStats(productId: string, user: User) {
    const product = await this.findAndVerifyOwnership(productId, user);
    const prix            = product.prix;
    const commissionShopi = Math.round(prix * 0.03);
    const revenuNet       = prix - commissionShopi;
    const enRupture       = product.stock === 0;
    const seuilAtteint    = product.seuil !== null && product.stock <= product.seuil;
    const seoDetails = [
      { label: 'Nom du produit renseigné',     ok: (product.nom?.length ?? 0) > 5 },
      { label: 'Description > 100 caractères', ok: (product.description?.length ?? 0) > 100 },
      { label: 'Titre SEO défini',             ok: !!product.titreSeo?.trim() },
      { label: 'Description SEO définie',      ok: !!product.descriptionSeo?.trim() },
      { label: 'URL Slug personnalisée',        ok: !!product.urlSlug?.trim() },
      { label: 'Tags SEO renseignés',           ok: !!product.tags?.trim() },
      { label: 'Marque définie',               ok: !!product.marque?.trim() },
      { label: 'Au moins 1 image uploadée',    ok: (product.media?.length ?? 0) > 0 },
      { label: 'Prix de vente saisi',          ok: product.prix > 0 },
      { label: 'Référence SKU définie',        ok: !!product.reference?.trim() },
    ];
    const seoScore = Math.round((seoDetails.filter(c => c.ok).length / seoDetails.length) * 100);
    return { prix, commissionShopi, revenuNet, stock: product.stock, seuilAtteint, enRupture, seoScore, seoDetails };
  }

  async checkSlugUnique(slug: string, excludeId?: string): Promise<{ available: boolean; slug: string }> {
    const normalized = this.normalizeSlug(slug);
    const query = this.productRepo.createQueryBuilder('p').where('p.urlSlug = :slug', { slug: normalized });
    if (excludeId) query.andWhere('p.id != :id', { id: excludeId });
    const exists = await query.getExists();
    return { available: !exists, slug: normalized };
  }

  // ── PRIVÉES ───────────────────────────────────────────────────────────────

  private async findAndVerifyOwnership(productId: string, user: User): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['media', 'specs', 'variantes', 'wholesaleTiers', 'category', 'subCategory'],
    });
    if (!product) throw new NotFoundException(`Produit introuvable (ID: ${productId}).`);
    if (user.role === UserRole.SUPER_ADMIN) return product;

    const companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!companyProfile || product.companyId !== companyProfile.id)
      throw new ForbiddenException('Accès refusé');

    return product;
  }

  private async generateUniqueSlug(nom: string): Promise<string> {
    const base = this.normalizeSlug(nom);
    let slug   = base;
    let suffix = 2;
    while (await this.productRepo.findOne({ where: { urlSlug: slug } })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toProductResponse(product: Product): ProductResponse {
    return {
      id:          product.id,
      nom:         product.nom,
      description: product.description,
      prix:        product.prix,
      prixAncien:  product.prixAncien,
      stock:       product.stock,
      seuil:       product.seuil,
      visibilite:  product.visibilite,
      condition:   product.condition,
      garantie:    product.garantie,
      marque:      product.marque,
      tags:        product.tags,
      reference:   product.reference,
      langue:      product.langue,
      paysOrigine: product.paysOrigine,
      poids:       product.poids,
      longueur:    product.longueur,
      largeur:     product.largeur,
      hauteur:     product.hauteur,
      politiqueRetour:        product.politiqueRetour,
      contenuBoite:           product.contenuBoite,
      livraisonStandard:      product.livraisonStandard,
      livraisonLivreur:       product.livraisonLivreur,
      livraisonCorrespondant: product.livraisonCorrespondant,
      fraisLivraisonLocal:    product.fraisLivraisonLocal,
      delaiLivraison:         product.delaiLivraison,
      garantiePaiement:  product.garantiePaiement,
      garantieRetour:    product.garantieRetour,
      garantieAuthentic: product.garantieAuthentic,
      garantieSupport:   product.garantieSupport,
      titreSeo:       product.titreSeo,
      descriptionSeo: product.descriptionSeo,
      urlSlug:        product.urlSlug,
      category: {
        id:    product.category?.id    ?? '',
        nom:   product.category?.nom   ?? '',
        icone: product.category?.icone ?? null,
      },
      subCategory: product.subCategory
        ? { id: product.subCategory.id, nom: product.subCategory.nom }
        : null,
      images: (product.media ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(img => ({ id: img.id, url: img.url, ordre: img.ordre, alt: img.alt })),
      specs: (product.specs ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(s => ({ id: s.id, cle: s.cle, valeur: s.valeur, ordre: s.ordre })),
      variantes: (product.variantes ?? []).map(v => ({ id: v.id, type: v.type, vals: v.vals })),
      venteEnGros:          product.venteEnGros,
      moq:                  product.moq,
      conditionnement:      product.conditionnement,
      delaiPreparationGros: product.delaiPreparationGros,
      wholesaleTiers: (product.wholesaleTiers ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(t => ({ id: t.id, quantiteMin: t.quantiteMin, quantiteMax: t.quantiteMax, prixUnitaire: t.prixUnitaire, ordre: t.ordre })),
      companyId: product.companyId,
      createdAt: product.createdAt?.toISOString() ?? '',
      updatedAt: product.updatedAt?.toISOString() ?? '',
    };
  }
}