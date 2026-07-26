/* ============================================================
 * FICHIER      : src/modules/company-team/services/team-permission-definition.service.ts
 * MODULE       : Company Team
 * ROLE         : Gestion du schéma de permissions dynamique.
 *
 * RESPONSABILITES :
 *   - Fournit la liste des catégories et actions disponibles.
 *   - Permet au Super Admin d'ajouter/désactiver des permissions.
 *   - Construit la map de valeurs par défaut pour les nouveaux membres.
 *   - Retourne la structure complète attendue par le frontend.
 *
 * ARCHITECTURE :
 *   Les définitions sont lues depuis la base de données.
 *   Le frontend n'a JAMAIS de permissions codées en dur.
 *   Ajouter un nouveau module = INSERT en base, zéro modification de code.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TeamPermissionCategory }   from '../../../database/entities/company-team/team-permission-category.entity';
import { TeamPermissionDefinition } from '../../../database/entities/company-team/team-permission-definition.entity';

/** Structure retournée au frontend */
export interface PermissionSchema {
  categories: Array<{
    id:         string;
    slug:       string;
    label:      string;
    icon?:      string;
    sortOrder:  number;
    actions:    Array<{
      id:           string;
      slug:         string;
      label:        string;
      description?: string;
      defaultValue: boolean;
      sortOrder:    number;
    }>;
  }>;
}

@Injectable()
export class TeamPermissionDefinitionService {

  constructor(
    @InjectRepository(TeamPermissionCategory)
    private readonly categoryRepo: Repository<TeamPermissionCategory>,

    @InjectRepository(TeamPermissionDefinition)
    private readonly definitionRepo: Repository<TeamPermissionDefinition>,
  ) {}

  // ════════════════════════════════════════════════════════════
  // LECTURE DU SCHÉMA
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne le schéma complet des permissions actives.
   * Utilisé par le frontend pour construire l'interface d'édition.
   */
  async getActiveSchema(): Promise<PermissionSchema> {
    const categories = await this.categoryRepo.find({
      where:   { isActive: true },
      order:   { sortOrder: 'ASC' },
    });

    const result: PermissionSchema['categories'] = [];

    for (const cat of categories) {
      const defs = await this.definitionRepo.find({
        where:   { categoryId: cat.id, isActive: true },
        order:   { sortOrder: 'ASC' },
      });

      result.push({
        id:        cat.id,
        slug:      cat.slug,
        label:     cat.label,
        icon:      cat.icon,
        sortOrder: cat.sortOrder,
        actions:   defs.map(d => ({
          id:           d.id,
          slug:         d.slug,
          label:        d.label,
          description:  d.description,
          defaultValue: d.defaultValue,
          sortOrder:    d.sortOrder,
        })),
      });
    }

    return { categories: result };
  }

  /**
   * Construit un objet de permissions par défaut pour un nouveau membre.
   * Toutes les actions sont initialisées avec leur defaultValue.
   */
  async buildDefaultPermissions(): Promise<Record<string, Record<string, boolean>>> {
    const schema = await this.getActiveSchema();
    const result: Record<string, Record<string, boolean>> = {};

    for (const cat of schema.categories) {
      result[cat.slug] = {};
      for (const action of cat.actions) {
        /* Le slug format est "category.action" → on extrait la partie action */
        const actionKey = action.slug.split('.').pop() ?? action.slug;
        result[cat.slug][actionKey] = action.defaultValue;
      }
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════
  // GESTION SUPER ADMIN
  // ════════════════════════════════════════════════════════════

  /** Active ou désactive une définition de permission */
  async toggleDefinition(definitionId: string, isActive: boolean): Promise<TeamPermissionDefinition> {
    const def = await this.definitionRepo.findOne({ where: { id: definitionId } });
    if (!def) throw new NotFoundException('Définition de permission introuvable.');
    def.isActive = isActive;
    return this.definitionRepo.save(def);
  }

  /** Active ou désactive une catégorie entière */
  async toggleCategory(categoryId: string, isActive: boolean): Promise<TeamPermissionCategory> {
    const cat = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Catégorie de permission introuvable.');
    cat.isActive = isActive;
    return this.categoryRepo.save(cat);
  }
}
