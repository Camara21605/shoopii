/* ============================================================
 * FICHIER : src/modules/explore/explore.module.ts
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from 'src/database/entities/entreprise.table/product.entity';
import { Category } from 'src/database/entities/entreprise.table/category.entity';
import { TrendingProduct } from 'src/database/entities/entreprise.table/trending-product.entity';
import { ProductCooccurrence } from 'src/database/entities/entreprise.table/product-cooccurrence.entity';
import { CommandeItem } from 'src/database/entities/commande/commande-item.entity';
import { ProductLike } from 'src/database/entities/entreprise.table/product-like.entity';
import { Client } from 'src/database/entities/profiles/client-profile.entity';
import { Service } from 'src/database/entities/entreprise.table/service.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { PerformanceModule } from 'src/modules/performance-engine/performance.module';

import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { ExploreSearchService } from './explore-search.service';
import { ExploreScheduler } from './explore.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, Category, TrendingProduct, ProductCooccurrence, CommandeItem, ProductLike, Client,
      Service, Company, Delivery, Correspondent,
    ]),
    PerformanceModule,   // RedisCacheService — cache des suggestions
  ],
  controllers: [ExploreController],
  providers:   [ExploreService, ExploreSearchService, ExploreScheduler],
})
export class ExploreModule {}
