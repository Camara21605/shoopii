/* ============================================================
 * FICHIER : src/common/middleware/maintenance.middleware.ts
 *
 * RÔLE : Applique réellement PlatformSettings.maintenanceMode.
 *
 * BUG CORRIGÉ — le toggle "Maintenance" (Paramètres Plateforme >
 * Danger) se sauvegardait bien en base, mais rien nulle part ne le
 * lisait pour bloquer quoi que ce soit : c'était un interrupteur
 * cosmétique qui ne coupait jamais réellement l'accès à la plateforme,
 * malgré le commentaire de l'entité qui promet explicitement
 * "désactive l'accès à tous les utilisateurs non-admin"
 * (platform-settings.entity.ts).
 *
 * DESIGN — middleware Express brut (comme csrf.middleware.ts), pas un
 * NestMiddleware/Guard :
 *   - Enregistré tôt via app.use() dans main.ts, avant tout routage
 *     Nest → un seul point de blocage pour TOUTE la plateforme.
 *   - Décide par PRÉFIXE DE CHEMIN plutôt qu'en décodant le JWT
 *     soi-même (pas de logique d'auth dupliquée/divergente) :
 *     /api/auth, /api/health et les deux dashboards admin passent
 *     toujours — mais restent protégés en dessous par leurs propres
 *     JwtAuthGuard/RolesGuard existants, donc laisser passer un
 *     visiteur anonyme vers /api/dashboard/super-admin ici n'ouvre
 *     aucune brèche : il se fait rejeter par le guard, pas par ce
 *     middleware.
 *   - Lit via PlatformSettingsCacheService (Redis, <1ms, voir ce
 *     service) plutôt qu'un SELECT direct à chaque requête : ce
 *     middleware s'exécute sur CHAQUE appel de TOUTE la plateforme,
 *     le budget de latence doit rester quasi nul.
 *   - Panne de la vérification elle-même (DB/Redis inaccessibles) →
 *     laisse passer plutôt que de bloquer toute la plateforme sur une
 *     panne du mécanisme de garde lui-même (fail-open volontaire ici,
 *     à l'inverse d'un guard de sécurité qui devrait fail-closed —
 *     la disponibilité prime sur la maintenance planifiée en cas de
 *     défaillance infra).
 * ============================================================ */

import type { Request, Response, NextFunction } from 'express';
import type { PlatformSettingsCacheService } from '../../modules/performance-engine/services/platform-settings-cache.service';

/** Toujours accessibles, même en maintenance — voir le design ci-dessus. */
const ALWAYS_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/api/dashboard/super-admin',
  '/api/dashboard/administrateur',
];

export function maintenanceGuard(settingsCache: PlatformSettingsCacheService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (ALWAYS_ALLOWED_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
      next();
      return;
    }

    let maintenanceMode = false;
    try {
      const settings = await settingsCache.getSettings();
      maintenanceMode = settings.maintenanceMode;
    } catch {
      // Impossible de vérifier → on ne bloque pas la plateforme sur une
      // panne du mécanisme de vérification lui-même (voir design ci-dessus).
      next();
      return;
    }

    if (!maintenanceMode) {
      next();
      return;
    }

    res.status(503).json({
      statusCode:  503,
      message:     'La plateforme Shopi est actuellement en maintenance. Merci de réessayer dans quelques instants.',
      maintenance: true,
    });
  };
}
