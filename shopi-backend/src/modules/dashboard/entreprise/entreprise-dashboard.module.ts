// ============================================================
// FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.module.ts
// ============================================================

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// ── Modules réutilisables ────────────────────────────────────
import { CategoriesModule }     from '../super-admin/categories/categories.module';
import { ProduitsModule }       from './produits/produits.module';
import { PromotionsModule }     from '../../promotions/promotions.module';
import { CorrespondantsModule } from './correspondants/correspondants.module';
import { LivreursModule }       from './livreurs/livreurs.module';
import { ParametresModule }     from './parametres.module';
import { ReturnsModule }       from './returns/returns.module';
import { ClientsModule }       from './clients/clients.module';
import { FournisseursModule }  from './fournisseurs/fournisseurs.module';

// ── Entités TypeORM ──────────────────────────────────────────
import { User }             from '../../../database/entities/user.entity';
import { CompanyType }      from '../../../database/entities/entreprise.table/company-type.entity';
import { Company }          from '../../../database/entities/profiles/entreprise-profile.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { Product }        from '../../../database/entities/entreprise.table/product.entity';
import { ProductMedia }   from '../../../database/entities/entreprise.table/product-media.entity';
import { ProductVariant } from '../../../database/entities/entreprise.table/product-variant.entity';
import { ProductSpec }    from '../../../database/entities/entreprise.table/product-spec.entity';
import { ProductWholesaleTier } from '../../../database/entities/entreprise.table/product-wholesale-tier.entity';
import { ProductStory }  from '../../../database/entities/entreprise.table/product-story.entity';
import { Category }       from '../../../database/entities/entreprise.table/category.entity';
import { SubCategory }    from '../../../database/entities/entreprise.table/sub-category.entity';
import { Commande }       from '../../../database/entities/commande/commande.entity';
import { CommandeItem }   from '../../../database/entities/commande/commande-item.entity';
import { Client }         from '../../../database/entities/profiles/client-profile.entity';
import { Delivery }       from '../../../database/entities/profiles/livreur-profile.entity';
import { CompanyAvis }    from '../../../database/entities/entreprise.table/company-avis.entity';
import { Follow }         from '../../../database/entities/follow/follow.entity';
import { ReturnRequest }  from '../../../database/entities/returns/return-request.entity';
import { Wallet }         from '../../../database/entities/wallet.entity';
import { WalletLedgerEntry } from '../../../database/entities/wallet-ledger-entry.entity';

// ── Controllers ───────────────────────────────────────────────
import { EntrepriseDashboardController } from './entreprise-dashboard.controller';
import { ProduitsController }            from './produits/produits.controller';
import { CategoriesController }          from '../super-admin/categories/categories.controller';

// ── Services ──────────────────────────────────────────────────
import { EntrepriseDashboardService } from './entreprise-dashboard.service';
import { ProduitsService }            from './produits/produits.service';
import { CategoriesService }          from '../super-admin/categories/categories.service';

@Module({
  imports: [
    // ── Entités TypeORM directement utilisées par ce module ─────
    // ✅ CORRIGÉ : ParametresModule retiré d'ici (c'est un Module, pas une Entity)
    TypeOrmModule.forFeature([
      User,
      Company,
      Product,
      ProductMedia,
      ProductVariant,
      ProductSpec,
      ProductWholesaleTier,
      Category,
      SubCategory,
      CompanyType,
      ProductStory,
      PlatformSettings,
      Commande,
      CommandeItem,
      Client,
      Delivery,
      CompanyAvis,
      Follow,
      ReturnRequest,
      Wallet,
      WalletLedgerEntry,
    ]),

    // ── Modules internes ─────────────────────────────────────────
    CategoriesModule,
    ProduitsModule,
    PromotionsModule,
    CorrespondantsModule,
    LivreursModule,
    ParametresModule,
    ReturnsModule,
    ClientsModule,
    FournisseursModule,
  ],

  controllers: [
    EntrepriseDashboardController,
    ProduitsController,
    CategoriesController,
  ],

  providers: [
    EntrepriseDashboardService,
    ProduitsService,
    CategoriesService,
  ],

  exports: [
    EntrepriseDashboardService,
    PromotionsModule,
    CorrespondantsModule,
    LivreursModule,
    FournisseursModule,
  ],
})
export class EntrepriseDashboardModule {}