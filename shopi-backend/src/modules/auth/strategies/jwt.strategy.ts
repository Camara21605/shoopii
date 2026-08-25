/* ============================================================
 * FICHIER : src/modules/auth/strategies/jwt.strategy.ts
 * RÔLE    : Stratégie Passport qui valide le JWT et attache
 *           l'utilisateur complet à req.user.
 *
 * Ordre d'extraction du JWT :
 *   1. Cookie httpOnly « access_token » (prioritaire, résistant au XSS)
 *   2. Header Authorization: Bearer <token> (fallback API/mobile)
 *
 * Vérifications dans validate() :
 *   - Utilisateur existant en base
 *   - Statut non banni / non suspendu
 *   - Token émis APRÈS le dernier changement de mot de passe
 *     (invalide les tokens volés après un reset)
 * ============================================================ */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy }                  from '@nestjs/passport';
import { ExtractJwt, Strategy }              from 'passport-jwt';
import { ConfigService }                     from '@nestjs/config';
import { InjectRepository }                  from '@nestjs/typeorm';
import { Repository }                        from 'typeorm';
import type { Request }                      from 'express';

import { User, UserStatus } from '../../../database/entities/user.entity';
import { SessionService }   from '../../session/session.service';

// ── Payload stocké dans le JWT ────────────────────────────────────────────────
export interface JwtPayload {
  sub:      string;   // UUID de l'utilisateur (users.id)
  email:    string;
  role:     string;
  actorId?: string;   // UUID du profil (client.id, company.id, etc.)
  sid?:     string;   // Session ID — session unique par utilisateur (voir SessionService)
  iat?:     number;   // Issued At — Unix timestamp (secondes), ajouté automatiquement par jwtService.sign()
  exp?:     number;   // Expiration — Unix timestamp (secondes)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(
    config: ConfigService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly sessionService: SessionService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        '[JwtStrategy] JWT_SECRET est absent des variables d\'environnement. ' +
        'Ajoutez-le dans votre fichier .env avant de démarrer l\'application.',
      );
    }

    super({
      // Cookie httpOnly en priorité — pas accessible depuis JavaScript (XSS-proof).
      // Fallback Bearer pour les clients mobiles / API externes.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => req?.cookies?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:      secret,
    });
  }

  /**
   * validate()
   * Appelé après vérification réussie de la signature JWT.
   * Retourne l'objet attaché à req.user pour toute la durée de la requête.
   */
  async validate(payload: JwtPayload): Promise<User & { actorId?: string; sessionId?: string }> {

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('Token invalide — utilisateur introuvable.');
    }

    if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        `Votre compte est ${user.status === UserStatus.BANNED ? 'banni' : 'suspendu'}. ` +
        'Contactez le support Shopi.',
      );
    }

    // Si l'utilisateur a changé son mot de passe après l'émission du token,
    // le token est considéré révoqué — même s'il n'a pas encore expiré.
    // Protège contre les sessions volées avant un reset de mot de passe.
    if (user.lastPasswordChangedAt && payload.iat !== undefined) {
      const tokenIssuedAt   = new Date(payload.iat * 1000);
      const passwordChanged = new Date(user.lastPasswordChangedAt);
      if (passwordChanged > tokenIssuedAt) {
        throw new UnauthorizedException(
          'Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter.',
        );
      }
    }

    /* Même principe pour une déconnexion explicite : POST /auth/logout ne
     * révoque que les refresh tokens (JWT stateless — l'access token émis
     * reste, lui, cryptographiquement valide jusqu'à sa propre expiration).
     * Sans ce contrôle, un access token encore valide au moment du clic sur
     * "Déconnexion" continuait à authentifier normalement toute requête
     * (y compris une nouvelle vérification /auth/me après rechargement) —
     * l'utilisateur "redevenait" connecté malgré lui, et les gardes de
     * route basés sur cet état (PublicOnlyRoute) le renvoyaient alors hors
     * de /login au lieu d'afficher le formulaire de connexion. */
    if (user.lastLogoutAt && payload.iat !== undefined) {
      const tokenIssuedAt = new Date(payload.iat * 1000);
      const loggedOutAt   = new Date(user.lastLogoutAt);
      if (loggedOutAt > tokenIssuedAt) {
        throw new UnauthorizedException(
          'Session expirée suite à une déconnexion. Veuillez vous reconnecter.',
        );
      }
    }

    /* ── Session unique par utilisateur ─────────────────────────
     * Un token cryptographiquement valide n'est PAS forcément une
     * session valide : si un autre appareil s'est connecté depuis
     * (voir SessionService.startSession), le sessionId "sid" de ce
     * token ne correspond plus à la session active dans Redis — on
     * le rejette même s'il n'a pas encore expiré. `sid` absent
     * (tokens émis avant cette fonctionnalité) → pas de contrôle,
     * pour ne pas invalider en masse les sessions déjà ouvertes au
     * déploiement. */
    if (payload.sid) {
      const valid = await this.sessionService.validateSession(user.id, payload.sid);
      if (!valid) {
        throw new UnauthorizedException(
          'Votre compte a été connecté sur un autre appareil. Veuillez vous reconnecter.',
        );
      }
    }

    return Object.assign(user, { actorId: payload.actorId, sessionId: payload.sid });
  }
}
