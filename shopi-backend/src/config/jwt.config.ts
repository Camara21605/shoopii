/* ============================================================
 * FICHIER      : src/config/jwt.config.ts
 * MODULE       : Config
 * ROLE         : Centralisation de la configuration JWT (tokens d'accès et refresh).
 *
 * RESPONSABILITES (à implémenter) :
 *   - Exposer les constantes de durée de vie des tokens (accessToken, refreshToken).
 *   - Exposer les noms des variables d'environnement JWT pour éviter les magic strings.
 *
 * ÉTAT ACTUEL :
 *   Ce fichier est un placeholder vide. La configuration JWT est définie directement
 *   dans src/modules/auth/auth.module.ts via JwtModule.registerAsync().
 *
 * CONFIGURATION JWT ACTUELLE (dans auth.module.ts) :
 *   - JWT_SECRET          → signe les access tokens (expiry: 15min)
 *   - JWT_REFRESH_SECRET  → signe les refresh tokens (expiry: 7 jours)
 *   - Double secret = compromission d'un access token n'expose pas les refresh tokens.
 *
 * EXEMPLE D'IMPLÉMENTATION :
 *   import { ConfigService } from '@nestjs/config';
 *   import { JwtModuleAsyncOptions } from '@nestjs/jwt';
 *
 *   export const ACCESS_TOKEN_EXPIRY  = '15m';
 *   export const REFRESH_TOKEN_EXPIRY = '7d';
 *
 *   export const jwtModuleConfig = (config: ConfigService): JwtModuleAsyncOptions => ({
 *     useFactory: () => ({
 *       secret:      config.get<string>('JWT_SECRET'),
 *       signOptions: { expiresIn: ACCESS_TOKEN_EXPIRY },
 *     }),
 *   });
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */
