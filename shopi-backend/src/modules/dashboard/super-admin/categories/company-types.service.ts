/* ============================================================
 * FICHIER : src/modules/catalogue/company-types.service.ts
 *
 * RÔLE    : Gestion CRUD des types d'entreprise Shopi.
 *           Un type d'entreprise est le regroupement de haut
 *           niveau au-dessus des catégories.
 *
 *           Exemples de types :
 *             Restaurant, Boutique, Pharmacie, Artisan, Service…
 *
 * MÉTHODES :
 *  1. findAll()    → GET  /company-types          (SettingsSection.tsx)
 *  2. findOne()    → GET  /company-types/:id
 *  3. create()     → POST /company-types           (SettingsSection.tsx)
 *  4. update()     → PATCH /company-types/:id
 *  5. remove()     → DELETE /company-types/:id     (SettingsSection.tsx)
 *
 * SÉCURITÉ :
 *  - create/update/remove → SUPER_ADMIN uniquement (guard dans le controller)
 *  - findAll → accessible à tous les rôles authentifiés
 *
 * PLACEMENT :
 *  src/modules/catalogue/company-types.service.ts
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

import { CompanyType } from '../../../../database/entities/entreprise.table/company-type.entity';
import { Category }    from '../../../../database/entities/entreprise.table/category.entity';

// ─────────────────────────────────────────────────────────────
// DTOs INTERNES
// ─────────────────────────────────────────────────────────────

export interface CreateCompanyTypeDto {
  slug:         string;
  nom:          string;
  description?: string;
  icone?:       string;
  couleur?:     string;
  ordre?:       number;
}

export interface UpdateCompanyTypeDto {
  slug?:        string;
  nom?:         string;
  description?: string;
  icone?:       string;
  couleur?:     string;
  ordre?:       number;
  actif?:       boolean;
}

// ─────────────────────────────────────────────────────────────
// INTERFACES DE RÉPONSE
// ─────────────────────────────────────────────────────────────

export interface CompanyTypeResponse {
  id:           string;
  slug:         string;
  nom:          string;
  description:  string | null;
  icone:        string | null;
  couleur:      string | null;
  ordre:        number;
  actif:        boolean;
  /** Nombre de catégories rattachées à ce type */
  nbCategories: number;
  /** Nombre d'entreprises ayant ce type */
  nbEntreprises: number;
  createdAt:    string;
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

@Injectable()
export class CompanyTypesService {

  private readonly logger = new Logger(CompanyTypesService.name);

