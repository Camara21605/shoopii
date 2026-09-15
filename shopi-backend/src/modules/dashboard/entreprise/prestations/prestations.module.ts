import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrestationsController } from './prestations.controller';
import { PrestationsService }    from './prestations.service';

import { Service }      from 'src/database/entities/entreprise.table/service.entity';
import { ServiceMedia } from 'src/database/entities/entreprise.table/service-media.entity';
import { ServiceSpec }  from 'src/database/entities/entreprise.table/service-spec.entity';
import { Category }     from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory }  from 'src/database/entities/entreprise.table/sub-category.entity';
import { Company }      from 'src/database/entities/profiles/entreprise-profile.entity';
import { CompanyType }  from 'src/database/entities/entreprise.table/company-type.entity';

import { AuthModule }        from '../../../auth/auth.module';
import { CategoriesModule }  from '../../super-admin/categories/categories.module';
import { CompanyTeamModule } from 'src/modules/company-team/company-team.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Service,
      ServiceMedia,
      ServiceSpec,
      Category,
      SubCategory,
      Company,
      CompanyType,
    ]),
    AuthModule,
    CategoriesModule,
    /* Fournit TeamPermissionGuard — vérifie les permissions "Services"
     * d'un collaborateur sur chaque route (voir PrestationsController
     * @RequiresTeamPermission('services', …)). */
    CompanyTeamModule,
  ],
  controllers: [PrestationsController],
  providers:   [PrestationsService],
  exports:     [PrestationsService],
})
export class PrestationsModule {}
