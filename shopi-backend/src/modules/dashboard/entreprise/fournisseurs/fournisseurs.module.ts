/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/fournisseurs/fournisseurs.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanySupplierLink } from 'src/database/entities/entreprise.table/company-supplier-link.entity';
import { Company }             from 'src/database/entities/profiles/entreprise-profile.entity';
import { Product }             from 'src/database/entities/entreprise.table/product.entity';
import { ProductMedia }        from 'src/database/entities/entreprise.table/product-media.entity';
import { ProductWholesaleTier } from 'src/database/entities/entreprise.table/product-wholesale-tier.entity';

import { FournisseursController } from './fournisseurs.controller';
import { FournisseursService }    from './fournisseurs.service';
import { AuthModule } from '../../../auth/auth.module';
/* Fournit TeamPermissionGuard — vérifie les permissions "Fournisseurs"
 * d'un collaborateur (voir FournisseursController @RequiresTeamPermission). */
import { CompanyTeamModule } from 'src/modules/company-team/company-team.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanySupplierLink,
      Company,
      Product,
      ProductMedia,
      ProductWholesaleTier,
    ]),
    AuthModule,
    CompanyTeamModule,
  ],
  controllers: [FournisseursController],
  providers:   [FournisseursService],
  exports:     [FournisseursService],
})
export class FournisseursModule {}