  constructor(
    @InjectRepository(CompanyType)
    private readonly typeRepo: Repository<CompanyType>,

    @InjectRepository(Category)
    private readonly catRepo: Repository<Category>,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // 1. LISTER TOUS LES TYPES
  //    GET /company-types
  //    Trié par ordre ASC, puis nom ASC
  // ══════════════════════════════════════════════════════════════

  async findAll(): Promise<CompanyTypeResponse[]> {
    const types = await this.typeRepo.find({
      relations: ['categories', 'companies'],
      order:     { ordre: 'ASC', nom: 'ASC' },
    });
    return types.map(t => this.toResponse(t));
  }

  // ══════════════════════════════════════════════════════════════
  // 2. RÉCUPÉRER UN TYPE PAR ID
  //    GET /company-types/:id
  // ══════════════════════════════════════════════════════════════

  async findOne(id: string): Promise<CompanyTypeResponse> {
    const type = await this.typeRepo.findOne({
      where:     { id },
      relations: ['categories', 'companies'],
    });
    if (!type) {
      throw new NotFoundException(`Type d'entreprise introuvable (ID: ${id}).`);
    }
    return this.toResponse(type);
  }

  // ══════════════════════════════════════════════════════════════
  // 3. CRÉER UN TYPE
  //    POST /company-types
  //    Réservé au SUPER_ADMIN
  // ══════════════════════════════════════════════════════════════

  async create(dto: CreateCompanyTypeDto): Promise<CompanyTypeResponse> {
    if (!dto.nom?.trim())  throw new BadRequestException('Le nom est obligatoire.');
    if (!dto.slug?.trim()) throw new BadRequestException('Le slug est obligatoire.');

    // Normaliser le slug : kebab-case, minuscules, sans accents
    const slug = this.normalizeSlug(dto.slug);

    // Unicité slug
    const slugExistant = await this.typeRepo.findOne({ where: { slug } });
    if (slugExistant) {
      throw new ConflictException(`Un type avec le slug "${slug}" existe déjà.`);
    }

    // Unicité nom
    const nomExistant = await this.typeRepo.findOne({ where: { nom: dto.nom.trim() } });
    if (nomExistant) {
      throw new ConflictException(`Un type nommé "${dto.nom.trim()}" existe déjà.`);
    }

    // Ordre automatique si non fourni
    const ordre = dto.ordre ?? ((await this.typeRepo.count()) + 1);

    const type = this.typeRepo.create({
      slug,
      nom:         dto.nom.trim(),
      description: dto.description?.trim() || null,
      icone:       dto.icone?.trim()       || null,
      couleur:     dto.couleur?.trim()     || null,
      ordre,
      actif:       true,
    });

    const saved = await this.typeRepo.save(type);
    this.logger.log(`[CREATE TYPE ✅] ID=${saved.id} | slug="${slug}" | nom="${saved.nom}"`);

    return this.findOne(saved.id);
  }

  // ══════════════════════════════════════════════════════════════
  // 4. MODIFIER UN TYPE
  //    PATCH /company-types/:id
  //    Réservé au SUPER_ADMIN
  // ══════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateCompanyTypeDto): Promise<CompanyTypeResponse> {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException(`Type d'entreprise introuvable (ID: ${id}).`);

    // Vérifications unicité si modification
    if (dto.slug !== undefined) {
      const slug = this.normalizeSlug(dto.slug);
      const conflit = await this.typeRepo.findOne({ where: { slug } });
      if (conflit && conflit.id !== id) {
        throw new ConflictException(`Un type avec le slug "${slug}" existe déjà.`);
      }
      type.slug = slug;
    }

    if (dto.nom !== undefined) {
      const conflit = await this.typeRepo.findOne({ where: { nom: dto.nom.trim() } });
      if (conflit && conflit.id !== id) {
        throw new ConflictException(`Un type nommé "${dto.nom.trim()}" existe déjà.`);
      }
      type.nom = dto.nom.trim();
    }

    if (dto.description !== undefined) type.description = dto.description?.trim() || null;
    if (dto.icone       !== undefined) type.icone       = dto.icone?.trim()       || null;
    if (dto.couleur     !== undefined) type.couleur     = dto.couleur?.trim()     || null;
    if (dto.ordre       !== undefined) type.ordre       = dto.ordre;
    if (dto.actif       !== undefined) type.actif       = dto.actif;

    await this.typeRepo.save(type);
    this.logger.log(`[UPDATE TYPE ✅] ID=${id}`);

    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // 5. SUPPRIMER UN TYPE
  //    DELETE /company-types/:id
  //    Réservé au SUPER_ADMIN
  //
  //    ⚠️ Avant suppression : vérifie qu'aucune entreprise
  //    n'utilise ce type (protection intégrité métier).
  //    Les catégories liées auront companyTypeId → null (SET NULL).
  // ══════════════════════════════════════════════════════════════

  async remove(id: string): Promise<{ message: string; catsMisesAJour: number }> {
    const type = await this.typeRepo.findOne({
      where:     { id },
      relations: ['categories', 'companies'],
    });
    if (!type) throw new NotFoundException(`Type d'entreprise introuvable (ID: ${id}).`);

    // Vérification : impossible de supprimer un type utilisé par des entreprises
    const nbEntreprises = type.companies?.length ?? 0;
    if (nbEntreprises > 0) {
      throw new BadRequestException(
        `Impossible de supprimer "${type.nom}" : ${nbEntreprises} entreprise(s) utilisent ce type. ` +
        `Réassignez-les d'abord.`,
      );
    }

    const nbCats = type.categories?.length ?? 0;
    const nom    = type.nom;

    await this.typeRepo.remove(type);
    // Les catégories liées passent à companyTypeId = null (SET NULL en BDD)

    this.logger.log(
      `[DELETE TYPE ✅] ID=${id} | nom="${nom}" | cats détachées: ${nbCats}`,
    );

    return {
      message:         `Type "${nom}" supprimé. ${nbCats} catégorie(s) détachée(s).`,
      catsMisesAJour:  nbCats,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES
  // ══════════════════════════════════════════════════════════════

  private normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private toResponse(type: CompanyType): CompanyTypeResponse {
    return {
      id:            type.id,
      slug:          type.slug,
      nom:           type.nom,
      description:   type.description,
      icone:         type.icone,
      couleur:       type.couleur,
      ordre:         type.ordre,
      actif:         type.actif,
      nbCategories:  type.categories?.length  ?? 0,
      nbEntreprises: type.companies?.length   ?? 0,
      createdAt:     type.createdAt?.toISOString() ?? '',
    };
  }
}