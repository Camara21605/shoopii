/* ============================================================
 * FICHIER : src/modules/auth/strategies/jwt.strategy.ts
 * RÔLE    : Stratégie Passport qui valide le JWT et attache
 *           l'utilisateur complet à req.user.
 *
 * Appelée automatiquement par JwtAuthGuard sur chaque requête
 * portant un Authorization: Bearer <token>.
 * ============================================================ */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy }                  from '@nestjs/passport';
import { ExtractJwt, Strategy }              from 'passport-jwt';
import { ConfigService }                     from '@nestjs/config';
import { InjectRepository }                  from '@nestjs/typeorm';
import { Repository }                        from 'typeorm';

import { User, UserStatus }  from '../../../database/entities/user.entity';

// ── Payload stocké dans le JWT ────────────────────────────────────────────────
export interface JwtPayload {
  sub:   string;   // UUID de l'utilisateur
  email: string;
  role:  string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(
    config: ConfigService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('JWT_SECRET') as string,
    });
  }

  /**
   * validate()
   * Appelé après la vérification de la signature JWT.
   * Retourne l'objet qui sera attaché à req.user.
   *
   * On recharge l'utilisateur depuis la base à chaque requête pour :
   *   - Détecter les comptes bannis/suspendus en temps réel
   *   - Avoir toujours les données fraîches (rôle, statut…)
   */
  async validate(payload: JwtPayload): Promise<User> {
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

    return user;
  }
}