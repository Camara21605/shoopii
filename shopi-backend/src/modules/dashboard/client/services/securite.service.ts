/* ============================================================
 * src/modules/dashboard/client/services/securite.service.ts
 * FIX : early return dans chaque getOrCreate
 * ============================================================ */

import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository }        from '@nestjs/typeorm';
import { ConfigService }           from '@nestjs/config';
import { getPrimaryFrontendUrl }   from '../../../../common/utils/frontend-url.util';
import { DeepPartial, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

import { User }         from '../../../../database/entities/user.entity';
import { Client }       from '../../../../database/entities/profiles/client-profile.entity';
import { RefreshToken } from '../../../../database/entities/refresh-token.entity';
import {
  ChangePasswordDto, UpdateSecuriteDto,
  UpdateAlertSettingDto,
} from '../dto/client-parametres.dto';
import { MailService } from '../../../email/email.service';
import { SecurityAlertsService, AlertSettings } from '../../../security-alerts/security-alerts.service';
import { TwoFaService } from '../../../auth/twofa/twofa.service';
import { ActiviteService } from './activite.service';

const CODE_SECOURS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I ambigus

@Injectable()
export class SecuriteService {
  private readonly logger = new Logger(SecuriteService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,

    private readonly mailService:          MailService,
    private readonly securityAlertsService: SecurityAlertsService,
    private readonly config:                ConfigService,
    private readonly twoFaService:          TwoFaService,
    private readonly journal:               ActiviteService,
  ) {}

  /* ✅ FIX — early return, jamais null */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;
    const created = this.clientRepo.create({ userId } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  /* ── GET — statut sécurité ── */
  async getStatut(user: User) {
    const dbUser  = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    return {
      emailVerified:        dbUser.emailVerified,
      phoneVerified:        dbUser.phoneVerified,
      twoFaEnabled:         (profile as any)?.twoFaEnabled   ?? false,
      twoFaMethod:          (profile as any)?.twoFaMethod    ?? null,
      codesSecours:         (profile as any)?.codesSecours   ?? 0,
      dernierChangementMdp: dbUser.lastPasswordChangedAt,
    };
  }

  /* ── PATCH — mot de passe ── */
  async changePassword(user: User, dto: ChangePasswordDto): Promise<{ message: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(dto.currentPassword, dbUser.password);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect.');
    if (dto.newPassword.length < 8)
      throw new BadRequestException('Minimum 8 caractères requis.');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(dto.newPassword))
      throw new BadRequestException('Doit contenir une majuscule, une minuscule et un chiffre.');

    dbUser.password              = await bcrypt.hash(dto.newPassword, 12);
    dbUser.lastPasswordChangedAt = new Date();
    await this.userRepo.save(dbUser);

    /* Révoque toutes les sessions actives (refresh tokens) — sans ça, un
     * refresh token volé sur un autre appareil survivait à un changement
     * de mot de passe volontaire, ce qui va à l'encontre du but même de
     * cette action (reprendre le contrôle du compte). Même comportement
     * que la réinitialisation via "mot de passe oublié" (auth.service.ts). */
    await this.refreshTokenRepo.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );

    /* Alerte "changement de mot de passe" — respecte le réglage de
     * l'utilisateur (section Alertes de sécurité), contrairement au
     * même email envoyé par auth.service.ts::resetPassword() (flux
     * "mot de passe oublié", toujours envoyé sans condition — trop
     * critique pour une prise de contrôle de compte pour être
     * désactivable). Fire-and-forget : un échec SMTP ne doit jamais
     * faire échouer le changement de mot de passe lui-même. */
    this.securityAlertsService.isEnabled(user.id, 'mdp').then(enabled => {
      if (!enabled) return;
      this.mailService.sendPasswordChangedEmail({
        toEmail:   dbUser.email,
        firstName: dbUser.firstName,
        changedAt: dbUser.lastPasswordChangedAt!,
        loginUrl:  `${getPrimaryFrontendUrl(this.config)}/login`,
      }).catch(err => this.logger.error(`[PWD CHANGED EMAIL ❌] ${dbUser.email} | ${(err as Error).message}`));
    }).catch(() => {});

    this.journal.record(user.id, dbUser.role, 'password_changed');
    this.logger.log(`[PASSWORD CHANGE] userId=${user.id}`);
    return { message: 'Mot de passe modifié avec succès.' };
  }

  /* ── PATCH — 2FA (désactivation uniquement)
   * L'activation réelle (secret + vérification TOTP) passe par
   * POST /auth/2fa/setup puis /auth/2fa/confirm (TwoFaService), qui
   * n'active la 2FA qu'après un code valide. ── */
  async update2fa(user: User, dto: UpdateSecuriteDto): Promise<{ twoFaEnabled: boolean }> {
    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }
    /* Mot de passe + code TOTP requis — sinon une session volée (XSS,
     * token dérobé) suffirait à désactiver la 2FA sans jamais posséder
     * le second facteur, ce qui annule sa protection. */
    if (!dto.currentPassword || !dto.code) {
      throw new BadRequestException('Mot de passe actuel et code de vérification requis.');
    }
    await this.twoFaService.disable(user, dto.currentPassword, dto.code);
    /* Sans 2FA, les codes de secours sont inutiles : on les efface (à régénérer à la réactivation) */
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (profile) {
      (profile as any).codesSecours = 0;
      (profile as any).codesSecoursHashed = null;
      await this.clientRepo.save(profile);
    }
    return { twoFaEnabled: false };
  }

  /* ── POST — codes de secours ── */
  async genererCodesSecours(user: User): Promise<{ codes: string[] }> {
    const profile = await this.getOrCreate(user.id);                     // ✅ jamais null
    /* Un code de secours remplace le code TOTP au moment de la connexion : sans 2FA active il ne
     * servirait à rien (et donnerait un faux sentiment de sécurité). */
    if (!(profile as any).twoFaEnabled) {
      throw new BadRequestException("Activez d'abord l'authentification à deux facteurs : les codes de secours la remplacent si vous perdez votre application.");
    }
    /* crypto.randomInt (CSPRNG) plutôt que Math.random() — ces codes sont
     * un moyen d'authentification de secours, ils doivent être imprévisibles. */
    const codes   = Array.from({ length: 8 }, () =>
      Array.from({ length: 6 }, () => CODE_SECOURS_ALPHABET[randomInt(CODE_SECOURS_ALPHABET.length)]).join(''),
    );
    const hashed  = await Promise.all(codes.map(c => bcrypt.hash(c, 10)));
    (profile as any).codesSecoursHashed = JSON.stringify(hashed);
    (profile as any).codesSecours       = codes.length;
    await this.clientRepo.save(profile);
    this.logger.log(`[CODES SECOURS] userId=${user.id}`);
    return { codes };
  }

  /* ── GET — préférences d'alertes de sécurité ── */
  async getAlertSettings(user: User): Promise<AlertSettings> {
    return this.securityAlertsService.getSettings(user.id);
  }

  /* ── PATCH — une préférence d'alerte de sécurité (sauvegarde immédiate,
   * une case à la fois — même pattern que le reste de l'app) ── */
  async updateAlertSetting(user: User, dto: UpdateAlertSettingDto): Promise<AlertSettings> {
    return this.securityAlertsService.updateSetting(user.id, dto.type, dto.email);
  }
}