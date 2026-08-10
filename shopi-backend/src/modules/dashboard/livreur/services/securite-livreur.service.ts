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

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }     from 'src/database/entities/user.entity';
import { RefreshToken } from 'src/database/entities/refresh-token.entity';
import { UpdateLivreurPasswordDto, UpdateLivreurTwoFaDto } from '../dto/livreur-parametres.dto';

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class SecuriteLivreurService {

  private readonly logger = new Logger(SecuriteLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
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
    /* Invalide les JWT émis avant ce changement (JwtStrategy compare iat
     * à lastPasswordChangedAt) — ce champ n'était jamais mis à jour ici. */
    user.lastPasswordChangedAt = new Date();
    await this.userRepo.save(user);

    /* Révoque toutes les sessions actives (refresh tokens). */
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });

    this.logger.log(`[MOT DE PASSE] Changé + tokens révoqués — userId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver le 2FA
   *
   * L'activation réelle (secret + vérification TOTP) passe par
   * POST /auth/2fa/setup puis /auth/2fa/confirm (TwoFaService), qui
   * n'active la 2FA qu'après un code valide. Cet endpoint ne permet
   * plus qu'une désactivation directe.
   * ────────────────────────────────────────────────────────── */
  async updateTwoFa(userId: string, dto: UpdateLivreurTwoFaDto) {
    const livreur = await this.findOrFail(userId);

    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }

    livreur.twoFaEnabled = false;
    livreur.twoFaMethod  = null;
    livreur.twoFaSecret  = null;
    await this.livreurRepo.save(livreur);
    this.logger.log(`[2FA] Désactivée — userId=${userId}`);
    return { twoFaEnabled: false, message: '2FA désactivée avec succès.' };
  }

  /* ── Helper ── */
  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}
