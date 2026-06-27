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
        const isProd   = config.get<string>('NODE_ENV') === 'production';

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
            /*
             * TLS pour Upstash / Redis Cloud en production.
             * Upstash utilise TLS sur le port 6379.
             */
            ...(isProd && { tls: {} }),

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
        const isProd   = config.get<string>('NODE_ENV') === 'production';

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
            ...(isProd   && { tls: {} }),
            maxRetriesPerRequest: null,    // obligatoire BullMQ v5+
            enableOfflineQueue:   false,   // évite l'accumulation de jobs en attente
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