/* ============================================================
 * FICHIER      : src/config/redis.config.ts
 * MODULE       : Config
 * ROLE         : Configuration ioredis centralisée pour BullMQ et le cache.
 *
 * RESPONSABILITES :
 *   - Lire REDIS_HOST / REDIS_PORT / REDIS_PASSWORD depuis l'environnement.
 *   - Définir la stratégie de reconnexion automatique (max 20 tentatives).
 *   - Garantir la compatibilité avec BullMQ (lazyConnect + maxRetriesPerRequest=null).
 *
 * DEPENDANCES  :
 *   - ioredis — client Redis (installé via BullMQ)
 *   - @nestjs/common (Logger)
 *
 * CONSOMME PAR :
 *   - AppModule (BullModule.forRoot) — file d'attente des jobs
 *   - FinancialConfigEngine — cache des configurations financières
 *   - Tout module qui utilise BullMQ
 *
 * VARIABLES D'ENVIRONNEMENT :
 *   REDIS_HOST      — Adresse du serveur Redis (défaut: 127.0.0.1)
 *   REDIS_PORT      — Port Redis (défaut: 6379)
 *   REDIS_PASSWORD  — Mot de passe si Redis est sécurisé (optionnel)
 *
 * OPTIONS CRITIQUES :
 *   lazyConnect: true          — Connexion différée (BullMQ l'exige)
 *   maxRetriesPerRequest: null — Laisse BullMQ gérer les retries
 *   enableReadyCheck: false    — Compatible Redis Cloud / Upstash
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Logger } from '@nestjs/common';

const logger = new Logger('RedisConfig');

export const redisConfig = {
  host:     process.env.REDIS_HOST ?? '127.0.0.1',
  port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? undefined,

  /**
   * Stratégie de reconnexion automatique.
   * Réessaie indéfiniment (backoff jusqu'à 3s) — ne JAMAIS abandonner.
   *
   * Un `return null` ici tue la connexion pour de bon : les workers
   * BullMQ restent bloqués sur un stream mort et spamment
   * "Stream isn't writeable" à l'infini jusqu'au redémarrage manuel
   * du process, même après le retour de Redis. Une coupure réseau
   * transitoire (veille machine, Wi-Fi) ne doit jamais nécessiter
   * un restart manuel.
   */
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 500, 3000); // max 3s entre les tentatives
    if (times % 10 === 0) {
      logger.warn(`Redis : tentative ${times} — reconnexion dans ${delay}ms`);
    }
    return delay;
  },

  /** Pas de timeout bloquant au démarrage */
  lazyConnect:              true,
  maxRetriesPerRequest:     null,
  enableReadyCheck:         false,
};