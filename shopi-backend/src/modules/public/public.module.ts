/* ============================================================
 * FICHIER : src/modules/public/public.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product }     from 'src/database/entities/entreprise.table/product.entity';
import { Company }     from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }    from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from 'src/database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire } from 'src/database/entities/profiles/correspondant-horaire.entity';
import { CompanyAvis } from 'src/database/entities/entreprise.table/company-avis.entity';
import { Promotion }   from 'src/database/entities/entreprise.table/promotion.entity';
import { Follow }        from 'src/database/entities/follow/follow.entity';
import { ProductStory }  from 'src/database/entities/entreprise.table/product-story.entity';
import { StoryView }     from 'src/database/entities/entreprise.table/story-view.entity';
import { StoryLike }     from 'src/database/entities/entreprise.table/story-like.entity';
import { Category }      from 'src/database/entities/entreprise.table/category.entity';
import { SubCategory }   from 'src/database/entities/entreprise.table/sub-category.entity';
import { User }          from 'src/database/entities/user.entity';

import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { PublicController } from './public.controller';
import { PublicService }    from './public.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Company, Delivery, Correspondent, CorrespondantHoraire, CompanyAvis, Promotion, Follow, ProductStory, StoryView, StoryLike, Category, SubCategory, User]),
    NotificationsModule, // NotificationBroadcastService — pousse story:viewed en direct au propriétaire de la story
  ],
  controllers: [PublicController],
  providers:   [PublicService],
})
export class PublicModule {}
