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

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { SuivisModule }      from './modules/suivis/suivis.module';
import { MessagerieModule } from './modules/messagerie/messagerie.module';
import { LocationModule }   from './modules/location/location.module';

@Module({
  imports: [
    /* ── 1. Config globale — TOUJOURS EN PREMIER ── */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    /* ── 2. Modules sans dépendances Redis ── */
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
    LocationModule,

    /* ── 3. ✅ Redis — AVANT SuivisModule ── */
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379',
        options: {
          /**
           * lazyConnect: true
           * ─────────────────
           * La connexion n'est établie qu'au PREMIER appel Redis.
           * Sans cette option, ioredis tente de se connecter
           * immédiatement au démarrage, ce qui flood la console
           * si Redis n'est pas encore disponible.
           */
          lazyConnect: true,

          /**
           * retryStrategy
           * ─────────────
           * Réessaie jusqu'à 5 fois avec un délai croissant.
           * Retourne null pour arrêter (évite les boucles infinies).
           */
          retryStrategy: (times: number) => {
            if (times > 5) return null;
            return Math.min(times * 200, 2000);
          },
        },
      }),
    }),

    /* ── 4. ✅ BullMQ — AVANT SuivisModule ── */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        /*
         * Construire la connexion depuis REDIS_URL si disponible,
         * sinon utiliser REDIS_HOST + REDIS_PORT.
         *
         * Cohérence avec RedisModule ci-dessus.
         */
        const url  = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST') ?? '127.0.0.1';
        const port = parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10);

        return {
          connection: url
            ? { url }          /* ← si REDIS_URL est défini dans .env */
            : { host, port,    /* ← sinon utiliser host + port séparés */

                /**
                 * maxRetriesPerRequest: null
                 * ──────────────────────────
                 * OBLIGATOIRE pour BullMQ v5+.
                 * Sans cette option, BullMQ lève une erreur au démarrage :
                 * "maxRetriesPerRequest must be null for BullMQ to work"
                 */
                maxRetriesPerRequest: null,
              },
        };
      },
    }),

    /* ── 5. ✅ SuivisModule — EN DERNIER ── */
    /*
     * SuivisModule dépend de :
     *   - @InjectRedis()        → fourni par RedisModule ci-dessus
     *   - @InjectQueue(SUIVIS_QUEUE) → fourni par BullModule ci-dessus
     *
     * Ces providers doivent être enregistrés AVANT ce module.
     */
    SuivisModule,
  ],
})
export class AppModule {}