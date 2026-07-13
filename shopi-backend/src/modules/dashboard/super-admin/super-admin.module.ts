/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/super-admin.module.ts
 *
 * RÔLE    : Module NestJS du dashboard Super Admin.
 *           Importe et enregistre TOUS les sous-modules et
 *           controllers nécessaires au dashboard.
 *
 * CE MODULE IMPORTE :
 *   ① TypeOrmModule  → entités User, Category, SubCategory
 *   ② CategoriesModule → routes GET/POST/PATCH/DELETE /categories
 *   ③ UtilisateursController → routes /dashboard/super-admin/users/*
 *   ④ SuperAdminController   → route  /dashboard/super-admin
 *
 * CE MODULE EXPORTE :
 *   UtilisateursService → pour les autres modules qui
 *   auraient besoin des stats ou de la liste users.
 *
 * IMPORTÉ PAR :
 *   src/modules/dashboard/dashboard.module.ts
 *
 * PLACEMENT :
 *   src/modules/dashboard/super-admin/super-admin.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// ── Entités TypeORM ───────────────────────────────────────────
import { User }             from '../../../database/entities/user.entity';
import { Category }         from '../../../database/entities/entreprise.table/category.entity';
import { SubCategory }      from '../../../database/entities/entreprise.table/sub-category.entity';
import { AuditLog }         from '../../../database/entities/audit-log.entity';
import { Report }           from '../../../database/entities/report.entity';
import { Admin }            from '../../../database/entities/profiles/admin-profile.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { Product }          from '../../../database/entities/entreprise.table/product.entity';
import { Commande }         from '../../../database/entities/commande/commande.entity';

// ── Sous-module catégories ─────────────────────────────────────
// Fournit GET/POST/PATCH/DELETE /categories et /sub-categories
import { CategoriesModule } from './categories/categories.module';

// ── Controllers ────────────────────────────────────────────────
import { SuperAdminController }    from './super-admin.controller';
import { UtilisateursController }  from './controllers/utilisateurs.controller';
import { ModerationController }    from './controllers/moderation.controller';
import { ReportsController }       from './controllers/reports.controller';

// ── Services ───────────────────────────────────────────────────
import { UtilisateursService }     from './services/utilisateurs.service';
import { AuditLogService }         from './services/audit-log.service';
import { ReportsService }          from './services/reports.service';
import { AdminsService }           from './services/admins.service';
import { PlatformSettingsService } from './services/platform-settings.service';
import { SecuriteAdminService }    from './services/securite-admin.service';
import { NotificationsModule }      from '../../notifications/notifications.module';

@Module({
  imports: [
    // ① Entités nécessaires à ce module
    TypeOrmModule.forFeature([
      User,             // pour UtilisateursService
      Category,         // pour les stats par catégorie (futur)
      SubCategory,      // idem
      AuditLog,         // pour AuditLogService
      Report,           // pour ReportsService
      Admin,            // pour AdminsService
      PlatformSettings, // pour PlatformSettingsService
      Product,          // pour getPlatformStats → COUNT produits publiés
      Commande,         // pour getPlatformStats → COUNT commandes
    ]),

    CategoriesModule,
    NotificationsModule,
  ],

  controllers: [
    // ③ Route principale : GET /dashboard/super-admin
    SuperAdminController,

    // ④ Routes utilisateurs : /dashboard/super-admin/users/*
    //    GET    /users            → liste paginée
    //    GET    /users/stats      → statistiques globales
    //    GET    /users/export     → export CSV
    //    GET    /users/:id        → détail utilisateur
    //    PATCH  /users/:id/block  → bloquer / débloquer
    //    PATCH  /users/:id/suspend→ suspendre
    //    PATCH  /users/:id/verify → vérifier manuellement
    UtilisateursController,

    // ⑤ Routes de modération : /dashboard/super-admin/alerts, /audit, /admins
    ModerationController,

    // ⑥ Route publique : POST /reports (tout utilisateur authentifié)
    ReportsController,
  ],

  providers: [
    UtilisateursService,
    AuditLogService,
    ReportsService,
    AdminsService,
    PlatformSettingsService,
    SecuriteAdminService,   /* sécurité compte admin : mot de passe + 2FA + score */
  ],

  exports: [
    // Exporté pour que DashboardModule puisse injecter
    // UtilisateursService si nécessaire
    UtilisateursService,
  ],
})
export class SuperAdminModule {}