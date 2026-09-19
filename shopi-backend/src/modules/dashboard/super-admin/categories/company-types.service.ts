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

import { CompanyType, CompanyTypeNature } from '../../../../database/entities/entreprise.table/company-type.entity';
import { Category }    from '../../../../database/entities/entreprise.table/category.entity';
import { formatTypeName } from '../../../../common/utils/catalogue-case.util';

// ─────────────────────────────────────────────────────────────
// DTOs INTERNES
// ─────────────────────────────────────────────────────────────

export interface CreateCompanyTypeDto {
  slug:         string;
  nom:          string;
  description?: string;
  icone?:       string;
  imageUrl?:    string;
  couleur?:     string;
  ordre?:       number;
  /** Produits, services, ou neutre (les deux) — filtre le sélecteur de
   *  type à l'inscription selon le businessModel choisi. */
  nature?:      CompanyTypeNature;
}

export interface UpdateCompanyTypeDto {
  slug?:        string;
  nom?:         string;
  description?: string;
  icone?:       string;
  imageUrl?:    string;
  couleur?:     string;
  ordre?:       number;
  actif?:       boolean;
  nature?:      CompanyTypeNature;
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
  imageUrl:     string | null;
  couleur:      string | null;
  ordre:        number;
  actif:        boolean;
  nature:       CompanyTypeNature;
  /** Nombre de catégories rattachées à ce type */
  nbCategories: number;
  /** Catégories ACTIVES uniquement — un type sans catégorie active ne peut pas être choisi à l'inscription. */
  nbCategoriesActives: number;
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

  /** `nature` optionnel — filtre le dropdown de type à l'inscription
   *  selon le businessModel choisi.
   *
   * SÉCURITÉ / SÉPARATION — correspondance STRICTE, sans repli sur
   * 'neutral' : un vendeur "produits" ne doit JAMAIS voir le même type
   * qu'un vendeur "services", et inversement. `neutral` était au départ
   * une valeur passe-partout (et surtout la valeur PAR DÉFAUT silencieuse
   * de tout type créé sans choix explicite — voir create() ci-dessous) :
   * l'inclure ici aurait recréé exactement le chevauchement que le
   * modèle exclusif Company.businessModel est censé empêcher. Un type
   * resté 'neutral' (non encore classé par le super-admin) n'apparaît
   * donc plus DU TOUT à l'inscription tant qu'il n'a pas été
   * explicitement reclassé 'products' ou 'services' (voir le badge
   * "non classé" dans CatalogueTab.tsx). Sans filtre (`nature` absent,
   * ex: super-admin), comportement inchangé — tous les types renvoyés. */
  async findAll(nature?: CompanyTypeNature): Promise<CompanyTypeResponse[]> {
    const types = await this.typeRepo.find({
      where:     nature ? { nature } : undefined,
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
    const nomExistant = await this.typeRepo.findOne({ where: { nom: formatTypeName(dto.nom) } });
    if (nomExistant) {
      throw new ConflictException(`Un type nommé "${formatTypeName(dto.nom)}" existe déjà.`);
    }

    // Ordre automatique si non fourni
    const ordre = dto.ordre ?? ((await this.typeRepo.count()) + 1);

    const type = this.typeRepo.create({
      slug,
      nom:         formatTypeName(dto.nom),
      description: dto.description?.trim() || null,
      icone:       dto.icone?.trim()       || null,
      imageUrl:    dto.imageUrl?.trim()    || null,
      couleur:     dto.couleur?.trim()     || null,
      ordre,
      actif:       true,
      nature:      dto.nature ?? CompanyTypeNature.NEUTRAL,
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
      const conflit = await this.typeRepo.findOne({ where: { nom: formatTypeName(dto.nom) } });
      if (conflit && conflit.id !== id) {
        throw new ConflictException(`Un type nommé "${formatTypeName(dto.nom)}" existe déjà.`);
      }
      type.nom = formatTypeName(dto.nom);
    }

    if (dto.description !== undefined) type.description = dto.description?.trim() || null;
    if (dto.icone       !== undefined) type.icone       = dto.icone?.trim()       || null;
    if (dto.imageUrl    !== undefined) type.imageUrl    = dto.imageUrl?.trim()    || null;
    if (dto.couleur     !== undefined) type.couleur     = dto.couleur?.trim()     || null;
    if (dto.ordre       !== undefined) type.ordre       = dto.ordre;
    if (dto.actif       !== undefined) type.actif       = dto.actif;
    if (dto.nature      !== undefined) type.nature      = dto.nature;

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
      imageUrl:      type.imageUrl,
      couleur:       type.couleur,
      ordre:         type.ordre,
      actif:         type.actif,
      nature:        type.nature,
      nbCategories:  type.categories?.length  ?? 0,
      nbCategoriesActives: (type.categories ?? []).filter(c => c.actif).length,
      nbEntreprises: type.companies?.length   ?? 0,
      createdAt:     type.createdAt?.toISOString() ?? '',
    };
  }
}