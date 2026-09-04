import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyType } from 'src/database/entities/entreprise.table/company-type.entity';
import { ProduitsController } from './produits.controller';
import { ProduitsService }    from './produits.service';

import { Product }        from 'src/database/entities/entreprise.table/product.entity';
import { ProductMedia }   from 'src/database/entities/entreprise.table/product-media.entity';
import { ProductVariant } from 'src/database/entities/entreprise.table/product-variant.entity';
import { ProductSpec }    from 'src/database/entities/entreprise.table/product-spec.entity';
import { ProductWholesaleTier } from 'src/database/entities/entreprise.table/product-wholesale-tier.entity';
import { Category }       from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory }    from 'src/database/entities/entreprise.table/sub-category.entity';
import { Company }          from 'src/database/entities/profiles/entreprise-profile.entity';
import { ProductStory }    from 'src/database/entities/entreprise.table/product-story.entity';
import { PlatformSettings } from 'src/database/entities/platform-settings.entity';
import { CompanySetting }   from 'src/modules/company-settings/company-settings.entity';

import { AuthModule }        from '../../../auth/auth.module';
import { UploadModule }      from 'src/modules/upload/upload.module';
import { CategoriesModule }  from '../../super-admin/categories/categories.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { CompanyTeamModule } from 'src/modules/company-team/company-team.module';
import { CommissionModule }  from 'src/modules/commission/commission.module';
import { ProductsScheduler } from './products.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductMedia,
      ProductVariant,
      ProductSpec,
      ProductWholesaleTier,
      Category,
      SubCategory,
      Company,       // ✅ AJOUTÉ — nécessaire pour companyRepo dans ProduitsService
      CompanyType,   // ✅ AJOUTÉ — nécessaire pour companyTypeRepo dans ProduitsService
      ProductStory,
      PlatformSettings, // FIX M1 — commission dynamique par plan
      CompanySetting,   // resoudreCommissionProduit() — override fixe/progressif
    ]),
    AuthModule,
    UploadModule,
    CategoriesModule,
    NotificationsModule,
    /* Fournit TeamPermissionGuard — vérifie réellement les permissions
     * "Produits" d'un collaborateur sur chaque route (voir ProduitsController
     * @RequiresTeamPermission('products', …)). */
    CompanyTeamModule,
    /* CommissionCalculatorService.resoudreCommissionProduit() — voir
     * ProduitsService.getProductStats() */
    CommissionModule,
  ],
  controllers: [ProduitsController],
  providers:   [ProduitsService, ProductsScheduler],
  exports:     [ProduitsService],
})
export class ProduitsModule {}