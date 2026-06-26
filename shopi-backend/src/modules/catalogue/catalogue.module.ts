/* ============================================================
 * FICHIER : src/modules/catalogue/catalogue.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyType } from '../../database/entities/entreprise.table/company-type.entity';
import { Category }    from '../../database/entities/entreprise.table/category.entity';
import { SubCategory } from '../../database/entities/entreprise.table/sub-category.entity';

import { CompanyTypesService } from '../dashboard/super-admin/categories/company-types.service';
import { CategoriesService }   from '../dashboard/super-admin/categories/categories.service';
import { CatalogueController } from './catalogue.controller';  // ✅ nom réel du fichier

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyType, Category, SubCategory]),
  ],
  controllers: [CatalogueController],
  providers:   [CompanyTypesService, CategoriesService],
  exports:     [CompanyTypesService, CategoriesService],
})
export class CatalogueModule {}