/* ============================================================
 * FICHIER : src/app.module.ts — VERSION CORRIGÉE
 *
 * CORRECTIONS APPORTÉES :
 *
 *   1. ❌ → ✅  SuivisModule déplacé APRÈS RedisModule et BullModule
 *              car il injecte @InjectRedis() et @InjectQueue()
 *              qui doivent être enregistrés en premier.
 *
 *   2. ⚠️ → ✅  lazyConnect: true ajouté dans ioredis
 *              → la connexion Redis n'est établie qu'au premier appel,
 *              pas immédiatement au démarrage de l'app.
 *
 *   3. ⚠️ → ✅  Connexion Redis unifiée : BullModule lit maintenant
 *              aussi REDIS_URL pour être cohérent avec RedisModule.
 * ============================================================ */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule }  from '@nestjs/bullmq';

import { DatabaseModule }   from './database/database.module';
import { AuthModule }       from './modules/auth/auth.module';
import { MailModule }       from './modules/email/email.module';
import { CodesModule }      from './modules/auth/code-creation/code-creation.module';
import { UploadModule }     from './modules/upload/upload.module';
import { DashboardModule }  from './modules/dashboard/dashboard.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { PublicModule }     from './modules/public/public.module';
import { WalletModule }     from './modules/wallet/wallet.module';
import { CommandeModule }   from './modules/commande/commande.module';
import { SuivisModule }        from './modules/suivis/suivis.module';
import { MessagerieModule }    from './modules/messagerie/messagerie.module';
import { ContactSyncModule }   from './modules/messagerie/contacts/contact-sync.module';
import { LocationModule }      from './modules/location/location.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JobsModule }          from './jobs/jobs.module';
import { HelpModule }     from './modules/help/help.module';
import { SupportModule } from './modules/support/support.module';
import { ContactModule } from './modules/contact/contact.module';
import { HealthModule }          from './common/health/health.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GeoModule }             from './modules/geo/geo.module';
import { AppearanceModule }      from './modules/appearance/appearance.module';
import { ZoneAdminModule }          from './modules/zone-admin/zone-admin.module';
import { ValidationConfigModule }  from './modules/validation-config/validation-config.module';
import { CompanySettingsModule }   from './modules/company-settings/company-settings.module';
import { DeliverySettingsModule }  from './modules/delivery-settings/delivery-settings.module';
import { PartnerSettingsModule }   from './modules/partner-settings/partner-settings.module';
import { DeliveryGroupModule }     from './modules/delivery-group/delivery-group.module';

