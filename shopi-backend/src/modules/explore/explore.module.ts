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

import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { ExploreScheduler } from './explore.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, Category, TrendingProduct, ProductCooccurrence, CommandeItem, ProductLike,
    ]),
  ],
  controllers: [ExploreController],
  providers:   [ExploreService, ExploreScheduler],
})
export class ExploreModule {}
