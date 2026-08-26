/**
 * ============================================================
 * FICHIER : src/common/utils/redis-timeout.util.ts
 *
 * Borne chaque appel Redis ET mémorise une panne détectée pour ne
 * pas rejouer le timeout complet sur CHAQUE requête tant que la
 * panne dure.
 *
 * Incident prod du 26/08/2026 : Redis injoignable en continu.
 * SessionService.validateSession() (appelé sur CHAQUE requête HTTP
 * authentifiée via JwtStrategy) et PresenceService.getBulkPresence()
 * (appelé par la liste des conversations) avaient chacun leur propre
 * withTimeout() local — mais un `try/Promise.race` seul REESSAIE
 * puis réattend le timeout complet à chaque appel. Résultat : ~5-6s
 * de pure attente par clic pendant toute la durée de la panne, alors
 * que Redis ne répondrait de toute façon pas avant la fin de celle-ci.
 *
 * Le disjoncteur ci-dessous est PARTAGÉ (état de module) entre tous
 * les appelants : session, permissions, présence tapent le même
 * Redis, donc UNE panne détectée par l'un doit immédiatement court-
 * circuiter les autres, sans attendre que chacun échoue séparément.
 * ============================================================
 */
import type { Logger } from '@nestjs/common';

const BREAKER_COOLDOWN_MS = 10_000;

let lastFailureAt = 0;

export function withRedisTimeout<T>(
  op: () => Promise<T>,
  fallback: T,
  timeoutMs: number,
  logger: Logger,
  label: string,
): Promise<T> {
  if (Date.now() - lastFailureAt < BREAKER_COOLDOWN_MS) {
    return Promise.resolve(fallback);
  }

  return (async () => {
    try {
      const result = await Promise.race([
        op(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout après ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      lastFailureAt = 0;
      return result;
    } catch (err) {
      lastFailureAt = Date.now();
      logger.warn(`[RedisBreaker] Redis indisponible (${label}) — dégradation gracieuse : ${(err as Error).message}`);
      return fallback;
    }
  })();
}
