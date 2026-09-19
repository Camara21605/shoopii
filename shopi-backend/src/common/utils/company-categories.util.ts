/* ============================================================
 * FICHIER : src/common/utils/company-categories.util.ts
 *
 * RÔLE : Catégories CHOISIES par une entreprise (table de jointure
 * `company_categories`, relation Company.categories).
 *
 * RÈGLE MÉTIER — à l'inscription, après le choix du type d'entreprise,
 * l'entreprise choisit parmi les catégories de CE type. Ensuite, dans son
 * compte, elle ne voit et ne peut utiliser QUE ces catégories (et leurs
 * sous-catégories) pour créer/modifier un produit ou une prestation.
 *
 * REPLI (entreprises antérieures à cette règle, sans aucune sélection) :
 * tant qu'une entreprise n'a rien choisi, toutes les catégories actives de
 * son type restent utilisables — sinon ces comptes ne pourraient plus rien
 * publier. Dès qu'elle en choisit (Paramètres > Boutique), la sélection
 * devient stricte.
 *
 * Fonctions pures prenant un EntityManager : utilisables aussi bien dans
 * la transaction d'inscription (AuthService) que dans les services du
 * dashboard, sans nouvelle dépendance à injecter.
 * ============================================================ */

import { BadRequestException } from '@nestjs/common';
import type { EntityManager }  from 'typeorm';

import { Category }          from '../../database/entities/entreprise.table/category.entity';
import { CompanyTypeNature } from '../../database/entities/entreprise.table/company-type.entity';

export interface CompanyRef {
  id:            string;
  companyTypeId: string | null;
}

/** Ids des catégories choisies par l'entreprise (vide = aucune sélection). */
export async function getSelectedCategoryIds(manager: EntityManager, companyId: string): Promise<string[]> {
  const rows: { categoryId: string }[] = await manager.query(
    'SELECT "categoryId" FROM company_categories WHERE "companyId" = $1',
    [companyId],
  );
  return rows.map(r => r.categoryId);
}

/**
 * Catégories (avec sous-catégories actives) utilisables par l'entreprise.
 * `excludeNature` garde l'étanchéité produits/services : un compte produits
 * n'obtient jamais de catégorie d'un type 'services', et inversement.
 */
export async function getAllowedCategories(
  manager:       EntityManager,
  company:       CompanyRef,
  excludeNature: CompanyTypeNature,
): Promise<Category[]> {
  const selected = await getSelectedCategoryIds(manager, company.id);

  const qb = manager.getRepository(Category)
    .createQueryBuilder('cat')
    .leftJoinAndSelect('cat.subCategories', 'sub', 'sub.actif = :actif', { actif: true })
    .leftJoin('cat.companyType', 'ct')
    .where('cat.actif = :actif', { actif: true })
    .andWhere('ct.nature != :excludedNature', { excludedNature: excludeNature })
    .orderBy('cat.ordre', 'ASC')
    .addOrderBy('sub.ordre', 'ASC');

  // Catégories de SON type uniquement (plus de catégories "neutres" d'autres types).
  if (company.companyTypeId) {
    qb.andWhere('cat.companyTypeId = :typeId', { typeId: company.companyTypeId });
  }
  // Sélection stricte dès qu'elle existe ; sinon repli = toutes celles du type.
  if (selected.length > 0) {
    qb.andWhere('cat.id IN (:...selected)', { selected });
  }

  return qb.getMany();
}

/**
 * Refuse une catégorie hors de celles autorisées pour l'entreprise.
 * À appeler après les contrôles existants (existence, nature) : ici on ne
 * vérifie QUE l'appartenance à la sélection de l'entreprise.
 */
export async function assertCategoryAllowed(
  manager:       EntityManager,
  company:       CompanyRef,
  category:      { id: string; nom: string },
  excludeNature: CompanyTypeNature,
): Promise<void> {
  const allowed = await getAllowedCategories(manager, company, excludeNature);
  if (!allowed.some(c => c.id === category.id)) {
    throw new BadRequestException(
      `La catégorie "${category.nom}" n'est pas activée pour votre entreprise. ` +
      `Choisissez une de vos catégories (Paramètres > Boutique > Catégories de mon activité).`,
    );
  }
}

/** Nombre de catégories actives d'un type — pour savoir si un choix est exigible. */
export async function countActiveCategoriesOfType(manager: EntityManager, typeId: string): Promise<number> {
  return manager.getRepository(Category).count({ where: { companyTypeId: typeId, actif: true } });
}

/**
 * Valide une liste d'ids de catégories pour un type d'entreprise : chaque id
 * doit exister, être actif et appartenir à CE type. Retourne les entités
 * (dédoublonnées). Lève BadRequestException sinon.
 */
export async function validateCategoryIdsForType(
  manager:  EntityManager,
  typeId:   string,
  ids:      string[],
): Promise<Category[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const found = await manager.getRepository(Category)
    .createQueryBuilder('cat')
    .where('cat.id IN (:...unique)', { unique })
    .andWhere('cat.actif = :actif', { actif: true })
    .andWhere('cat.companyTypeId = :typeId', { typeId })
    .getMany();

  if (found.length !== unique.length) {
    throw new BadRequestException(
      "Une ou plusieurs catégories choisies sont invalides pour ce type d'entreprise.",
    );
  }
  return found;
}

/** Remplace la sélection de l'entreprise par exactement ces catégories. */
export async function replaceSelectedCategories(
  manager:     EntityManager,
  companyId:   string,
  categoryIds: string[],
): Promise<void> {
  await manager.query('DELETE FROM company_categories WHERE "companyId" = $1', [companyId]);
  for (const categoryId of new Set(categoryIds)) {
    await manager.query(
      'INSERT INTO company_categories ("companyId", "categoryId") VALUES ($1, $2)',
      [companyId, categoryId],
    );
  }
}
