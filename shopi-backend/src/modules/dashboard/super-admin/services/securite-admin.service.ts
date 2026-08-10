/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/securite-admin.service.ts
 *
 * RÔLE : Sécurité du compte administrateur.
 *
 * ENDPOINTS servis (via ModerationController) :
 *   GET   /dashboard/super-admin/my-securite          → score + 2FA + infos session
 *   PATCH /dashboard/super-admin/my-securite/password → changer le mot de passe
 *   PATCH /dashboard/super-admin/my-securite/2fa      → activer / désactiver la 2FA
 *
 * PATTERNS :
 *   - Le mot de passe est hashé avec bcrypt (rounds = 12).
 *   - La 2FA utilise TOTP (RFC 6238) via un secret Base32 généré côté
 *     backend et un URI otpauth:// compatible Google Authenticator / Authy.
 *   - Le score de sécurité est calculé dynamiquement à partir des champs
 *     User et Admin (emailVerified, phoneVerified, twoFaEnabled…).
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Admin } from '../../../../database/entities/profiles/admin-profile.entity';
import { User }  from '../../../../database/entities/user.entity';

/* Génération/vérification TOTP réelle : voir TwoFaService
 * (src/modules/auth/twofa/twofa.service.ts), qui est l'unique source
 * de vérité pour les 6 rôles — voir POST /auth/2fa/setup + /confirm. */

/* ─── Poids des indicateurs du score de sécurité ──────────── */
/* Chaque critère vaut 20 points → score max = 100 */
const SCORE_WEIGHT = 20;

/* ═══════════════════════════════════════════════════════════════
 * SERVICE
 * ═══════════════════════════════════════════════════════════════ */
@Injectable()
export class SecuriteAdminService {

  private readonly logger = new Logger(SecuriteAdminService.name);

  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(User)  private readonly userRepo:  Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Score de sécurité + statut 2FA + infos session
   * ────────────────────────────────────────────────────────── */
  async getSecurite(userId: string) {
    /* Charger admin + user en une seule requête */
    const admin = await this.adminRepo.findOne({
      where:     { userId },
      relations: ['user'],
    });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');

    /* ── Critères du score de sécurité ── */
    const scoreItems = [
      /* Mot de passe : toujours vrai (hash bcrypt en base → mot de passe défini) */
      { label: 'Mot de passe défini',       ok: !!admin.user.password, key: 'password' },
      /* 2FA configurée */
      { label: 'Authentification 2FA',      ok: admin.twoFaEnabled,   key: 'twoFa'    },
      /* Email vérifié */
      { label: 'E-mail vérifié',            ok: admin.user.emailVerified, key: 'email' },
      /* Téléphone renseigné et vérifié */
      { label: 'Téléphone vérifié',         ok: admin.user.phoneVerified, key: 'phone' },
      /* Compte actif (pas suspendu) */
      { label: 'Compte en bonne santé',     ok: admin.status === 'active', key: 'status' },
    ];

    const score = scoreItems.filter(i => i.ok).length * SCORE_WEIGHT;

    return {
      /* Score et détail des critères */
      score,
      scoreItems,

      /* Statut 2FA */
      twoFaEnabled: admin.twoFaEnabled,
      twoFaMethod:  admin.twoFaMethod ?? null,

      /* Informations de session (champs User) */
      lastLoginAt: admin.user.lastLoginAt   ?? null,
      lastLoginIp: admin.user.lastLoginIp   ?? null,
      emailVerified: admin.user.emailVerified,
      phoneVerified: admin.user.phoneVerified,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   *
   * Validation :
   *   1. Les deux nouveaux mots de passe correspondent.
   *   2. Le nouveau est différent de l'ancien.
   *   3. L'ancien mot de passe bcrypt est correct.
   * ────────────────────────────────────────────────────────── */
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string; confirmPassword: string },
  ): Promise<{ message: string }> {

    /* Validation des champs */
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les deux nouveaux mots de passe ne correspondent pas.');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'actuel.');
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }

    /* Charger le hash (select: false par défaut → sélection explicite) */
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'password'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    /* Vérifier l'ancien mot de passe */
    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    /* Hasher et sauvegarder le nouveau (cost factor 12) */
    user.password            = await bcrypt.hash(dto.newPassword, 12);
    user.lastPasswordChangedAt = new Date();
    await this.userRepo.save(user);

    this.logger.log(`[SÉCURITÉ] Mot de passe changé — adminUserId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver la 2FA
   *
   * L'activation réelle (secret + vérification TOTP) passe désormais
   * par POST /auth/2fa/setup puis /auth/2fa/confirm (TwoFaService),
   * qui n'active la 2FA qu'après un code valide — un secret jamais
   * confirmé ne bascule plus jamais twoFaEnabled à true. Cet endpoint
   * ne permet plus qu'une désactivation directe.
   * ────────────────────────────────────────────────────────── */
  async toggleTwoFa(
    userId: string,
    dto: { twoFaEnabled: boolean; twoFaMethod?: string },
  ) {
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');

    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }

    admin.twoFaEnabled = false;
    admin.twoFaMethod  = null;
    admin.twoFaSecret  = null;
    await this.adminRepo.save(admin);

    this.logger.log(`[2FA] Désactivée — adminUserId=${userId}`);
    return { twoFaEnabled: false, message: '2FA désactivée.' };
  }
}
