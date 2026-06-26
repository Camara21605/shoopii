/* ============================================================
 * FICHIER : src/modules/catalogue/categories.service.ts
 *
 * RÔLE    : Gestion CRUD des catégories et sous-catégories.
 *
 * CHANGEMENTS vs version précédente :
 *   - Champs ajoutés : slug, description, companyTypeId, actif
 *   - CreateCategoryDto : slug obligatoire, companyTypeId optionnel
 *   - UpdateCategoryDto : slug, description, companyTypeId, actif
 *   - CreateSubCategoryDto : slug obligatoire, icone, description
 *   - Les réponses incluent slug, description, companyTypeId, actif
 *   - CategoryResponse aligne les champs avec le nouveau SettingsSection
 *
 * MÉTHODES CATÉGORIES :
 *  1. findAll()               → GET  /categories
 *  2. findAllByType()         → GET  /company-types/:typeId/categories  (nouveau)
 *  3. findOne()               → GET  /categories/:id
 *  4. create()                → POST /categories
 *  5. update()                → PATCH /categories/:id
 *  6. remove()                → DELETE /categories/:id
 *
 * MÉTHODES SOUS-CATÉGORIES :
 *  7. findSubCatsByCategory() → GET  /categories/:id/sub-categories
 *  8. createSubCategory()     → POST /sub-categories
 *  9. updateSubCategory()     → PATCH /sub-categories/:id
 * 10. removeSubCategory()     → DELETE /sub-categories/:id
 *
 * PLACEMENT :
 *   src/modules/catalogue/categories.service.ts
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Category }    from '../../../../database/entities/entreprise.table/category.entity';
import { SubCategory } from '../../../../database/entities/entreprise.table/sub-category.entity';
import { CompanyType } from '../../../../database/entities/entreprise.table/company-type.entity';

// ─────────────────────────────────────────────────────────────
// DTOs INTERNES
// ─────────────────────────────────────────────────────────────

export interface CreateCategoryDto {
  nom:            string;
  slug:           string;
  icone?:         string;
  couleur?:       string;
  description?:   string;
  ordre?:         number;
  companyTypeId?: string;
}

export interface UpdateCategoryDto {
  nom?:           string;
  slug?:          string;
  icone?:         string;
  couleur?:       string;
  description?:   string;
  ordre?:         number;
  companyTypeId?: string | null;
  actif?:         boolean;
}

export interface CreateSubCategoryDto {
  nom:          string;
  slug:         string;
  categoryId:   string;
  icone?:       string;
  description?: string;
  ordre?:       number;
}

export interface UpdateSubCategoryDto {
  nom?:         string;
  slug?:        string;
  categoryId?:  string;
  icone?:       string;
  description?: string;
  ordre?:       number;
  actif?:       boolean;
}

// ─────────────────────────────────────────────────────────────
// INTERFACES DE RÉPONSE
// Alignées sur SettingsSection.tsx (TypeLocal, CatLocal, SubLocal)
// ─────────────────────────────────────────────────────────────

export interface CategoryResponse {
  id:             string;
  nom:            string;
  slug:           string;
  icone:          string | null;
  couleur:        string | null;
  description:    string | null;
  ordre:          number;
  actif:          boolean;
  companyTypeId:  string | null;
  /** Champ attendu par SettingsSection (subs) et AjouterPage (subCategories) */
  subCategories:  SubCategoryResponse[];
  createdAt:      string;
}

export interface SubCategoryResponse {
  id:           string;
  nom:          string;
  slug:         string;
  icone:        string | null;
  description:  string | null;
  ordre:        number;
  actif:        boolean;
  categoryId:   string;
  createdAt:    string;
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

@Injectable()
export class CategoriesService {

  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly catRepo: Repository<Category>,

    @InjectRepository(SubCategory)
    private readonly subRepo: Repository<SubCategory>,

    @InjectRepository(CompanyType)
    private readonly typeRepo: Repository<CompanyType>,
  ) {}

  // ════════════════════════════════════════════════════════════
  // 1. LISTER TOUTES LES CATÉGORIES
  //    GET /categories
  // ════════════════════════════════════════════════════════════

