/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/securite-admin.service.ts
 *
 * RÔLE : Sécurité du compte administrateur (Paramètres → Sécurité).
 *
 * ENDPOINTS servis (via ModerationController) :
 *   GET   /dashboard/super-admin/my-securite          → score + 2FA + session
 *   PATCH /dashboard/super-admin/my-securite/password → changer le mot de passe
 *   PATCH /dashboard/super-admin/my-securite/2fa      → désactiver la 2FA
 *
 * PATTERNS :
 *   - Mot de passe hashé avec bcrypt (12 rounds) ; changement = tokens de
 *     rafraîchissement révoqués + e-mail d'alerte (comme les autres rôles).
 *   - 2FA TOTP : activation via POST /auth/2fa/setup + /confirm (TwoFaService).
 *   - Score calculé dynamiquement depuis les vrais champs User/Admin.
 *   - Session actuelle lue depuis Redis (SessionService) — vrai appareil,
 *     navigateur et IP, pas un texte fixe.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService }    from '@nestjs/config';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Admin }        from '../../../../database/entities/profiles/admin-profile.entity';
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { RefreshToken } from '../../../../database/entities/refresh-token.entity';
import { TwoFaService } from '../../../auth/twofa/twofa.service';
import { SessionService } from '../../../session/session.service';
import { MailService }  from '../../../email/email.service';
import { parseUserAgent } from '../../../../common/utils/user-agent.util';
import { getPrimaryFrontendUrl } from '../../../../common/utils/frontend-url.util';
import { ChangeMyPasswordDto, UpdateMyTwoFaDto } from '../dto/my-securite.dto';

/* Chaque critère vaut 20 points → score max = 100 */
const SCORE_WEIGHT = 20;

@Injectable()
export class SecuriteAdminService {

  private readonly logger = new Logger(SecuriteAdminService.name);

