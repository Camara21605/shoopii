/* ============================================================
 * FICHIER : src/modules/auth/auth.module.ts
 * ============================================================ */

import { Module }            from '@nestjs/common';
import { TypeOrmModule }     from '@nestjs/typeorm';
import { JwtModule }         from '@nestjs/jwt';
import { PassportModule }    from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController }      from './auth.controller';
import { AuthService }         from './auth.service';
import { AccountLinkService }  from './account-link.service';
import { JwtStrategy }         from './strategies/jwt.strategy';
import { GoogleStrategy }      from './strategies/google.strategy';
import { CodeCreationService } from './code-creation/code-creation.service';
import { TwoFaService }        from './twofa/twofa.service';
import { MailModule }          from '../email/email.module';
import { SessionModule }       from '../session/session.module';
import { NotificationsModule } from '../notifications/notifications.module';

// ── Entité principale ─────────────────────────────────────────
import { User }              from '../../database/entities/user.entity';
import { CreationCode }      from '../../database/entities/code-creation.entity';

// ── Profils acteurs ✅ AJOUTÉS ────────────────────────────────
import { Admin }             from '../../database/entities/profiles/admin-profile.entity';
import { Partner }           from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }           from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }          from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }     from '../../database/entities/profiles/correspondant-profile.entity';
import { Client }            from '../../database/entities/profiles/client-profile.entity';

// ── Wallet ✅ AJOUTÉ ──────────────────────────────────────────
import { Wallet }            from '../../database/entities/wallet.entity';
// ── Company Team Member (détection collaborateurs au login) ──
import { CompanyTeamMember } from '../../database/entities/company-team/company-team-member.entity';
// ── Auth — journalisation, refresh tokens, comptes liés ─────────
import { AuthLog }      from '../../database/entities/auth-log.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AccountLink }  from '../../database/entities/account-link.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CreationCode,
      Admin,
      Partner,
      Company,
      Delivery,
      Correspondent,
      Client,
      Wallet,
      CompanyTeamMember,
      AuthLog,
      RefreshToken,
      AccountLink,
    ]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),

    MailModule,
    NotificationsModule,
    SessionModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountLinkService,
    JwtStrategy,
    GoogleStrategy,
    CodeCreationService,
    TwoFaService,
  ],
  exports: [AuthService, JwtModule, PassportModule, TwoFaService, SessionModule],
})
export class AuthModule {}