  async findAll(): Promise<CategoryResponse[]> {
    const cats = await this.catRepo.find({
      relations: ['subCategories', 'companyType'],
      order:     { ordre: 'ASC', nom: 'ASC' },
    });
    return cats.map(c => this.toCategoryResponse(c));
  }

  // ════════════════════════════════════════════════════════════
  // 2. LISTER LES CATÉGORIES D'UN TYPE
  //    GET /company-types/:typeId/categories
  //    Utilisé par SettingsSection : panneau milieu
  // ════════════════════════════════════════════════════════════

  async findAllByType(typeId: string): Promise<CategoryResponse[]> {
    const type = await this.typeRepo.findOne({ where: { id: typeId } });
    if (!type) throw new NotFoundException(`Type introuvable (ID: ${typeId}).`);

    const cats = await this.catRepo.find({
      where:     { companyTypeId: typeId },
      relations: ['subCategories'],
      order:     { ordre: 'ASC', nom: 'ASC' },
    });
    return cats.map(c => this.toCategoryResponse(c));
  }

  // ════════════════════════════════════════════════════════════
  // 3. RÉCUPÉRER UNE CATÉGORIE PAR ID
  //    GET /categories/:id
  // ════════════════════════════════════════════════════════════

  async findOne(id: string): Promise<CategoryResponse> {
    const cat = await this.catRepo.findOne({
      where:     { id },
      relations: ['subCategories', 'companyType'],
    });
    if (!cat) throw new NotFoundException(`Catégorie introuvable (ID: ${id}).`);
    return this.toCategoryResponse(cat);
  }

  // ════════════════════════════════════════════════════════════
  // 4. CRÉER UNE CATÉGORIE
  //    POST /categories
  // ════════════════════════════════════════════════════════════

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    if (!dto.nom?.trim())  throw new BadRequestException('Le nom est obligatoire.');
    if (!dto.slug?.trim()) throw new BadRequestException('Le slug est obligatoire.');

    const slug = this.normalizeSlug(dto.slug);

    // Unicité nom
    const nomExist = await this.catRepo.findOne({ where: { nom: dto.nom.trim() } });
    if (nomExist) throw new ConflictException(`Catégorie "${dto.nom.trim()}" déjà existante.`);

    // Unicité slug
    const slugExist = await this.catRepo.findOne({ where: { slug } });
    if (slugExist) throw new ConflictException(`Slug "${slug}" déjà utilisé.`);

    // Vérification du type si fourni
    if (dto.companyTypeId) {
      const type = await this.typeRepo.findOne({ where: { id: dto.companyTypeId } });
      if (!type) throw new NotFoundException(`Type introuvable (ID: ${dto.companyTypeId}).`);
    }

    const ordre = dto.ordre ?? ((await this.catRepo.count()) + 1);

    const cat = this.catRepo.create({
      nom:           dto.nom.trim(),
      slug,
      icone:         dto.icone?.trim()       || null,
      couleur:       dto.couleur?.trim()     || null,
      description:   dto.description?.trim() || null,
      ordre,
      actif:         true,
      companyTypeId: dto.companyTypeId       || null,
    });

