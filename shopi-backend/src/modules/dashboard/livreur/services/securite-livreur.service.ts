/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/securite-livreur.service.ts
 * RÔLE : Section 7 — Sécurité (mot de passe + 2FA + sessions)
 *   GET   /parametres/securite          → statut 2FA
 *   PATCH /parametres/securite/password → changer le mot de passe
 *   PATCH /parametres/securite/2fa      → activer/configurer 2FA
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';
import * as crypto          from 'crypto';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }     from 'src/database/entities/user.entity';
import { UpdateLivreurPasswordDto, UpdateLivreurTwoFaDto } from '../dto/livreur-parametres.dto';

/* ── Alphabet Base32 RFC 4648 ─────────────────────────────── */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode des octets aléatoires en Base32 (RFC 4648).
 * Utilisé pour générer les secrets TOTP compatibles
 * Google Authenticator / Authy sans dépendance externe.
 */
function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
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

/** Génère un secret TOTP de 20 octets encodé Base32 */
function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

/**
 * Construit l'URI otpauth:// standard.
 * Le frontend peut transformer cet URI en QR code
 * avec n'importe quelle bibliothèque (qrcode, react-qr-code…).
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

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class SecuriteLivreurService {

  private readonly logger = new Logger(SecuriteLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Statut 2FA
   * ────────────────────────────────────────────────────────── */
  async getSecurite(userId: string) {
    const livreur = await this.findOrFail(userId);
    return {
      twoFaEnabled: livreur.twoFaEnabled,
      twoFaMethod:  livreur.twoFaMethod,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   * ────────────────────────────────────────────────────────── */
  async updatePassword(userId: string, dto: UpdateLivreurPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'actuel.');
    }

    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'password'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.save(user);
    this.logger.log(`[MOT DE PASSE] Changé — userId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Activer / Configurer / Désactiver le 2FA
   *
   * Quand method='app' ET activation demandée :
   *   → génère un secret TOTP Base32
   *   → retourne le secret + l'URI otpauth:// pour le QR code
   *   → le frontend affiche le QR code à l'utilisateur
   *   → après scan dans Google Authenticator, l'utilisateur
   *     soumet le code OTP pour confirmer l'activation
   *     (vérification OTP = endpoint séparé à venir)
   * ────────────────────────────────────────────────────────── */
  async updateTwoFa(userId: string, dto: UpdateLivreurTwoFaDto) {
    const livreur = await this.findOrFail(userId);
    const user    = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'email', 'firstName', 'lastName'],
    });

    livreur.twoFaEnabled = dto.twoFaEnabled;

    /* ── Désactivation ── */
    if (!dto.twoFaEnabled) {
      livreur.twoFaMethod = null;
      livreur.twoFaSecret = null;
      await this.livreurRepo.save(livreur);
      this.logger.log(`[2FA] Désactivée — userId=${userId}`);
      return { twoFaEnabled: false, message: '2FA désactivée avec succès.' };
    }

    /* ── Activation ── */
    livreur.twoFaMethod = dto.twoFaMethod ?? 'app';

    if (livreur.twoFaMethod === 'app') {
      /* Génération du secret TOTP */
      const secret  = generateTotpSecret();
      const account = user?.email ?? livreur.email ?? userId;
      const otpUri  = buildOtpAuthUri(secret, account);

      livreur.twoFaSecret = secret;
      await this.livreurRepo.save(livreur);
      this.logger.log(`[2FA] Activée (app TOTP) — userId=${userId}`);

      return {
        twoFaEnabled: true,
        method:       'app',
        /* Le frontend utilise otpAuthUri pour générer le QR code */
        otpAuthUri:   otpUri,
        /* Affiché en texte pour saisie manuelle dans l'app */
        secret,
        message:      'Scannez le QR code avec Google Authenticator ou Authy pour finaliser.',
      };
    }

    /* ── SMS ou Email : pas de secret TOTP à générer ── */
    livreur.twoFaSecret = null;
    await this.livreurRepo.save(livreur);
    this.logger.log(`[2FA] Activée (${livreur.twoFaMethod}) — userId=${userId}`);

    return {
      twoFaEnabled: true,
      method:       livreur.twoFaMethod,
      message:      `2FA activée via ${livreur.twoFaMethod === 'sms' ? 'SMS' : 'email'}.`,
    };
  }

  /* ── Helper ── */
  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}
