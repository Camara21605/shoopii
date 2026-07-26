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
   * Réessaie toutes les 3 secondes, max 20 fois.
   * Retourne null pour arrêter les retry.
   */
  retryStrategy: (times: number) => {
    if (times > 20) {
      logger.error(`Redis : impossible de se connecter après ${times} tentatives. Vérifiez que Redis est démarré.`);
      return null; // arrêter les tentatives
    }
    const delay = Math.min(times * 500, 3000); // max 3s entre les tentatives
    logger.warn(`Redis : tentative ${times} — reconnexion dans ${delay}ms`);
    return delay;
  },

  /** Pas de timeout bloquant au démarrage */
  lazyConnect:              true,
  maxRetriesPerRequest:     null,
  enableReadyCheck:         false,
};