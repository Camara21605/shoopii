/* ============================================================
 * FICHIER : src/modules/public/public.service.ts
 * ✅ AJOUT : getSimilaires()
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan, In } from 'typeorm';

import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Company }     from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }    from 'src/database/entities/profiles/livreur-profile.entity';
import { CompanyAvis } from 'src/database/entities/entreprise.table/company-avis.entity';
import { Promotion, PromoStatus } from 'src/database/entities/entreprise.table/promotion.entity';
import { Follow, FollowStatus, TargetActorType } from 'src/database/entities/follow/follow.entity';
import { ProductStory, StoryStatus } from 'src/database/entities/entreprise.table/product-story.entity';

// ── Interfaces de réponse ─────────────────────────────────────

export interface PublicProduitResponse {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  marque:      string | null;
  urlSlug:     string | null;
  stock:       number;
  visibilite:  string;
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
}

/* ✅ NOUVEAU — format retourné par getSimilaires */
export interface SimilaireResponse {
  id:         string;
  nom:        string;
  prix:       number;
  prixAncien: number | null;
  imageUrl:   string | null;
  emoji:      string | null;
  shopNom:    string;
  shopId:     string;
  noteAvg:    number;
  nbAvis:     number;
  badge:      'hot' | 'new' | 'promo' | null;
}

export interface PublicBoutiqueResponse {
  id:            string;
  companyName:   string;
  description:   string | null;
  slogan:        string | null;
  logo:          string | null;
  coverImage:    string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  website:       string | null;
  openTime:      string | null;
  closeTime:     string | null;
  averageRating: number;
  totalOrders:   number;
  totalRatings:  number;
  commune:       string | null;
  ville:         string | null;
  pays:          string;
  adresse:       string | null;
  verified:      boolean;
  domaine:       string | null;
  domaineIcon:   string | null;
  membre:        string;
  totalAbonnes:  number;
  online:        boolean;
}

export interface PublicLivreurResponse {
  id:           string;
  fullName:     string;
  zone:         string | null;
  availability: string;
  phone:        string | null;
}

export interface PublicStoryResponse {
  id:        string;
  productId: string;
  produit:   string;
  prix:      string;
  prixBarre: string | null;
  badge:     'promo' | 'new' | null;
  emoji:     string;
  img:       string;
  caption:   string | null;
  duree:     number;
  createdAt: string;
}

export interface HomeStorySlide {
  productId: string;
  produit:   string;
  prix:      string;
  prixBarre: string | null;
  emoji:     string;
  img:       string;
  badge:     'promo' | 'new' | null;
  tag:       string | null;
  duree:     number;
}

export interface HomeBoutiqueStoryResponse {
  companyId: string;
  shopNom:   string;
  shopLogo:  string | null;
  online:    boolean;
  hasPromo:  boolean;
  slides:    HomeStorySlide[];
}

@Injectable()
export class PublicService {

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(CompanyAvis)
    private readonly avisRepo: Repository<CompanyAvis>,

    @InjectRepository(Promotion)
    private readonly promoRepo: Repository<Promotion>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,