  constructor(
    @InjectRepository(Admin)        private readonly adminRepo:        Repository<Admin>,
    @InjectRepository(User)         private readonly userRepo:         Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly twoFaService:   TwoFaService,
    private readonly sessionService: SessionService,
    private readonly mailService:    MailService,
    private readonly config:         ConfigService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Score de sécurité + statut 2FA + session actuelle
   * ────────────────────────────────────────────────────────── */
  async getSecurite(userId: string, currentSessionId?: string | null) {
    const admin = await this.adminRepo.findOne({ where: { userId }, relations: ['user'] });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');

    /* BUG CORRIGÉ — `User.password` est en `select: false` : via la relation
     * `admin.user` il valait toujours `undefined`, donc « Mot de passe défini »
     * s'affichait « Manquant » pour tout le monde. Lecture explicite du hash. */
    const withPwd = await this.userRepo.findOne({
      where: { id: userId }, select: ['id', 'password', 'lastPasswordChangedAt'],
    });
    const hasPassword = !!withPwd?.password;

    /* BUG CORRIGÉ — « Compte en bonne santé » se basait sur admin.status, resté
     * 'pending' à vie ; le statut réel est celui du compte utilisateur. */
    const accountHealthy = admin.user.status === UserStatus.ACTIVE;

    const scoreItems = [
      { key: 'password', label: 'Mot de passe défini', ok: hasPassword,
        hint: 'Définissez un mot de passe.' },
      { key: 'twoFa', label: 'Authentification 2FA', ok: admin.twoFaEnabled,
        hint: 'Activez la double authentification (carte « 2FA » ci-dessous).' },
      { key: 'email', label: 'E-mail vérifié', ok: !!admin.user.emailVerified,
        hint: 'Confirmez votre adresse e-mail.' },
      { key: 'phone', label: 'Téléphone vérifié', ok: !!admin.user.phoneVerified,
        hint: admin.user.phone || admin.phone
          ? 'Faites vérifier votre numéro de téléphone.'
          : 'Renseignez votre numéro dans l\'onglet Profil.' },
      { key: 'status', label: 'Compte en bonne santé', ok: accountHealthy,
        hint: 'Votre compte n\'est pas actif : contactez le super-administrateur.' },
    ];

    const score = scoreItems.filter(i => i.ok).length * SCORE_WEIGHT;

    const meta = await this.sessionService.getSessionMeta(currentSessionId);

    return {
      score,
      level: score >= 80 ? 'bon' : score >= 60 ? 'moyen' : 'faible',
      pending: scoreItems.filter(i => !i.ok).length,
      scoreItems,

      twoFaEnabled: admin.twoFaEnabled,
      twoFaMethod:  admin.twoFaMethod ?? null,

      lastLoginAt:       admin.user.lastLoginAt ?? null,
      lastLoginIp:       admin.user.lastLoginIp ?? null,
      passwordChangedAt: withPwd?.lastPasswordChangedAt ?? null,
      emailVerified:     admin.user.emailVerified,
      phoneVerified:     admin.user.phoneVerified,

      /* Session actuelle réelle (Shoneya n'autorise qu'UNE session active par
       * compte : il n'y a jamais de liste d'appareils à afficher). */
      currentSession: meta
        ? { ...parseUserAgent(meta.userAgent), ipAddress: meta.ipAddress, connectedSince: meta.createdAt }
        : null,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   *
   * Validation (format : ChangeMyPasswordDto) : confirmation identique,
   * différent de l'actuel, ancien mot de passe correct.
   * Effets : JWT antérieurs invalidés (lastPasswordChangedAt), refresh
   * tokens révoqués, e-mail d'alerte envoyé. La session courante est donc
   * fermée : le frontend reconnecte l'administrateur.
   * ────────────────────────────────────────────────────────── */
  async changePassword(userId: string, dto: ChangeMyPasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les deux nouveaux mots de passe ne correspondent pas.');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    /* select: false par défaut → sélection explicite du hash */
    const user = await this.userRepo.findOne({
      where: { id: userId }, select: ['id', 'password', 'email', 'firstName'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    user.password              = await bcrypt.hash(dto.newPassword, 12);
    user.lastPasswordChangedAt = new Date();
    await this.userRepo.save(user);

    /* Sans cette révocation, un refresh token volé sur un autre appareil
     * survivrait au changement de mot de passe (voir SecuriteService client). */
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });

    /* Alerte e-mail — fire-and-forget : un échec SMTP ne doit jamais faire
     * échouer le changement lui-même. Toujours envoyée pour un compte admin. */
    this.mailService.sendPasswordChangedEmail({
      toEmail:   user.email,
      firstName: user.firstName,
      changedAt: user.lastPasswordChangedAt!,
      loginUrl:  `${getPrimaryFrontendUrl(this.config)}/login`,
    }).catch(err => this.logger.error(`[PWD CHANGED EMAIL ❌] ${user.email} | ${(err as Error).message}`));

    this.logger.log(`[SÉCURITÉ] Mot de passe changé + tokens révoqués — adminUserId=${userId}`);
    return { message: 'Mot de passe mis à jour. Reconnectez-vous avec le nouveau mot de passe.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver la 2FA
   *
   * L'activation passe par POST /auth/2fa/setup puis /confirm (aucun secret
   * non confirmé n'active la 2FA). La désactivation exige le mot de passe ET
   * un code TOTP valide : un compte admin est la cible la plus sensible, une
   * session volée ne doit jamais suffire à retirer ce second facteur.
   * ────────────────────────────────────────────────────────── */
  async toggleTwoFa(userId: string, dto: UpdateMyTwoFaDto) {
    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }
    if (!dto.currentPassword || !dto.code) {
      throw new BadRequestException('Mot de passe actuel et code de vérification requis.');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    await this.twoFaService.disable(user, dto.currentPassword, dto.code);

    this.logger.log(`[2FA] Désactivée — adminUserId=${userId}`);
    return { twoFaEnabled: false, message: '2FA désactivée.' };
  }
}
