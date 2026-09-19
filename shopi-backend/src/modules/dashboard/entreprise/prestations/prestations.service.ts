/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/prestations/prestations.service.ts
 * RÔLE    : CRUD des prestations de service — miroir structurel de
 *           produits.service.ts, réservé aux entreprises dont
 *           businessModel === SERVICES (voir createService()).
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

import {
  Service, ServicePricingType, ServiceVisibility,
} from 'src/database/entities/entreprise.table/service.entity';
import { ServiceMedia, ServiceMediaType } from 'src/database/entities/entreprise.table/service-media.entity';
import { ServiceSpec }   from 'src/database/entities/entreprise.table/service-spec.entity';
import { Category }      from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory }   from 'src/database/entities/entreprise.table/sub-category.entity';
import { Company, CompanyBusinessModel } from 'src/database/entities/profiles/entreprise-profile.entity';
import { CompanyTypeNature } from 'src/database/entities/entreprise.table/company-type.entity';
import { User }      from 'src/database/entities/user.entity';
import { UserRole }  from 'src/common/enums/user-role.enum';

import {
  CreateServiceDto,
  UpdateServiceDto,
  FilterServicesDto,
} from './dto/create-service.dto';
import {
  getAllowedCategories, assertCategoryAllowed,
} from 'src/common/utils/company-categories.util';

export interface ServiceResponse {
  id:          string;
  nom:         string;
  description: string | null;
  tags:        string | null;
  visibilite:  string;
  langue:      string;
  pricingType: string;
  prix:        number | null;
  prixAncien:  number | null;
  dureeMinMinutes: number | null;
  dureeMaxMinutes: number | null;
  capaciteMax:     number | null;
  surPlaceEntreprise: boolean;
  aDomicile:          boolean;
  aDistance:          boolean;
  zoneCouverture:      string | null;
  fraisDeplacement:    number | null;
  reservationRequise:  boolean;
  delaiReponse:        string;
  politiqueAnnulation: string;
  garantiePaiement:     boolean;
  garantieSatisfaction: boolean;
  titreSeo:       string | null;
  descriptionSeo: string | null;
  urlSlug:        string | null;
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  media: { id: string; url: string; ordre: number; alt: string | null; type: string }[];
  specs: { id: string; cle: string; valeur: string; ordre: number }[];
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  data:  ServiceResponse[];
  total: number;
  page:  number;
  pages: number;
}

export interface CategorieDisponible {
  id:            string;
  nom:           string;
  icone:         string | null;
  subCategories: { id: string; nom: string }[];
}

/** Quota de médias par fiche service : 4 images + 1 vidéo max (5 au total) — même règle que Product. */
const MAX_MEDIA_TOTAL  = 5;
const MAX_MEDIA_IMAGES = 4;
const MAX_MEDIA_VIDEOS = 1;

@Injectable()
export class PrestationsService {

  private readonly logger = new Logger(PrestationsService.name);

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectRepository(ServiceMedia)
    private readonly mediaRepo: Repository<ServiceMedia>,

    @InjectRepository(ServiceSpec)
    private readonly specRepo: Repository<ServiceSpec>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(SubCategory)
    private readonly subCatRepo: Repository<SubCategory>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // getCategoriesPourEntreprise() — GET /prestations/categories
  // Catégories du type de l'entreprise connectée — miroir de
  // ProduitsService.getCategoriesPourEntreprise, nature inversée : exclut
  // 'products', accepte 'services'/'neutral'. Voir SÉCURITÉ ci-dessous.
  // ══════════════════════════════════════════════════════════════════════════

