/* ============================================================
 * FICHIER : src/modules/auth/strategies/google.strategy.ts
 * RÔLE    : Stratégie Passport OAuth2 Google.
 *           Valide le token Google et retourne le profil
 *           utilisateur normalisé pour AuthService.googleLogin().
 * ============================================================ */

import { Injectable }      from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService }   from '@nestjs/config';

export interface GoogleProfile {
  email:     string;
  firstName: string;
  lastName:  string;
  picture:   string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {

  constructor(config: ConfigService) {
    super({
      /*
       * Fallback 'not_configured' : évite le crash au démarrage si les
       * variables Google ne sont pas encore dans le .env.
       * Le flux OAuth échouera proprement (erreur Google côté navigateur)
       * mais le serveur reste opérationnel.
       */
      clientID:     config.get<string>('GOOGLE_CLIENT_ID')     ?? 'not_configured',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'not_configured',
      callbackURL:  config.get<string>('GOOGLE_CALLBACK_URL')
                    ?? 'http://localhost:3001/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken:  string,
    _refreshToken: string,
    profile:       any,
    done:          VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos } = profile;
    const user: GoogleProfile = {
      email:     emails?.[0]?.value ?? '',
      firstName: name?.givenName    ?? '',
      lastName:  name?.familyName   ?? '',
      picture:   photos?.[0]?.value ?? null,
    };
    done(null, user);
  }
}
