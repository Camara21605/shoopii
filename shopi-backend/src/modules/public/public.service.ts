/* ============================================================
 * FICHIER : src/modules/public/public.service.ts
 * ✅ AJOUT : getSimilaires()
 * ============================================================ */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan, In } from 'typeorm';

import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Company }     from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery, DeliveryStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent, CorrespondantStatus, VerificationStatus } from 'src/database/entities/profiles/correspondant-profile.entity';
import { JOURS_ORDER } from 'src/database/entities/profiles/correspondant-horaire.entity';
import { CompanyAvis } from 'src/database/entities/entreprise.table/company-avis.entity';
import { Promotion, PromoStatus } from 'src/database/entities/entreprise.table/promotion.entity';
import { Follow, FollowStatus, TargetActorType } from 'src/database/entities/follow/follow.entity';
import { ProductStory, StoryStatus } from 'src/database/entities/entreprise.table/product-story.entity';
import { StoryView }   from 'src/database/entities/entreprise.table/story-view.entity';
import { StoryLike }   from 'src/database/entities/entreprise.table/story-like.entity';
import { Category }    from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory } from 'src/database/entities/entreprise.table/sub-category.entity';
import { User }        from 'src/database/entities/user.entity';
import { NotificationBroadcastService } from 'src/modules/notifications/services/notification-broadcast.service';

// ── Interfaces de réponse ─────────────────────────────────────

export interface WholesaleTierDto {
  quantiteMin:  number;
  quantiteMax:  number | null;
  prixUnitaire: number;
  ordre:        number;
}

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
  images:      { id: string; url: string; ordre: number; alt: string | null; type: string }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
  companyVerified: boolean;
  companyVille:    string | null;
  companyPays:     string;
  /* ── Détail produit (spécifique à getProduit, [] sur les listes) ── */
  condition: string;
  garantie:  string;
  specs:     { id: string; cle: string; valeur: string; ordre: number }[];
  variantes: { id: string; type: string; vals: string }[];
  /* ── Vente en gros ── */
  venteEnGros:    boolean;
  moq:            number | null;
  wholesaleTiers: WholesaleTierDto[];
  /* ── Politique de livraison ── */
  livraisonStandard:      boolean;
  livraisonLivreur:       boolean;
  livraisonCorrespondant: boolean;
  fraisLivraisonLocal:    number | null;
  delaiLivraison:         string;
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
  /** Date de création du compte (ISO) — pour calculer côté client des
   *  dérivés (ex: "X années d'expérience") sans dupliquer la logique de
   *  formatage déjà faite ici pour `membre`. */
  createdAt:     string;
  totalAbonnes:  number;
  online:        boolean;
}

export interface PublicLivreurResponse {
  id:           string;
  fullName:     string;
  zone:         string | null;
  availability: string;
  phone:        string | null;
  emoji:        string;
  note:         number;
  trips:        number;
}

/*
 * Champs volontairement absents par rapport à l'ancien CORRESPONDANTS_MOCK
 * du frontend (tarif, colis/mois, taux de succès, disponible/complet) :
 * aucune colonne ni table ne les stocke réellement côté backend (pas de
 * table "colis"/"package" dans ce projet à ce jour, pas de champ tarif sur
 * Correspondent). Les inventer aurait recréé le problème qu'on corrige —
 * de la donnée fictive présentée comme réelle. `verified` et `missions`
 * remplacent la distinction disponible/complet dans le résumé de l'onglet,
 * ce sont eux qui ont un vrai sens ici.
 */
export interface PublicCorrespondantResponse {
  id:                string;
  fullName:          string;
  ville:             string | null;
  quartier:          string | null;
  note:              number;
  missions:          number;
  verified:          boolean;
  langues:           string[];
  bio:               string | null;
  phone:             string | null;
  /** Horaires du jour courant — null si fermé aujourd'hui ou horaires non renseignés. */
  horaireAujourdhui: string | null;
}

