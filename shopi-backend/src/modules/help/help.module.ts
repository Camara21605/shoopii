import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HelpCategory }    from '../../database/entities/help/help-category.entity';
import { HelpArticle }     from '../../database/entities/help/help-article.entity';
import { HelpFaqItem }     from '../../database/entities/help/help-faq-item.entity';
import { HelpSearchQuery } from '../../database/entities/help/help-search-query.entity';

import { HelpCategoryService } from './services/help-category.service';
import { HelpArticleService }  from './services/help-article.service';
import { HelpSearchService }   from './services/help-search.service';
import { HelpFaqService }      from './services/help-faq.service';

import { HelpPublicController } from './controllers/help-public.controller';
import { HelpAdminController }  from './controllers/help-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HelpCategory,
      HelpArticle,
      HelpFaqItem,
      HelpSearchQuery,
    ]),
  ],

  controllers: [
    HelpPublicController,
    HelpAdminController,
  ],

  providers: [
    HelpCategoryService,
    HelpArticleService,
    HelpSearchService,
    HelpFaqService,
  ],

  exports: [
    HelpArticleService,
    HelpSearchService,
  ],
})
export class HelpModule {}