    @InjectRepository(ProductStory)
    private readonly storyRepo: Repository<ProductStory>,
  ) {}

  // ── Produits publics paginés ──────────────────────────────────

  async listProduits(params: {
    page: number; limit: number;
    categoryId?: string; search?: string;
  }): Promise<{ data: PublicProduitResponse[]; total: number; page: number; pages: number }> {

    const { page, limit, categoryId, search } = params;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',       'images')
      .leftJoinAndSelect('p.category',    'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .leftJoinAndSelect('p.company',     'company')
      .where('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (categoryId) qb.andWhere('p.categoryId = :catId', { catId: categoryId });
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(p.nom) LIKE :term OR LOWER(COALESCE(p.marque,'')) LIKE :term OR LOWER(COALESCE(p.tags,'')) LIKE :term)`,
        { term },
      );
    }

    const [products, total] = await qb.getManyAndCount();
    return { data: products.map(p => this.toPublicProduit(p)), total, page, pages: Math.ceil(total / limit) };
  }

  // ── Détail produit ────────────────────────────────────────────

  async getProduit(id: string): Promise<PublicProduitResponse> {
    const product = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',       'images')
      .leftJoinAndSelect('p.category',    'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .leftJoinAndSelect('p.company',     'company')
      .where('p.id = :id', { id })
      .andWhere('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('images.ordre', 'ASC')
      .getOne();

    if (!product) throw new NotFoundException('Produit introuvable ou non publié.');
    return this.toPublicProduit(product);
  }

  // ✅ ── Produits similaires ─────────────────────────────────────

  async getSimilaires(produitId: string, limit = 5): Promise<SimilaireResponse[]> {
    const max = Math.min(limit, 20);

    /* 1. Charger le produit pour avoir sa catégorie */
    const produit = await this.productRepo.findOne({
      where: { id: produitId },
    });
    if (!produit) return [];

    const categoryId = (produit as any).categoryId ?? null;

    /* 2. Produits de la même catégorie, sauf le courant */
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',    'images')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.company',  'company')
      .where('p.id != :id',    { id: produitId })
      .andWhere('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('p.createdAt', 'DESC')
      .take(max);

    if (categoryId) {
      qb.andWhere('p.categoryId = :catId', { catId: categoryId });
    }

    let results = await qb.getMany();

    /* 3. Compléter si pas assez dans la catégorie */
    if (results.length < max) {
      const existingIds = results.map(p => p.id);
      const others = await this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.media',    'images')
        .leftJoinAndSelect('p.category', 'category')
        .leftJoinAndSelect('p.company',  'company')
        .where('p.id != :id',    { id: produitId })
        .andWhere('p.id NOT IN (:...ids)', { ids: [produitId, ...existingIds] })
        .andWhere('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
        .orderBy('p.createdAt', 'DESC')
        .take(max - results.length)
        .getMany();
      results = [...results, ...others];
    }

    /* 4. Mapper */
    return results.map(p => this.toSimilaire(p));
  }

  // ── Détail boutique ───────────────────────────────────────────

  async getBoutique(id: string): Promise<PublicBoutiqueResponse> {
    const [company, totalAbonnes] = await Promise.all([
      this.companyRepo.findOne({
        where: { id },
        relations: ['companyType', 'user'],
      }),
      this.followRepo.count({
        where: {
          targetType:   TargetActorType.COMPANY,
          targetId:     id,
          isSubscribed: true,
          status:       FollowStatus.ACTIVE,
        },
      }),
    ]);
    if (!company) throw new NotFoundException('Boutique introuvable.');
    return this.toPublicBoutique(company, totalAbonnes);
  }

  // ── Produits d'une boutique ───────────────────────────────────

  async getBoutiqueProduits(
    companyId: string,
    params: { page: number; limit: number; categoryId?: string; search?: string },
  ): Promise<{ data: PublicProduitResponse[]; total: number; page: number; pages: number }> {

    const { page, limit, categoryId, search } = params;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',       'images')
      .leftJoinAndSelect('p.category',    'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .leftJoinAndSelect('p.company',     'company')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (categoryId) qb.andWhere('p.categoryId = :catId', { catId: categoryId });
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(p.nom) LIKE :term OR LOWER(COALESCE(p.marque,'')) LIKE :term)`,
        { term },
      );
    }

    const [products, total] = await qb.getManyAndCount();
    return { data: products.map(p => this.toPublicProduit(p)), total, page, pages: Math.ceil(total / limit) };
  }

  // ── Livreurs d'une boutique ───────────────────────────────────

  async getBoutiqueLivreurs(companyId: string): Promise<PublicLivreurResponse[]> {
    const livreurs = await this.deliveryRepo.find({ where: { companyId } });
    return livreurs.map(l => ({
      id:           l.id,
      fullName:     l.fullName,
      zone:         l.zone     ?? null,
      availability: l.availability,
      phone:        l.phone    ?? null,
    }));
  }

  // ── Mappers privés ────────────────────────────────────────────

  private toPublicProduit(p: Product): PublicProduitResponse {
    const company = p.company as Company | undefined;
    return {
      id:          p.id,
      nom:         p.nom,
      description: p.description,
      prix:        p.prix,
      prixAncien:  p.prixAncien,
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
    };
  }

  /* ✅ NOUVEAU mapper similaires */
  private toSimilaire(p: Product): SimilaireResponse {
    const company = p.company as Company | undefined;
    const images  = (p.media ?? []).sort((a, b) => a.ordre - b.ordre);
    const prix     = p.prix;
    const prixAnc  = p.prixAncien;
    const remise   = prixAnc && prixAnc > prix
      ? Math.round((1 - prix / prixAnc) * 100)
      : 0;

    return {
      id:         p.id,
      nom:        p.nom,
      prix,
      prixAncien: prixAnc,
      imageUrl:   images[0]?.url ?? null,
      emoji:      p.category?.icone ?? '📦',
      shopNom:    company?.companyName ?? 'Boutique',
      shopId:     p.companyId,
      noteAvg:    4.5,
      nbAvis:     0,
      badge:      remise >= 20 ? 'promo' : null,
    };
  }

  private toPublicBoutique(c: Company, totalAbonnes = 0): PublicBoutiqueResponse {
    const annee  = new Date(c.createdAt).getFullYear();
    const anneeN = new Date().getFullYear();
    const membre = annee === anneeN
      ? `Membre depuis ${annee}`
      : `Membre depuis ${annee} · ${anneeN - annee} ans`;

    const user      = (c as any).user;
    const threshold = 15 * 60 * 1000;
    const online    = user?.lastLoginAt
      ? (Date.now() - new Date(user.lastLoginAt).getTime()) < threshold
      : false;

    return {
      id:            c.id,
      companyName:   c.companyName,
      description:   c.description,
      slogan:        (c as any).slogan   ?? null,
      logo:          c.logo,
      coverImage:    c.coverImage,
      businessPhone: c.businessPhone,
      businessEmail: c.businessEmail,
      website:       c.website,
      openTime:      c.openTime,
      closeTime:     c.closeTime,
      averageRating: Number(c.averageRating) || 0,
      totalOrders:   c.totalOrders   || 0,
      totalRatings:  c.totalRatings  || 0,
      commune:       (c as any).commune  ?? null,
      ville:         c.ville             ?? 'Conakry',
      pays:          c.pays              ?? 'GN',
      adresse:       c.adresse,
      verified:      c.verificationStatus === 'verified',
      domaine:       (c.companyType as any)?.nom   ?? null,
      domaineIcon:   (c.companyType as any)?.icone ?? null,
      membre,
      totalAbonnes,
      online,
    };
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/boutiques — liste des boutiques actives
   ════════════════════════════════════════════════════════ */
  async listBoutiques(params: {
    page: number; limit: number; search?: string;
  }): Promise<{ data: PublicBoutiqueResponse[]; total: number; page: number }> {
    const { page, limit, search } = params;

    const qb = this.companyRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.companyType', 'companyType')
      .where('c.status = :status', { status: 'active' })
      .orderBy('c.averageRating', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere('c.companyName LIKE :s', { s: `%${search}%` });
    }

    const [rows, total] = await qb.getManyAndCount();

    const data = rows.map(c => {
      const membre = c.createdAt
        ? `Membre depuis ${c.createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
        : 'Membre Shopi';

      return {
        id:            c.id,
        companyName:   c.companyName,
        description:   c.description,
        slogan:        (c as any).slogan   ?? null,
        logo:          c.logo,
        coverImage:    c.coverImage,
        businessPhone: c.businessPhone,
        businessEmail: c.businessEmail,
        website:       c.website,
        openTime:      c.openTime,
        closeTime:     c.closeTime,
        averageRating: Number(c.averageRating) || 0,
        totalOrders:   c.totalOrders  || 0,
        totalRatings:  c.totalRatings || 0,
        commune:       (c as any).commune  ?? null,
        ville:         c.ville             ?? 'Conakry',
        pays:          c.pays              ?? 'GN',
        adresse:       c.adresse,
        verified:      c.verificationStatus === 'verified',
        domaine:       (c.companyType as any)?.nom   ?? null,
        domaineIcon:   (c.companyType as any)?.icone ?? null,
        membre,
        totalAbonnes:  0,
        online:        false,
      } as PublicBoutiqueResponse;
    });

    return { data, total, page };
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/boutiques/:id/avis
   * Retourne la note globale + totalRatings de la boutique.
   * La liste détaillée (avis[]) sera peuplée quand une table
   * dédiée aux avis sera créée côté backend.
   ════════════════════════════════════════════════════════ */
  async getBoutiqueAvis(companyId: string): Promise<{
    averageRating: number;
    totalRatings:  number;
    avis:          { id: string; clientNom: string; clientInitiales: string; note: number; commentaire: string | null; date: string }[];
  }> {
    const company = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['id', 'averageRating', 'totalRatings'],
    });
    if (!company) throw new NotFoundException('Boutique introuvable.');

    /* Charger les vrais avis depuis company_avis (50 max, du plus récent) */
    const rows = await this.avisRepo.find({
      where:  { companyId },
      order:  { createdAt: 'DESC' },
      take:   50,
      select: ['id', 'clientNom', 'clientInitiales', 'note', 'commentaire', 'createdAt'],
    });

    return {
      averageRating: Number(company.averageRating) || 0,
      totalRatings:  company.totalRatings || 0,
      avis: rows.map(a => ({
        id:               a.id,
        clientNom:        a.clientNom,
        clientInitiales:  a.clientInitiales,
        note:             a.note,
        commentaire:      a.commentaire,
        date:             a.createdAt.toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      })),
    };
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/boutiques/:id/promotions
   * Retourne les promotions ACTIVES d'une boutique.
   ════════════════════════════════════════════════════════ */
  async getBoutiquePromotions(companyId: string): Promise<{
    id:              string;
    nom:             string;
    code:            string;
    type:            string;
    valueType:       string;
    valeur:          number | null;
    montantMinimum:  number | null;
    endDate:         string | null;
    usesCount:       number;
    maxUtilisations: number | null;
    flashStock:      number | null;
  }[]> {
    const now    = new Date();
    const promos = await this.promoRepo.find({
      where: { companyId, status: PromoStatus.ACTIVE },
      order: { startDate: 'DESC' },
      take:  20,
      select: [
        'id', 'nom', 'code', 'type', 'valueType', 'valeur',
        'montantMinimum', 'endDate', 'usesCount', 'maxUtilisations', 'flashStock',
      ],
    });

    /* Filtrer celles qui ne sont pas expirées */
    return promos
      .filter(p => !p.endDate || new Date(p.endDate) > now)
      .map(p => ({
        id:             p.id,
        nom:            p.nom,
        code:           p.code,
        type:           p.type,
        valueType:      p.valueType,
        valeur:         p.valeur != null ? Number(p.valeur) : null,
        montantMinimum: p.montantMinimum != null ? Number(p.montantMinimum) : null,
        endDate:        p.endDate
          ? p.endDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
          : null,
        usesCount:       p.usesCount,
        maxUtilisations: p.maxUtilisations,
        flashStock:      p.flashStock,
      }));
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/stories
   * Stories actives de toutes les boutiques — page d'accueil.
   * Groupées par boutique (max 15 boutiques, 4 slides chacune).
   ════════════════════════════════════════════════════════ */
  async getHomeStories(): Promise<HomeBoutiqueStoryResponse[]> {
    const now = new Date();

    /* 1. Toutes les stories publiées non expirées */
    const allStories = await this.storyRepo.find({
      where:     { status: StoryStatus.PUBLISHED, expiresAt: MoreThan(now) },
      relations: ['product', 'product.category'],
      order:     { createdAt: 'DESC' },
      take:      200,
    });

    if (!allStories.length) return [];

    /* 2. Grouper par companyId (ordre d'apparition préservé) */
    const groups = new Map<string, typeof allStories>();
    for (const s of allStories) {
      const arr = groups.get(s.companyId) ?? [];
      arr.push(s);
      groups.set(s.companyId, arr);
    }

    const companyIds = Array.from(groups.keys()).slice(0, 15);

    /* 3. Charger les infos des boutiques en une requête */
    const companies = await this.companyRepo.find({
      where:     { id: In(companyIds) },
      relations: ['user'],
    });
    const companyMap = new Map(companies.map(c => [c.id, c]));

    const threshold = 15 * 60 * 1000;
    const tsNow     = Date.now();

    /* 4. Construire la réponse */
    return companyIds
      .filter(id => companyMap.has(id))
      .map(companyId => {
        const company = companyMap.get(companyId)!;
        const slides  = (groups.get(companyId) ?? []).slice(0, 4);
        const user    = (company as any).user;

        const mappedSlides: HomeStorySlide[] = slides.map(s => {
          const p        = s.product as any;
          const cat      = p?.category;
          const prix     = p?.prix ?? 0;
          const prixAnc  = p?.prixAncien ?? null;
          const hasPromo = prixAnc && Number(prixAnc) > Number(prix);
          return {
            productId: s.productId,
            produit:   p?.nom ?? 'Produit',
            prix:      `${Number(prix).toLocaleString('fr-FR')} GNF`,
            prixBarre: hasPromo ? `${Number(prixAnc).toLocaleString('fr-FR')} GNF` : null,
            emoji:     cat?.icone ?? '📦',
            img:       s.mediaUrl,
            badge:     hasPromo ? 'promo' as const : null,
            tag:       s.caption ?? null,
            duree:     (s.duration ?? 5) * 1000,
          };
        });

        return {
          companyId,
          shopNom:  company.companyName,
          shopLogo: company.logo ?? null,
          online:   user?.lastLoginAt
            ? (tsNow - new Date(user.lastLoginAt).getTime()) < threshold
            : false,
          hasPromo: mappedSlides.some(sl => sl.badge === 'promo'),
          slides:   mappedSlides,
        };
      });
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/boutiques/:id/stories
   * Stories actives (non expirées) d'une boutique,
   * enrichies avec les infos produit.
   ════════════════════════════════════════════════════════ */
  async getBoutiqueStories(companyId: string): Promise<PublicStoryResponse[]> {
    const stories = await this.storyRepo.find({
      where: {
        companyId,
        status:    StoryStatus.PUBLISHED,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['product', 'product.category'],
      order:     { createdAt: 'DESC' },
      take:      20,
    });

    return stories.map(s => {
      const product  = s.product as any;
      const category = product?.category;
      const prix     = product?.prix ?? 0;
      const prixAnc  = product?.prixAncien ?? null;
      const hasPromo = prixAnc && prixAnc > prix;

      return {
        id:        s.id,
        productId: s.productId,
        produit:   product?.nom ?? 'Produit',
        prix:      `${Number(prix).toLocaleString('fr-FR')} GNF`,
        prixBarre: hasPromo ? `${Number(prixAnc).toLocaleString('fr-FR')} GNF` : null,
        badge:     hasPromo ? 'promo' as const : null,
        emoji:     category?.icone ?? '📦',
        img:       s.mediaUrl,
        caption:   s.caption ?? null,
        duree:     (s.duration ?? 5) * 1000,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }
}