export interface HomeStorySlide {
  id:        string;
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

/**
 * Une entrée = UN produit (jamais plusieurs produits mélangés).
 * `images` regroupe uniquement les stories actives de CE produit.
 */
export interface HomeProductStoryResponse {
  productId: string;
  produit:   string;
  companyId: string;
  shopNom:   string;
  shopLogo:  string | null;
  online:    boolean;
  hasPromo:  boolean;
  images:    HomeStorySlide[];
}

export interface StoryViewerResponse {
  id:       string;
  name:     string;
  avatar:   string | null;
  viewedAt: string;
  /** A laissé un ❤️ sur cette story — comme les réactions WhatsApp Status. */
  liked:    boolean;
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

    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(CompanyAvis)
    private readonly avisRepo: Repository<CompanyAvis>,

    @InjectRepository(Promotion)
    private readonly promoRepo: Repository<Promotion>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,

    @InjectRepository(ProductStory)
    private readonly storyRepo: Repository<ProductStory>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(SubCategory)
    private readonly subCategoryRepo: Repository<SubCategory>,

    @InjectRepository(StoryView)
    private readonly storyViewRepo: Repository<StoryView>,

    @InjectRepository(StoryLike)
    private readonly storyLikeRepo: Repository<StoryLike>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly broadcast: NotificationBroadcastService,
  ) {}

  // ── Produits publics paginés ──────────────────────────────────