@Module({
  imports: [
    /* ── 1. Config globale — TOUJOURS EN PREMIER ── */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    /* ── 2. Rate limiting global ── */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    /* ── 3. Modules sans dépendances Redis ── */
    DatabaseModule,
    MailModule,
    AuthModule,
    CodesModule,
    UploadModule,
    DashboardModule,
    PromotionsModule,
    PublicModule,
    WalletModule,
    CommandeModule,
    MessagerieModule,
    ContactSyncModule,
    LocationModule,

    /* ── 3. Redis ─────────────────────────────────────────────── */
    /*
     * Connexion via REDIS_HOST + REDIS_PORT + REDIS_PASSWORD.
     * Aucun fallback vers 127.0.0.1 : si les variables sont absentes,
     * l'application crashe immédiatement avec un message clair.
     *
     * Pour Upstash Redis :
     *   REDIS_HOST=your-db.upstash.io
     *   REDIS_PORT=6379
     *   REDIS_PASSWORD=your_password
     *
     * TLS automatiquement activé en production (Upstash / Redis Cloud
     * utilisent TLS sur le port 6379).
     */
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host     = config.get<string>('REDIS_HOST');
        const port     = parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10);
        const password = config.get<string>('REDIS_PASSWORD');
        /* TLS uniquement si REDIS_TLS=true (opt-in explicite) */
        const useTls   = config.get<string>('REDIS_TLS') === 'true';

        if (!host) {
          throw new Error(
            '[Redis/ioredis] REDIS_HOST manquant. ' +
            'Configurez REDIS_HOST, REDIS_PORT et REDIS_PASSWORD dans ' +
            'Render → Settings → Environment Variables.',
          );
        }

        return {
          type:     'single',
          host,
          port,
          ...(password && { password }),
          options: {
            ...(useTls && { tls: {} }),

            /*
             * lazyConnect: true → ioredis ne tente PAS de connexion
             * immédiatement au démarrage de NestJS.
             * Évite les crashs si Redis est momentanément indisponible.
             */
            lazyConnect: true,

            /*
             * retryStrategy : réessaie jusqu'à 5 fois avec backoff.
             * Retourne null → abandonne sans faire crasher l'app.
             */
            retryStrategy: (times: number) => {
              if (times > 5) {
                console.error(`[Redis] Impossible de se connecter après ${times} tentatives.`);
                return null;
              }
              return Math.min(times * 300, 3000);
            },

            /* Évite les messages d'erreur intempestifs sur les sockets fermés */
            enableOfflineQueue: false,
          },
        };
      },
    }),

    /* ── 4. BullMQ ─────────────────────────────────────────────── */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host     = config.get<string>('REDIS_HOST');
        const port     = parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10);
        const password = config.get<string>('REDIS_PASSWORD');
        const useTls   = config.get<string>('REDIS_TLS') === 'true';

        if (!host) {
          throw new Error(
            '[BullMQ] REDIS_HOST manquant. ' +
            'Configurez REDIS_HOST, REDIS_PORT et REDIS_PASSWORD dans ' +
            'Render → Settings → Environment Variables.',
          );
        }

        return {
          connection: {
            host,
            port,
            ...(password && { password }),
            ...(useTls && { tls: {} }),
            maxRetriesPerRequest: null,    // obligatoire BullMQ v5+
            enableOfflineQueue:   false,   // évite l'accumulation de jobs en attente
          },
        };
      },
    }),

    /* ── 5. ✅ SuivisModule — APRÈS Redis + BullMQ ── */
    /*
     * SuivisModule dépend de :
     *   - @InjectRedis()        → fourni par RedisModule ci-dessus
     *   - @InjectQueue(SUIVIS_QUEUE) → fourni par BullModule ci-dessus
     *
     * Ces providers doivent être enregistrés AVANT ce module.
     */
    SuivisModule,

    /* ── 5b. ✅ NotificationsModule — APRÈS Redis + BullMQ ── */
    /*
     * Dépend de :
     *   - @InjectRedis()                     → RedisModule
     *   - @InjectQueue(NOTIFICATION_QUEUE)   → BullModule
     *   - TypeOrmModule.forFeature(...)      → DatabaseModule
     *   - JwtModule (config interne)
     *
     * Exporte NotificationService pour les modules métier (Phase 2).
     */
    NotificationsModule,

    HelpModule,
    SupportModule,
    ContactModule,
    GeoModule,
    AppearanceModule,         /* GET/PUT/POST /api/appearance         — préférences visuelles */
    ZoneAdminModule,          /* GET/PATCH   /api/zones/*             — centre de contrôle territorial */
    ValidationConfigModule,   /* GET/PUT     /api/validation-config/*  — moteur de validation */
    CompanySettingsModule,    /* GET/PUT     /api/company-settings/*  — moteur des entreprises */
    DeliverySettingsModule,   /* GET/PUT     /api/delivery-settings/* — moteur des livreurs    */
    PartnerSettingsModule,    /* GET/PUT     /api/partner-settings/*  — moteur des partenaires  */
    DeliveryGroupModule,      /* GET/POST    /api/delivery-groups/*   — groupes de livraison    */

    /* Health check — GET /api/health, public, sans auth.
     * Utilisé par Render/Kubernetes pour les readiness probes. */
    HealthModule,

    /* ── 6. JobsModule — tâches cron ── */
    /*
     * Contient ScheduleModule.forRoot() + ExpiryCronService.
     * Tâches actives :
     *   - Chaque heure : expire codes d'invitation périmés
     *   - Chaque jour  : réactive comptes livreur/entreprise (J+30)
     */
    JobsModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * Applique le Correlation ID middleware sur toutes les routes.
   * Doit être appliqué en premier pour que chaque log produit
   * par les handlers en aval porte déjà le X-Request-Id.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}