    const saved = await this.catRepo.save(cat);
    this.logger.log(`[CREATE CAT ✅] ID=${saved.id} | slug="${slug}" | nom="${saved.nom}"`);
    return this.findOne(saved.id);
  }

  // ════════════════════════════════════════════════════════════
  // 5. MODIFIER UNE CATÉGORIE
  //    PATCH /categories/:id
  // ════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Catégorie introuvable (ID: ${id}).`);

    if (dto.nom !== undefined) {
      const conflit = await this.catRepo.findOne({ where: { nom: dto.nom.trim() } });
      if (conflit && conflit.id !== id)
        throw new ConflictException(`Catégorie "${dto.nom.trim()}" déjà existante.`);
      cat.nom = dto.nom.trim();
    }
    if (dto.slug !== undefined) {
      const slug = this.normalizeSlug(dto.slug);
      const conflit = await this.catRepo.findOne({ where: { slug } });
      if (conflit && conflit.id !== id)
        throw new ConflictException(`Slug "${slug}" déjà utilisé.`);
      cat.slug = slug;
    }
    if (dto.icone       !== undefined) cat.icone       = dto.icone?.trim()       || null;
    if (dto.couleur     !== undefined) cat.couleur     = dto.couleur?.trim()     || null;
    if (dto.description !== undefined) cat.description = dto.description?.trim() || null;
    if (dto.ordre       !== undefined) cat.ordre       = dto.ordre;
    if (dto.actif       !== undefined) cat.actif       = dto.actif;

    if (dto.companyTypeId !== undefined) {
      if (dto.companyTypeId === null) {
        cat.companyTypeId = null;
      } else {
        const type = await this.typeRepo.findOne({ where: { id: dto.companyTypeId } });
        if (!type) throw new NotFoundException(`Type introuvable (ID: ${dto.companyTypeId}).`);
        cat.companyTypeId = dto.companyTypeId;
      }
    }

    await this.catRepo.save(cat);
    this.logger.log(`[UPDATE CAT ✅] ID=${id}`);
    return this.findOne(id);
  }

  // ════════════════════════════════════════════════════════════
  // 6. SUPPRIMER UNE CATÉGORIE
  //    DELETE /categories/:id
  // ════════════════════════════════════════════════════════════

  async remove(id: string): Promise<{ message: string; subsSupprimees: number }> {
    const cat = await this.catRepo.findOne({
      where:     { id },
      relations: ['subCategories'],
    });
    if (!cat) throw new NotFoundException(`Catégorie introuvable (ID: ${id}).`);

    const nbSubs = cat.subCategories?.length ?? 0;
    await this.catRepo.remove(cat);

    this.logger.log(`[DELETE CAT ✅] ID=${id} | nom="${cat.nom}" | subs: ${nbSubs}`);
    return {
      message:        `Catégorie "${cat.nom}" et ses ${nbSubs} sous-catégorie(s) supprimées.`,
      subsSupprimees: nbSubs,
    };
  }

  // ════════════════════════════════════════════════════════════
  // 7. SOUS-CATÉGORIES D'UNE CATÉGORIE
  //    GET /categories/:id/sub-categories
  // ════════════════════════════════════════════════════════════

  async findSubCatsByCategory(categoryId: string): Promise<SubCategoryResponse[]> {
    const cat = await this.catRepo.findOne({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException(`Catégorie introuvable (ID: ${categoryId}).`);

    const subs = await this.subRepo.find({
      where: { categoryId },
      order: { ordre: 'ASC', nom: 'ASC' },
    });
    return subs.map(s => this.toSubCategoryResponse(s));
  }

  // ════════════════════════════════════════════════════════════
  // 8. CRÉER UNE SOUS-CATÉGORIE
  //    POST /sub-categories
  // ════════════════════════════════════════════════════════════

  async createSubCategory(dto: CreateSubCategoryDto): Promise<SubCategoryResponse> {
    if (!dto.nom?.trim())  throw new BadRequestException('Le nom est obligatoire.');
    if (!dto.slug?.trim()) throw new BadRequestException('Le slug est obligatoire.');
    if (!dto.categoryId)   throw new BadRequestException('La catégorie parente est obligatoire.');

    const cat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException(`Catégorie parente introuvable (ID: ${dto.categoryId}).`);

    const slug = this.normalizeSlug(dto.slug);

    // Unicité nom dans la même catégorie
    const existante = await this.subRepo.findOne({
      where: { nom: dto.nom.trim(), categoryId: dto.categoryId },
    });
    if (existante)
      throw new ConflictException(`Sous-catégorie "${dto.nom.trim()}" existe déjà dans "${cat.nom}".`);

    const ordre = dto.ordre ?? ((await this.subRepo.count({ where: { categoryId: dto.categoryId } })) + 1);

    const sub = this.subRepo.create({
      nom:         dto.nom.trim(),
      slug,
      icone:       dto.icone?.trim()       || null,
      description: dto.description?.trim() || null,
      ordre,
      actif:       true,
      category:    cat,
      categoryId:  dto.categoryId,
    });

    const saved = await this.subRepo.save(sub);
    this.logger.log(`[CREATE SUB ✅] ID=${saved.id} | nom="${saved.nom}" | cat="${cat.nom}"`);
    return this.toSubCategoryResponse(saved);
  }

  // ════════════════════════════════════════════════════════════
  // 9. MODIFIER UNE SOUS-CATÉGORIE
  //    PATCH /sub-categories/:id
  // ════════════════════════════════════════════════════════════

  async updateSubCategory(id: string, dto: UpdateSubCategoryDto): Promise<SubCategoryResponse> {
    const sub = await this.subRepo.findOne({ where: { id }, relations: ['category'] });
    if (!sub) throw new NotFoundException(`Sous-catégorie introuvable (ID: ${id}).`);

    if (dto.nom !== undefined) {
      const catId = dto.categoryId ?? sub.categoryId;
      const conflit = await this.subRepo.findOne({ where: { nom: dto.nom.trim(), categoryId: catId } });
      if (conflit && conflit.id !== id)
        throw new ConflictException(`Sous-catégorie "${dto.nom.trim()}" existe déjà dans cette catégorie.`);
      sub.nom = dto.nom.trim();
    }
    if (dto.slug        !== undefined) sub.slug        = this.normalizeSlug(dto.slug);
    if (dto.icone       !== undefined) sub.icone       = dto.icone?.trim()       || null;
    if (dto.description !== undefined) sub.description = dto.description?.trim() || null;
    if (dto.ordre       !== undefined) sub.ordre       = dto.ordre;
    if (dto.actif       !== undefined) sub.actif       = dto.actif;

    if (dto.categoryId && dto.categoryId !== sub.categoryId) {
      const nouvelleCat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
      if (!nouvelleCat) throw new NotFoundException(`Catégorie parente introuvable (ID: ${dto.categoryId}).`);
      sub.category   = nouvelleCat;
      sub.categoryId = dto.categoryId;
    }

    await this.subRepo.save(sub);
    this.logger.log(`[UPDATE SUB ✅] ID=${id}`);

    const updated = await this.subRepo.findOne({ where: { id }, relations: ['category'] });
    return this.toSubCategoryResponse(updated!);
  }

  // ════════════════════════════════════════════════════════════
  // 10. SUPPRIMER UNE SOUS-CATÉGORIE
  //     DELETE /sub-categories/:id
  // ════════════════════════════════════════════════════════════

  async removeSubCategory(id: string): Promise<{ message: string }> {
    const sub = await this.subRepo.findOne({ where: { id }, relations: ['category'] });
    if (!sub) throw new NotFoundException(`Sous-catégorie introuvable (ID: ${id}).`);

    const nomSub = sub.nom;
    const nomCat = sub.category?.nom ?? '';

    await this.subRepo.remove(sub);
    this.logger.log(`[DELETE SUB ✅] ID=${id} | nom="${nomSub}" | cat="${nomCat}"`);
    return { message: `Sous-catégorie "${nomSub}" supprimée de "${nomCat}".` };
  }

  // ════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES
  // ════════════════════════════════════════════════════════════

  private normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private toCategoryResponse(cat: Category): CategoryResponse {
    return {
      id:            cat.id,
      nom:           cat.nom,
      slug:          cat.slug,
      icone:         cat.icone,
      couleur:       cat.couleur,
      description:   cat.description,
      ordre:         cat.ordre,
      actif:         cat.actif,
      companyTypeId: cat.companyTypeId,
      subCategories: (cat.subCategories ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(s => this.toSubCategoryResponse(s)),
      createdAt:     cat.createdAt?.toISOString() ?? '',
    };
  }

  private toSubCategoryResponse(sub: SubCategory): SubCategoryResponse {
    return {
      id:          sub.id,
      nom:         sub.nom,
      slug:        sub.slug,
      icone:       sub.icone,
      description: sub.description,
      ordre:       sub.ordre,
      actif:       sub.actif,
      categoryId:  sub.categoryId ?? sub.category?.id ?? '',
      createdAt:   sub.createdAt?.toISOString() ?? '',
    };
  }
}