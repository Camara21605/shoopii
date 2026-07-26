/* ============================================================
 * FICHIER      : src/common/decorators/public.decorator.ts
 * MODULE       : Common / Decorators
 * ROLE         : Décorateur @Public() — marque une route comme accessible sans JWT.
 *
 * RESPONSABILITES :
 *   - Définir la clé de métadonnée IS_PUBLIC_KEY.
 *   - Fournir le décorateur @Public() utilisable sur les controllers et méthodes.
 *
 * DEPENDANCES  : @nestjs/common (SetMetadata)
 * CONSOMME PAR : JwtAuthGuard (lit IS_PUBLIC_KEY via Reflector)
 *
 * PRECAUTION :
 *   Ne jamais renommer IS_PUBLIC_KEY sans mettre à jour JwtAuthGuard en même temps.
 *   La clé doit rester identique dans les deux fichiers.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { SetMetadata } from '@nestjs/common';

/** Clé utilisée par JwtAuthGuard pour détecter les routes publiques via Reflector. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public()
 * Appliqué sur une méthode ou un controller, bypass la vérification JWT.
 * La route reste accessible aux utilisateurs non authentifiés.
 *
 * USAGE :
 *   @Get('catalogue')
 *   @Public()
 *   findAll() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);