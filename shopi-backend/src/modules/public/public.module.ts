/* ============================================================
 * FICHIER : src/modules/public/public.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product }     from 'src/database/entities/entreprise.table/product.entity';
import { Company }     from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }    from 'src/database/entities/profiles/livreur-profile.entity';
import { CompanyAvis } from 'src/database/entities/entreprise.table/company-avis.entity';
import { Promotion }   from 'src/database/entities/entreprise.table/promotion.entity';
import { Follow }        from 'src/database/entities/follow/follow.entity';
import { ProductStory }  from 'src/database/entities/entreprise.table/product-story.entity';

import { PublicController } from './public.controller';
import { PublicService }    from './public.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Company, Delivery, CompanyAvis, Promotion, Follow, ProductStory]),
  ],
  controllers: [PublicController],
  providers:   [PublicService],
})
export class PublicModule {}
