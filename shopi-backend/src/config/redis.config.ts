/* ============================================================
 * FICHIER : src/config/redis.config.ts
 *
 * Configuration Redis centralisée avec :
 *   - Variables d'environnement
 *   - Retry automatique (ne crash pas si Redis est temporairement down)
 *   - Logs des tentatives de reconnexion
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