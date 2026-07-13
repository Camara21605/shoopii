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
import * as crypto          from 'crypto';

import { Admin } from '../../../../database/entities/profiles/admin-profile.entity';
import { User }  from '../../../../database/entities/user.entity';

/* ─── Alphabet Base32 RFC 4648 ──────────────────────────────── */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode des octets aléatoires en Base32 (RFC 4648, sans padding).
 * Utilisé pour générer les secrets TOTP compatibles avec
 * Google Authenticator et Authy sans dépendance externe.
 */
function encodeBase32(buffer: Buffer): string {
  let bits = 0, value = 0, output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

/** Génère un secret TOTP de 20 octets encodé en Base32 */
function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

/**
 * Construit l'URI otpauth:// standard (RFC 6238).
 * Le frontend transforme cet URI en QR code avec react-qr-code
 * ou l'affiche sous forme de lien cliquable ("Ouvrir dans Authenticator").
 */
function buildOtpAuthUri(secret: string, account: string, issuer = 'Shopi Africa'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1` +
    `&digits=6` +
    `&period=30`
  );
}

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
   * PATCH — Activer / désactiver la 2FA
   *
   * Activation (twoFaEnabled: true, twoFaMethod: 'app') :
   *   → Génère un secret TOTP Base32.
   *   → Retourne l'URI otpauth:// et le secret texte.
   *   → Le frontend affiche le QR code pour scan dans l'app.
   *
   * Désactivation (twoFaEnabled: false) :
   *   → Efface le secret stocké.
   * ────────────────────────────────────────────────────────── */
  async toggleTwoFa(
    userId: string,
    dto: { twoFaEnabled: boolean; twoFaMethod?: string },
  ) {
    /* Charger admin + email pour l'URI TOTP */
    const admin = await this.adminRepo.findOne({
      where:     { userId },
      relations: ['user'],
    });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');

    admin.twoFaEnabled = dto.twoFaEnabled;

    /* ── Désactivation ── */
    if (!dto.twoFaEnabled) {
      admin.twoFaMethod = null;
      admin.twoFaSecret = null;
      await this.adminRepo.save(admin);

      this.logger.log(`[2FA] Désactivée — adminUserId=${userId}`);
      return { twoFaEnabled: false, message: '2FA désactivée.' };
    }

    /* ── Activation ── */
    admin.twoFaMethod = dto.twoFaMethod ?? 'app';

    if (admin.twoFaMethod === 'app') {
      /* Génération du secret TOTP et de l'URI */
      const secret     = generateTotpSecret();
      const account    = admin.user.email;
      const otpAuthUri = buildOtpAuthUri(secret, account);

      admin.twoFaSecret = secret;
      await this.adminRepo.save(admin);

      this.logger.log(`[2FA] Activée (TOTP app) — adminUserId=${userId}`);

      return {
        twoFaEnabled: true,
        method:       'app',
        /* URI pour générer le QR code côté frontend */
        otpAuthUri,
        /* Secret affiché pour saisie manuelle dans l'app */
        secret,
        message: 'Scannez le QR code avec Google Authenticator ou Authy.',
      };
    }

    /* ── Autres méthodes (sms / email) : pas de TOTP ── */
    admin.twoFaSecret = null;
    await this.adminRepo.save(admin);

    this.logger.log(`[2FA] Activée (${admin.twoFaMethod}) — adminUserId=${userId}`);
    return {
      twoFaEnabled: true,
      method:       admin.twoFaMethod,
      message:      `2FA activée via ${admin.twoFaMethod === 'sms' ? 'SMS' : 'email'}.`,
    };
  }
}
