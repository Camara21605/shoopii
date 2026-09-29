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
import { JwtService } from '@nestjs/jwt';
import type { PlatformSettingsCacheService } from '../../modules/performance-engine/services/platform-settings-cache.service';

/** Toujours accessibles, même en maintenance — voir le design ci-dessus.
 * BUG CORRIGÉ (audit 2026-09) — la liste contenait '/api/dashboard/administrateur', préfixe
 * qui n'existe pas (le tableau de bord admin est servi sous /api/dashboard/admin) : les admins
 * de zone étaient bloqués pendant la maintenance. */
const ALWAYS_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/api/dashboard/super-admin',
  '/api/dashboard/admin',
];

/** Rôles qui gardent TOUT leur accès pendant la maintenance. */
const ROLES_ADMINISTRATION = new Set(['admin', 'super_admin']);

/**
 * Jeton d'un administrateur, signature vérifiée (cookie httpOnly en priorité, puis Bearer —
 * même ordre que JwtStrategy).
 *
 * BUG CORRIGÉ (audit 2026-09) — seules les routes /dashboard/* passaient : pendant la
 * maintenance, le super-admin perdait le catalogue, le référentiel géographique, la santé du
 * système, le support… (servis sous d'autres préfixes). La signature étant vérifiée, un jeton
 * forgé ne passe pas ; les gardes habituels (session, statut du compte, rôles) s'appliquent
 * ensuite normalement.
 */
function estAdministrateur(req: Request, jwt: JwtService | null): boolean {
  if (!jwt) return false;
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const bearer  = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token   = cookies?.['access_token'] ?? bearer;
  if (!token) return false;
  try {
    const payload = jwt.verify<{ role?: string }>(token);
    return !!payload.role && ROLES_ADMINISTRATION.has(payload.role);
  } catch {
    return false;
  }
}

export function maintenanceGuard(settingsCache: PlatformSettingsCacheService, jwtSecret?: string) {
  const jwt = jwtSecret ? new JwtService({ secret: jwtSecret }) : null;
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

    /* Vérification du jeton seulement en maintenance : zéro coût le reste du temps. */
    if (!maintenanceMode || estAdministrateur(req, jwt)) {
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
