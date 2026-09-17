/* ============================================================
 * FICHIER : src/modules/catalogue/catalogue.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyType } from '../../database/entities/entreprise.table/company-type.entity';
import { Category }    from '../../database/entities/entreprise.table/category.entity';
import { SubCategory } from '../../database/entities/entreprise.table/sub-category.entity';
import { Client }        from '../../database/entities/profiles/client-profile.entity';
import { ProductLike }   from '../../database/entities/entreprise.table/product-like.entity';
import { WishlistItem }  from '../../database/entities/entreprise.table/wishlist-item.entity';
import { Product }       from '../../database/entities/entreprise.table/product.entity';
import { Company }       from '../../database/entities/profiles/entreprise-profile.entity';
import { CommandeItem }  from '../../database/entities/commande/commande-item.entity';
import { Follow }        from '../../database/entities/follow/follow.entity';

import { CompanyTypesService } from '../dashboard/super-admin/categories/company-types.service';
import { CategoriesService }   from '../dashboard/super-admin/categories/categories.service';
import { CatalogueAffinityService } from './catalogue-affinity.service';
import { CatalogueController } from './catalogue.controller';  // ✅ nom réel du fichier

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyType, Category, SubCategory,
      /* Pour CatalogueAffinityService — personnalisation de l'ordre
       * d'affichage public selon les goûts du client connecté. */
      Client, ProductLike, WishlistItem, Product, Company, CommandeItem, Follow,
    ]),
  ],
  controllers: [CatalogueController],
  providers:   [CompanyTypesService, CategoriesService, CatalogueAffinityService],
  exports:     [CompanyTypesService, CategoriesService],
})
export class CatalogueModule {}