  async getCategoriesPourEntreprise(user: User): Promise<CategorieDisponible[]> {
    const company = await this.resolveCompany(user);

    /* RÈGLE — l'entreprise ne voit que les catégories qu'elle a CHOISIES à
     * l'inscription (company_categories), toutes issues de son type ; repli
     * sur toutes celles de son type tant qu'elle n'a rien choisi. Un compte
     * SERVICES n'obtient jamais de catégorie d'un type 'products'. Voir
     * common/utils/company-categories.util.ts. */
    const cats = await getAllowedCategories(this.categoryRepo.manager, company, CompanyTypeNature.PRODUCTS);
    return cats.map(c => ({
      id:    c.id,
      nom:   c.nom,
      icone: c.icone,
      subCategories: (c.subCategories ?? []).map(s => ({ id: s.id, nom: s.nom })),
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // createService()
  // ══════════════════════════════════════════════════════════════════════════

  async createService(dto: CreateServiceDto, user: User): Promise<ServiceResponse> {
    const company = await this.resolveCompany(user);

    /* Garde exclusive — voir Company.businessModel : un compte "produits"
     * ne peut jamais créer de service, même via un appel API direct qui
     * contournerait la sidebar (qui masque déjà "Ajouter un service"). */
    if (company.businessModel !== CompanyBusinessModel.SERVICES) {
      throw new ForbiddenException(
        "Ce compte est enregistré comme vendeur de produits — la création de prestations de service n'est pas disponible.",
      );
    }

    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId },
      relations: ['companyType'],
    });
    if (!category) throw new NotFoundException(`Catégorie introuvable (ID: ${dto.categoryId}).`);

    let subCategory: SubCategory | null = null;
    if (dto.subCategoryId) {
      subCategory = await this.subCatRepo.findOne({
        where: { id: dto.subCategoryId, category: { id: dto.categoryId } },
      });
      if (!subCategory) {
        throw new NotFoundException(`Sous-catégorie introuvable ou n'appartient pas à la catégorie sélectionnée.`);
      }
    }

    if (
      company.companyTypeId &&
      category.companyTypeId &&
      category.companyTypeId !== company.companyTypeId
    ) {
      throw new BadRequestException(
        `La catégorie "${category.nom}" n'appartient pas au type d'entreprise de votre compte. ` +
        `Veuillez choisir une catégorie correspondant à votre type d'activité.`,
      );
    }

    /* SÉCURITÉ — miroir de ProduitsService.createProduct : une catégorie
     * sans type parent, ou dont le type parent est 'products', ne peut
     * pas servir à publier une prestation de service. */
    if (!category.companyType || category.companyType.nature === CompanyTypeNature.PRODUCTS) {
      throw new BadRequestException(
        `La catégorie "${category.nom}" est réservée aux produits, pas aux prestations de service.`,
      );
    }

    /* RÈGLE — seulement les catégories choisies par l'entreprise. */
    await assertCategoryAllowed(this.categoryRepo.manager, company, category, CompanyTypeNature.PRODUCTS);

    /* Tarification : prix requis sauf "sur devis" (déjà exprimé côté DTO
     * via @ValidateIf, revalidé ici pour couvrir un appel direct hors
     * ValidationPipe et pour forcer prix=null en mode DEVIS). */
    const pricingType = dto.pricingType ?? ServicePricingType.FIXE;
    if (pricingType !== ServicePricingType.DEVIS && !dto.prix) {
      throw new BadRequestException('Le prix est obligatoire sauf en tarification "sur devis".');
    }

    const slug = dto.urlSlug ? this.normalizeSlug(dto.urlSlug) : await this.generateUniqueSlug(dto.nom);
    const slugExists = await this.serviceRepo.findOne({ where: { urlSlug: slug } });
    if (slugExists) throw new ConflictException(`L'URL slug "${slug}" est déjà utilisé par une autre prestation.`);

    this.validateMediaQuota(dto.media);

    let newService: Service;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const entity = new Service();
      Object.assign(entity, {
        nom:            dto.nom.trim(),
        description:    dto.description?.trim() ?? null,
        tags:           dto.tags?.trim()         ?? null,
        categoryId:     category.id,
        subCategoryId:  subCategory?.id ?? null,
        pricingType,
        prix:           pricingType === ServicePricingType.DEVIS ? null : (dto.prix ?? null),
        prixAncien:     dto.prixAncien ?? null,
        dureeMinMinutes: dto.dureeMinMinutes ?? null,
        dureeMaxMinutes: dto.dureeMaxMinutes ?? null,
        capaciteMax:     dto.capaciteMax     ?? null,
        surPlaceEntreprise: dto.surPlaceEntreprise ?? true,
        aDomicile:          dto.aDomicile          ?? false,
        aDistance:          dto.aDistance          ?? false,
        zoneCouverture:      dto.aDomicile ? (dto.zoneCouverture ?? null) : null,
        fraisDeplacement:    dto.aDomicile ? (dto.fraisDeplacement ?? null) : null,
        reservationRequise:  dto.reservationRequise ?? true,
        delaiReponse:        dto.delaiReponse ?? undefined,
        politiqueAnnulation: dto.politiqueAnnulation ?? undefined,
        garantiePaiement:     dto.garantiePaiement     ?? true,
        garantieSatisfaction: dto.garantieSatisfaction ?? true,
        /* Même règle que ProduitsService.createProduct : Company.autoPublish
         * (Paramètres > Catalogue) force le brouillon si désactivé, quel
         * que soit ce que le formulaire a envoyé. */
        visibilite: company.autoPublish === false
          ? ServiceVisibility.DRAFT
          : (dto.visibilite ?? ServiceVisibility.DRAFT),
        langue:         dto.langue ?? 'fr',
        titreSeo:       dto.titreSeo?.trim()       ?? null,
        descriptionSeo: dto.descriptionSeo?.trim() ?? null,
        urlSlug:        slug,
        companyId:      company.id,
      });

      newService = await qr.manager.save(Service, entity);

      if (dto.media?.length) {
        const mediaEntities = dto.media.map((m, idx) =>
          this.mediaRepo.create({
            url:       m.url,
            ordre:     m.ordre ?? idx,
            alt:       m.alt   ?? null,
            type:      m.type === 'video' ? ServiceMediaType.VIDEO : ServiceMediaType.IMAGE,
            serviceId: newService.id,
          }),
        );
        await qr.manager.save(ServiceMedia, mediaEntities);
      }

      if (dto.specs?.length) {
        const nonEmpty = dto.specs.filter(s => s.cle?.trim() && s.valeur?.trim());
        if (nonEmpty.length) {
          const specEntities = nonEmpty.map((s, idx) =>
            this.specRepo.create({
              cle:    s.cle.trim(),
              valeur: s.valeur.trim(),
              ordre:  s.ordre ?? idx,
              service: { id: newService.id } as Service,
            }),
          );
          await qr.manager.save(ServiceSpec, specEntities);
        }
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`[CREATE SERVICE ❌] Rollback — User=${user.id} | ${(err as Error).message}`);
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(`[CREATE SERVICE ✅] ID=${newService.id} | Nom="${dto.nom}" | Company=${company.id}`);
    return this.getService(newService.id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // updateService()
  // ══════════════════════════════════════════════════════════════════════════

  async updateService(serviceId: string, dto: UpdateServiceDto, user: User): Promise<ServiceResponse> {
    const service = await this.findAndVerifyOwnership(serviceId, user);

    if (dto.urlSlug && dto.urlSlug !== service.urlSlug) {
      const normalized = this.normalizeSlug(dto.urlSlug);
      const conflict = await this.serviceRepo.findOne({ where: { urlSlug: normalized } });
      if (conflict && conflict.id !== serviceId) {
        throw new ConflictException(`Le slug "${normalized}" est déjà utilisé.`);
      }
      dto.urlSlug = normalized;
    }

    if (dto.media !== undefined) this.validateMediaQuota(dto.media);

    const pricingType = dto.pricingType ?? service.pricingType;
    if (dto.prix !== undefined || dto.pricingType !== undefined) {
      if (pricingType !== ServicePricingType.DEVIS && !(dto.prix ?? service.prix)) {
        throw new BadRequestException('Le prix est obligatoire sauf en tarification "sur devis".');
      }
    }

    /* SÉCURITÉ — miroir de ProduitsService.updateProduct : le changement
     * de catégorie en modification passe par la même vérification de
     * nature qu'à la création. */
    if (dto.categoryId && dto.categoryId !== service.categoryId) {
      const newCategory = await this.categoryRepo.findOne({
        where: { id: dto.categoryId },
        relations: ['companyType'],
      });
      if (!newCategory) {
        throw new NotFoundException(`Catégorie introuvable (ID: ${dto.categoryId}).`);
      }
      if (!newCategory.companyType || newCategory.companyType.nature === CompanyTypeNature.PRODUCTS) {
        throw new BadRequestException(
          `La catégorie "${newCategory.nom}" est réservée aux produits, pas aux prestations de service.`,
        );
      }
      /* RÈGLE — la nouvelle catégorie doit faire partie de celles choisies
       * par l'entreprise propriétaire de la prestation (SUPER_ADMIN exempté). */
      if (user.role !== UserRole.SUPER_ADMIN) {
        const owner = await this.companyRepo.findOne({ where: { id: service.companyId } });
        if (owner) await assertCategoryAllowed(this.categoryRepo.manager, owner, newCategory, CompanyTypeNature.PRODUCTS);
      }
    }

    /* Une sous-catégorie doit toujours appartenir à la catégorie effective. */
    if (dto.subCategoryId) {
      const effectiveCategoryId = dto.categoryId ?? service.categoryId;
      const sub = await this.subCatRepo.findOne({
        where: { id: dto.subCategoryId, category: { id: effectiveCategoryId } },
      });
      if (!sub) {
        throw new NotFoundException(`Sous-catégorie introuvable ou n'appartient pas à la catégorie sélectionnée.`);
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const aDomicile = dto.aDomicile ?? service.aDomicile;
      Object.assign(service, {
        nom:            dto.nom?.trim()         ?? service.nom,
        description:    dto.description?.trim() ?? service.description,
        tags:           dto.tags?.trim()         ?? service.tags,
        categoryId:     dto.categoryId           ?? service.categoryId,
        subCategoryId:  dto.subCategoryId        ?? service.subCategoryId,
        pricingType,
        prix:           pricingType === ServicePricingType.DEVIS ? null : (dto.prix ?? service.prix),
        prixAncien:     dto.prixAncien           ?? service.prixAncien,
        dureeMinMinutes: dto.dureeMinMinutes     ?? service.dureeMinMinutes,
        dureeMaxMinutes: dto.dureeMaxMinutes     ?? service.dureeMaxMinutes,
        capaciteMax:     dto.capaciteMax         ?? service.capaciteMax,
        surPlaceEntreprise: dto.surPlaceEntreprise ?? service.surPlaceEntreprise,
        aDomicile,
        aDistance:          dto.aDistance          ?? service.aDistance,
        zoneCouverture:      aDomicile ? (dto.zoneCouverture ?? service.zoneCouverture) : null,
        fraisDeplacement:    aDomicile ? (dto.fraisDeplacement ?? service.fraisDeplacement) : null,
        reservationRequise:  dto.reservationRequise  ?? service.reservationRequise,
        delaiReponse:        dto.delaiReponse        ?? service.delaiReponse,
        politiqueAnnulation: dto.politiqueAnnulation ?? service.politiqueAnnulation,
        garantiePaiement:     dto.garantiePaiement     ?? service.garantiePaiement,
        garantieSatisfaction: dto.garantieSatisfaction ?? service.garantieSatisfaction,
        visibilite:     dto.visibilite ?? service.visibilite,
        langue:         dto.langue     ?? service.langue,
        titreSeo:       dto.titreSeo?.trim()       ?? service.titreSeo,
        descriptionSeo: dto.descriptionSeo?.trim() ?? service.descriptionSeo,
        urlSlug:        dto.urlSlug ?? service.urlSlug,
      });

      await qr.manager.save(Service, service);

      if (dto.media !== undefined) {
        await qr.manager.delete(ServiceMedia, { service: { id: serviceId } });
        if (dto.media.length) {
          const media = dto.media.map((m, idx) =>
            this.mediaRepo.create({
              url:   m.url,
              ordre: m.ordre ?? idx,
              alt:   m.alt   ?? null,
              type:  m.type === 'video' ? ServiceMediaType.VIDEO : ServiceMediaType.IMAGE,
              serviceId,
            }),
          );
          await qr.manager.save(ServiceMedia, media);
        }
      }

      if (dto.specs !== undefined) {
        await qr.manager.delete(ServiceSpec, { service: { id: serviceId } });
        const nonEmpty = dto.specs.filter(s => s.cle?.trim() && s.valeur?.trim());
        if (nonEmpty.length) {
          const specs = nonEmpty.map((s, idx) =>
            this.specRepo.create({ ...s, ordre: s.ordre ?? idx, service: { id: serviceId } as Service }),
          );
          await qr.manager.save(ServiceSpec, specs);
        }
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(`[UPDATE SERVICE ✅] ID=${serviceId} | Par=${user.id}`);
    return this.getService(serviceId, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Publication / archivage / suppression
  // ══════════════════════════════════════════════════════════════════════════

  async publishService(serviceId: string, user: User): Promise<ServiceResponse> {
    const service = await this.findAndVerifyOwnership(serviceId, user);
    if (!service.nom?.trim())
      throw new BadRequestException('La prestation doit avoir un nom avant d\'être publiée.');
    if (service.pricingType !== ServicePricingType.DEVIS && !service.prix)
      throw new BadRequestException('La prestation doit avoir un prix valide avant d\'être publiée (ou passer en "sur devis").');
    if (!service.media?.length)
      throw new BadRequestException('La prestation doit avoir au moins une image avant d\'être publiée.');
    await this.serviceRepo.update(serviceId, { visibilite: ServiceVisibility.PUBLIC });
    this.logger.log(`[PUBLISH SERVICE ✅] ID=${serviceId} | Par=${user.id}`);
    return this.getService(serviceId, user);
  }

  async archiveService(serviceId: string, user: User): Promise<{ message: string }> {
    await this.findAndVerifyOwnership(serviceId, user);
    await this.serviceRepo.update(serviceId, { visibilite: ServiceVisibility.PRIVATE });
    this.logger.log(`[ARCHIVE SERVICE] ID=${serviceId} | Par=${user.id}`);
    return { message: 'Prestation archivée avec succès.' };
  }

  async deleteService(serviceId: string, user: User): Promise<{ message: string }> {
    const service = await this.findAndVerifyOwnership(serviceId, user);
    await this.serviceRepo.remove(service);
    this.logger.log(`[DELETE SERVICE] ID=${serviceId} | Par=${user.id}`);
    return { message: 'Prestation supprimée avec succès.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Lecture
  // ══════════════════════════════════════════════════════════════════════════

  async getService(serviceId: string, user?: User): Promise<ServiceResponse> {
    const service = await this.serviceRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.media',       'media')
      .leftJoinAndSelect('s.specs',       'specs')
      .leftJoinAndSelect('s.category',    'category')
      .leftJoinAndSelect('s.subCategory', 'subCategory')
      .where('s.id = :id', { id: serviceId })
      .orderBy('media.ordre', 'ASC')
      .addOrderBy('specs.ordre', 'ASC')
      .getOne();

    if (!service) throw new NotFoundException(`Prestation introuvable (ID: ${serviceId}).`);

    if (user && user.role !== UserRole.SUPER_ADMIN) {
      const actorId = (user as any).actorId as string | undefined;
      let companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
      if (!companyProfile && actorId) companyProfile = await this.companyRepo.findOne({ where: { id: actorId } });
      if (companyProfile && service.companyId !== companyProfile.id) {
        if (service.visibilite !== ServiceVisibility.PUBLIC)
          throw new ForbiddenException('Cette prestation n\'est pas accessible.');
      }
    }

    return this.toServiceResponse(service);
  }

  async listServices(dto: FilterServicesDto, user: User): Promise<ServiceListResponse> {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.serviceRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.media',       'media')
      .leftJoinAndSelect('s.category',    'category')
      .leftJoinAndSelect('s.subCategory', 'subCategory')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (user.role !== UserRole.SUPER_ADMIN) {
      const actorId = (user as any).actorId as string | undefined;
      const companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
      const companyId = companyProfile?.id ?? actorId;
      if (!companyId) return { data: [], total: 0, page, pages: 0 };
      qb.andWhere('s.companyId = :companyId', { companyId });
    }

    if (dto.visibilite)    qb.andWhere('s.visibilite = :vis',        { vis: dto.visibilite });
    if (dto.categoryId)    qb.andWhere('s.categoryId = :catId',      { catId: dto.categoryId });
    if (dto.subCategoryId) qb.andWhere('s.subCategoryId = :subCatId', { subCatId: dto.subCategoryId });
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim().toLowerCase()}%`;
      qb.andWhere(`(LOWER(s.nom) LIKE :term OR LOWER(COALESCE(s.tags, '')) LIKE :term)`, { term });
    }

    const [services, total] = await qb.getManyAndCount();
    return { data: services.map(s => this.toServiceResponse(s)), total, page, pages: Math.ceil(total / limit) };
  }

  async checkSlugUnique(slug: string, excludeId?: string): Promise<{ available: boolean; slug: string }> {
    const normalized = this.normalizeSlug(slug);
    const query = this.serviceRepo.createQueryBuilder('s').where('s.urlSlug = :slug', { slug: normalized });
    if (excludeId) query.andWhere('s.id != :id', { id: excludeId });
    const exists = await query.getExists();
    return { available: !exists, slug: normalized };
  }

  // ── PRIVÉES ───────────────────────────────────────────────────────────────

  private async resolveCompany(user: User): Promise<Company> {
    const actorId = (user as any).actorId as string | undefined;
    let company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company && actorId) company = await this.companyRepo.findOne({ where: { id: actorId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  private async findAndVerifyOwnership(serviceId: string, user: User): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId },
      relations: ['media', 'specs', 'category', 'subCategory'],
    });
    if (!service) throw new NotFoundException(`Prestation introuvable (ID: ${serviceId}).`);
    if (user.role === UserRole.SUPER_ADMIN) return service;

    const actorId = (user as any).actorId as string | undefined;
    const cp = await this.companyRepo.findOne({ where: { userId: user.id } });
    const companyProfile = cp ?? (actorId ? await this.companyRepo.findOne({ where: { id: actorId } }) : null);
    if (!companyProfile || service.companyId !== companyProfile.id)
      throw new ForbiddenException('Accès refusé');

    return service;
  }

  private validateMediaQuota(media: CreateServiceDto['media']): void {
    if (!media?.length) return;
    if (media.length > MAX_MEDIA_TOTAL) {
      throw new BadRequestException(
        `Maximum ${MAX_MEDIA_TOTAL} médias par prestation (${MAX_MEDIA_IMAGES} images + ${MAX_MEDIA_VIDEOS} vidéo).`,
      );
    }
    const videoCount = media.filter(m => m.type === 'video').length;
    const imageCount = media.length - videoCount;
    if (videoCount > MAX_MEDIA_VIDEOS) throw new BadRequestException(`Maximum ${MAX_MEDIA_VIDEOS} vidéo par prestation.`);
    if (imageCount > MAX_MEDIA_IMAGES) throw new BadRequestException(`Maximum ${MAX_MEDIA_IMAGES} images par prestation.`);
  }

  private async generateUniqueSlug(nom: string): Promise<string> {
    const base = this.normalizeSlug(nom);
    let slug   = base;
    let suffix = 2;
    while (await this.serviceRepo.findOne({ where: { urlSlug: slug } })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toServiceResponse(s: Service): ServiceResponse {
    return {
      id:          s.id,
      nom:         s.nom,
      description: s.description,
      tags:        s.tags,
      visibilite:  s.visibilite,
      langue:      s.langue,
      pricingType: s.pricingType,
      prix:        s.prix,
      prixAncien:  s.prixAncien,
      dureeMinMinutes: s.dureeMinMinutes,
      dureeMaxMinutes: s.dureeMaxMinutes,
      capaciteMax:     s.capaciteMax,
      surPlaceEntreprise: s.surPlaceEntreprise,
      aDomicile:          s.aDomicile,
      aDistance:          s.aDistance,
      zoneCouverture:      s.zoneCouverture,
      fraisDeplacement:    s.fraisDeplacement,
      reservationRequise:  s.reservationRequise,
      delaiReponse:        s.delaiReponse,
      politiqueAnnulation: s.politiqueAnnulation,
      garantiePaiement:     s.garantiePaiement,
      garantieSatisfaction: s.garantieSatisfaction,
      titreSeo:       s.titreSeo,
      descriptionSeo: s.descriptionSeo,
      urlSlug:        s.urlSlug,
      category: {
        id:    s.category?.id    ?? '',
        nom:   s.category?.nom   ?? '',
        icone: s.category?.icone ?? null,
      },
      subCategory: s.subCategory ? { id: s.subCategory.id, nom: s.subCategory.nom } : null,
      media: (s.media ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(m => ({ id: m.id, url: m.url, ordre: m.ordre, alt: m.alt, type: m.type })),
      specs: (s.specs ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(sp => ({ id: sp.id, cle: sp.cle, valeur: sp.valeur, ordre: sp.ordre })),
      companyId: s.companyId,
      createdAt: s.createdAt?.toISOString() ?? '',
      updatedAt: s.updatedAt?.toISOString() ?? '',
    };
  }
}