  async listProduits(params: {
    page: number; limit: number;
    categoryId?: string; search?: string;
    type?: string;
  }): Promise<{ data: PublicProduitResponse[]; total: number; page: number; pages: number }> {

    const { page, limit, categoryId, search, type } = params;

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

    /* Filtre par type : 'gros' → venteEnGros=true, 'detail' → venteEnGros=false */
    if (type === 'gros')   qb.andWhere('p.venteEnGros = :vg', { vg: true });
    if (type === 'detail') qb.andWhere('p.venteEnGros = :vg', { vg: false });

    if (categoryId) qb.andWhere('p.categoryId = :catId', { catId: categoryId });
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(p.nom) LIKE :term OR LOWER(COALESCE(p.marque,'')) LIKE :term OR LOWER(COALESCE(p.tags,'')) LIKE :term)`,
        { term },
      );
    }

    const [products, total] = await qb.getManyAndCount();
    const data = await Promise.all(products.map(p => this.toPublicProduit(p)));
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Détail produit ────────────────────────────────────────────

  async getProduit(id: string): Promise<PublicProduitResponse> {
    const product = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media',          'images')
      .leftJoinAndSelect('p.category',       'category')
      .leftJoinAndSelect('p.subCategory',    'subCategory')
      .leftJoinAndSelect('p.company',        'company')
      .leftJoinAndSelect('p.wholesaleTiers', 'tiers')
      .leftJoinAndSelect('p.specs',          'specs')
      .leftJoinAndSelect('p.variantes',      'variantes')
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
    return Promise.all(results.map(p => this.toSimilaire(p)));
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
      .leftJoinAndSelect('p.media',          'images')
      .leftJoinAndSelect('p.category',       'category')
      .leftJoinAndSelect('p.subCategory',    'subCategory')
      .leftJoinAndSelect('p.company',        'company')
      .leftJoinAndSelect('p.wholesaleTiers', 'tiers')
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
    const data = await Promise.all(products.map(p => this.toPublicProduit(p)));
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Livreurs d'une boutique ───────────────────────────────────

  async getBoutiqueLivreurs(companyId: string): Promise<PublicLivreurResponse[]> {
    /* status: ACTIVE uniquement — un livreur pending/suspended/banned ne
     * doit jamais apparaître publiquement sur la fiche boutique, même
     * s'il est encore rattaché via companyId. */
    const livreurs = await this.deliveryRepo.find({
      where: { companyId, status: DeliveryStatus.ACTIVE },
    });
    return livreurs.map(l => ({
      id:           l.id,
      fullName:     l.fullName,
      zone:         l.zone     ?? null,
      availability: l.availability,
      phone:        l.phone    ?? null,
      emoji:        l.deliveryEmoji || '🛵',
      note:         Number(l.averageRating) || 0,
      trips:        l.totalDeliveries ?? 0,
    }));
  }

  // ── Correspondants d'une boutique ──────────────────────────────

  async getBoutiqueCorrespondants(companyId: string): Promise<PublicCorrespondantResponse[]> {
    /* status: ACTIVE uniquement — même règle que les livreurs : un
     * correspondant pending/suspended/disabled/deleted ne doit jamais
     * apparaître publiquement, même s'il est encore rattaché via companyId. */
    const correspondants = await this.correspondantRepo.find({
      where:     { companyId, status: CorrespondantStatus.ACTIVE },
      relations: ['horaires'],
    });

    /* Date.getDay() : 0=dimanche..6=samedi → JourSemaine (JOURS_ORDER commence
     * au lundi) : décalage de 1 jour, dimanche revient en dernière position. */
    const todayIdx = new Date().getDay();
    const today    = JOURS_ORDER[(todayIdx + 6) % 7];

    return correspondants.map(c => {
      const horaireDuJour = (c.horaires ?? []).find(h => h.jour === today);
      const horaireAujourdhui = horaireDuJour?.actif
        ? `${horaireDuJour.ouverture} – ${horaireDuJour.fermeture}`
        : null;

      return {
        id:                c.id,
        fullName:          c.fullName,
        ville:             c.depotVille   ?? null,
        quartier:          c.depotCommune ?? null,
        note:              Number(c.averageRating) || 0,
        missions:          c.totalMissions ?? 0,
        verified:          c.verificationStatus === VerificationStatus.VERIFIED,
        langues:           (c.langues ?? '').split(',').map(l => l.trim()).filter(Boolean),
        bio:               c.bio ?? null,
        phone:             c.depotPhone ?? null,
        horaireAujourdhui,
      };
    });
  }

  // ── Mappers privés ────────────────────────────────────────────

  /**
   * Résout le prix EFFECTIVEMENT affiché d'un produit.
   *
   * Product.prixPromo/activePromoId sont synchronisés en temps réel par
   * PromotionsService.syncCompanyProductPromoPrices() dès qu'une promotion
   * (scope=PRODUCTS ciblant ce produit, ou scope=GLOBAL sur toute
   * l'entreprise) est activée. Quand une promo est active, elle prime sur
   * le prixAncien saisi manuellement par la boutique — évite d'afficher un
   * double rabais incohérent (prix barré manuel + promo par-dessus).
   */
  private effectivePrix(p: Product): { prix: number; prixAncien: number | null } {
    const hasPromo = p.prixPromo != null && Number(p.prixPromo) < Number(p.prix);
    return hasPromo
      ? { prix: Number(p.prixPromo), prixAncien: Number(p.prix) }
      : { prix: Number(p.prix), prixAncien: p.prixAncien != null ? Number(p.prixAncien) : null };
  }

  private async toPublicProduit(p: Product): Promise<PublicProduitResponse> {
    // p.company est une relation lazy (Promise<Company>) — même déjà
    // chargée via leftJoinAndSelect, il faut l'attendre explicitement,
    // sinon on récupère l'objet Promise au lieu de l'entité (bug constaté :
    // companyName/logo/verified/ville toujours vides sur les produits publics).
    const company = await p.company;
    const { prix, prixAncien } = this.effectivePrix(p);
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
      companyVerified: company?.verificationStatus === 'verified',
      companyVille:    company?.ville ?? null,
      companyPays:     company?.pays  ?? 'GN',
      condition: p.condition ?? 'neuf',
      garantie:  p.garantie  ?? '',
      specs: (p.specs ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(s => ({ id: s.id, cle: s.cle, valeur: s.valeur, ordre: s.ordre })),
      variantes: (p.variantes ?? [])
        .map(v => ({ id: v.id, type: v.type, vals: v.vals })),
      /* Politique de livraison — telle que configurée par la boutique */
      livraisonStandard:      p.livraisonStandard      ?? true,
      livraisonLivreur:       p.livraisonLivreur        ?? true,
      livraisonCorrespondant: p.livraisonCorrespondant  ?? false,
      venteEnGros:    p.venteEnGros ?? false,
      moq:            p.moq         ?? null,
      wholesaleTiers: (p.wholesaleTiers ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(t => ({
          quantiteMin:  t.quantiteMin,
          quantiteMax:  t.quantiteMax ?? null,
          prixUnitaire: Number(t.prixUnitaire),
          ordre:        t.ordre,
        })),
      fraisLivraisonLocal:    p.fraisLivraisonLocal     ?? null,
      delaiLivraison:         p.delaiLivraison          ?? '1-3 jours',
    };
  }

  /* ✅ NOUVEAU mapper similaires */
  private async toSimilaire(p: Product): Promise<SimilaireResponse> {
    const company = await p.company;
    const images  = (p.media ?? []).sort((a, b) => a.ordre - b.ordre);
    const { prix, prixAncien: prixAnc } = this.effectivePrix(p);
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
      createdAt:     new Date(c.createdAt).toISOString(),
      totalAbonnes,
      online,
    };
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/boutiques — liste des boutiques actives
   ════════════════════════════════════════════════════════ */
  async listBoutiques(params: {
    page: number; limit: number; search?: string;
    categoryId?: string; subCategoryId?: string; companyTypeId?: string;
  }): Promise<{ data: PublicBoutiqueResponse[]; total: number; page: number }> {
    const { page, limit, search, categoryId, subCategoryId, companyTypeId } = params;

    if (categoryId && !(await this.categoryRepo.existsBy({ id: categoryId }))) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    if (subCategoryId && !(await this.subCategoryRepo.existsBy({ id: subCategoryId }))) {
      throw new NotFoundException('Sous-catégorie introuvable.');
    }

    const qb = this.companyRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.companyType', 'companyType')
      .where('c.status = :status', { status: 'active' })
      .orderBy('c.averageRating', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere('LOWER(c.companyName) LIKE LOWER(:s)', { s: `%${search}%` });
    }

    if (companyTypeId) {
      qb.andWhere('c.companyTypeId = :companyTypeId', { companyTypeId });
    }

    /* Sous-requêtes EXISTS/IN plutôt que des JOIN : évite les doublons
     * d'entreprise sans recourir à SELECT DISTINCT, qui échoue ici car
     * Company a des colonnes `json` (notifSettings, tags...) sans opérateur
     * d'égalité pour Postgres.
     *
     * Catégorie ET sous-catégorie sont dérivées du catalogue réel (produits
     * publiés de l'entreprise) plutôt que de la relation Company↔Category
     * (`company_categories`) : cette relation M2M existe dans le schéma mais
     * n'est alimentée par AUCUN endroit du code (ni dashboard entreprise, ni
     * super-admin) — filtrer dessus renvoyait toujours 0 résultat même pour
     * des entreprises actives avec un vrai catalogue. */
    if (categoryId) {
      qb.andWhere(
        'c.id IN (SELECT "companyId" FROM products WHERE "categoryId" = :categoryId AND "visibilite" = :vis)',
        { categoryId, vis: ProductVisibility.PUBLIC },
      );
    }

    if (subCategoryId) {
      qb.andWhere(
        'c.id IN (SELECT "companyId" FROM products WHERE "subCategoryId" = :subCategoryId AND "visibilite" = :vis)',
        { subCategoryId, vis: ProductVisibility.PUBLIC },
      );
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
   * GET /public/stories                      (page d'accueil, toutes boutiques)
   * GET /public/boutiques/:id/stories         (page boutique, UNE SEULE — passer companyId)
   *
   * Même carte, même viewer partout (HomeStoriesStrip côté frontend) :
   * la page boutique n'a pas sa propre implémentation, elle réutilise
   * celle-ci filtrée sur son companyId.
   *
   * Une entrée de la réponse = UN PRODUIT, jamais plusieurs produits
   * mélangés dans le même groupe — même quand ils appartiennent à la
   * même boutique. Chaque produit garde TOUTES ses images actives.
   *
   * Plafonds — seulement quand companyId n'est PAS fourni (flux partagé
   * entre boutiques, page d'accueil) : 15 boutiques max, 4 produits max
   * par boutique (une boutique qui publie 4 stories d'un coup sur un
   * même produit ne doit pas manger tout le quota au détriment d'un
   * autre produit storié la veille). Filtré sur UNE boutique (sa propre
   * page dédiée), aucun des deux plafonds ne s'applique : il n'y a
   * qu'une boutique, et rien à limiter face aux autres.
   ════════════════════════════════════════════════════════ */
  async getHomeStories(companyId?: string): Promise<HomeProductStoryResponse[]> {
    const now = new Date();

    /* 1. Toutes les stories publiées non expirées (d'une seule boutique
     *    si companyId est fourni). */
    const allStories = await this.storyRepo.find({
      where: {
        ...(companyId ? { companyId } : {}),
        status:    StoryStatus.PUBLISHED,
        expiresAt: MoreThan(now),
      },
      relations: ['product', 'product.category'],
      order:     { createdAt: 'DESC' },
      take:      companyId ? 100 : 200,
    });

    if (!allStories.length) return [];

    /* 2. Grouper par companyId, puis par productId à l'intérieur —
     *    l'ordre d'insertion préserve le tri par récence (allStories
     *    est déjà trié DESC). */
    const byCompany = new Map<string, typeof allStories>();
    for (const s of allStories) {
      const arr = byCompany.get(s.companyId) ?? [];
      arr.push(s);
      byCompany.set(s.companyId, arr);
    }

    const companyIds = companyId ? [companyId] : Array.from(byCompany.keys()).slice(0, 15);
    const maxProductsPerCompany = companyId ? Infinity : 4;

    /* 3. Charger les infos des boutiques en une requête */
    const companies = await this.companyRepo.find({
      where:     { id: In(companyIds) },
      relations: ['user'],
    });
    const companyMap = new Map(companies.map(c => [c.id, c]));

    const threshold = 15 * 60 * 1000;
    const tsNow     = Date.now();

    /* 4. Construire la réponse : une entrée par produit */
    const result: HomeProductStoryResponse[] = [];

    for (const cid of companyIds) {
      const company = companyMap.get(cid);
      if (!company) continue;
      const user = (company as any).user;
      const online = user?.lastLoginAt
        ? (tsNow - new Date(user.lastLoginAt).getTime()) < threshold
        : false;

      const byProduct = new Map<string, typeof allStories>();
      for (const s of byCompany.get(cid) ?? []) {
        const arr = byProduct.get(s.productId) ?? [];
        arr.push(s);
        byProduct.set(s.productId, arr);
      }

      const topProductIds = Array.from(byProduct.keys()).slice(0, maxProductsPerCompany);

      for (const productId of topProductIds) {
        const productStories = byProduct.get(productId)!;

        const images: HomeStorySlide[] = productStories.map(s => {
          const p        = s.product;
          const cat      = p?.category;
          const { prix, prixAncien: prixAnc } = p ? this.effectivePrix(p) : { prix: 0, prixAncien: null };
          const hasPromo = prixAnc != null && Number(prixAnc) > Number(prix);
          return {
            id:        s.id,
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

        result.push({
          productId,
          produit:   images[0]?.produit ?? 'Produit',
          companyId: cid,
          shopNom:   company.companyName,
          shopLogo:  company.logo ?? null,
          online,
          hasPromo:  images.some(img => img.badge === 'promo'),
          images,
        });
      }
    }

    return result;
  }

  /* ════════════════════════════════════════════════════════
   * POST /public/stories/:id/view
   * Enregistre qu'un utilisateur connecté a vu cette story.
   * Visiteur anonyme (pas de token) → no-op silencieux.
   ════════════════════════════════════════════════════════ */
  async recordStoryView(storyId: string, viewerId?: string): Promise<void> {
    if (!viewerId) return;

    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) return;

    const existing = await this.storyViewRepo.findOne({ where: { storyId, viewerId } });
    if (existing) {
      await this.storyViewRepo.save(existing); // @UpdateDateColumn rafraîchit viewedAt
      return;
    }

    await this.storyViewRepo.save(this.storyViewRepo.create({ storyId, viewerId }));
    // viewsCount ne compte que les vues uniques — une seule incrémentation par viewer
    await this.storyRepo.increment({ id: storyId }, 'viewsCount', 1);
    const viewsCount = story.viewsCount + 1;

    // Pousse le nouveau compteur en direct au dashboard de l'entreprise
    // propriétaire (si elle est connectée) — compteur instantané, pas de refresh.
    const company = await this.companyRepo.findOne({ where: { id: story.companyId } });
    if (company) {
      this.broadcast.emitToUser(company.userId, 'story:viewed', {
        storyId,
        productId: story.productId,
        viewsCount,
      });
    }
  }

  /* ════════════════════════════════════════════════════════
   * POST /public/stories/:id/like
   * Bascule le ❤️ d'un client sur cette story — connexion requise
   * (le "j'aime" doit être attribuable à quelqu'un pour que
   * l'entreprise puisse voir qui a réagi, comme WhatsApp Status).
   ════════════════════════════════════════════════════════ */
  async toggleStoryLike(storyId: string, likerId?: string): Promise<{ liked: boolean; likesCount: number }> {
    if (!likerId) throw new ForbiddenException('Connexion requise.');

    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story introuvable.');

    const existing = await this.storyLikeRepo.findOne({ where: { storyId, likerId } });
    let liked: boolean;
    if (existing) {
      await this.storyLikeRepo.remove(existing);
      liked = false;
    } else {
      await this.storyLikeRepo.save(this.storyLikeRepo.create({ storyId, likerId }));
      liked = true;
    }

    const likesCount = await this.storyLikeRepo.count({ where: { storyId } });
    return { liked, likesCount };
  }

  /* ════════════════════════════════════════════════════════
   * GET /public/stories/:id/viewers
   * Liste des clients ayant vu cette story, avec leur éventuel ❤️
   * — réservé au propriétaire de la boutique qui l'a publiée
   * (même liste que "qui a vu", comme sur un statut WhatsApp où
   * la réaction apparaît directement dans la liste des vues).
   ════════════════════════════════════════════════════════ */
  async getStoryViewers(storyId: string, requesterUserId?: string): Promise<StoryViewerResponse[]> {
    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException("Story introuvable.");

    if (!requesterUserId) {
      throw new ForbiddenException('Connexion requise.');
    }
    const company = await this.companyRepo.findOne({ where: { id: story.companyId } });
    if (!company || company.userId !== requesterUserId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à voir les vues de cette story.");
    }

    const views = await this.storyViewRepo.find({
      where: { storyId },
      order:  { viewedAt: 'DESC' },
    });
    if (!views.length) return [];

    const likes    = await this.storyLikeRepo.find({ where: { storyId } });
    const likedSet = new Set(likes.map(l => l.likerId));

    const users   = await this.userRepo.find({ where: { id: In(views.map(v => v.viewerId)) } });
    const userMap = new Map(users.map(u => [u.id, u]));

    return views
      .filter(v => userMap.has(v.viewerId))
      .map(v => {
        const u = userMap.get(v.viewerId)!;
        return {
          id:       u.id,
          name:     `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Utilisateur',
          avatar:   u.profilePicture ?? null,
          viewedAt: v.viewedAt.toISOString(),
          liked:    likedSet.has(v.viewerId),
        };
      });
  }
}
