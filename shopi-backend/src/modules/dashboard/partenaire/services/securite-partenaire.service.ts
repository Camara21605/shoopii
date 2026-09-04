/* ============================================================
 * FICHIER : services/securite-partenaire.service.ts
 *
 * RÔLE : Section "Sécurité" du dashboard partenaire.
 *
 * Endpoints :
 *   GET    /parametres/securite        → statut 2FA
 *   PATCH  /parametres/securite/password  → changer le mot de passe
 *   PATCH  /parametres/securite/2fa       → activer / désactiver 2FA
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }    from 'src/database/entities/user.entity';
import { RefreshToken } from 'src/database/entities/refresh-token.entity';
import { SessionService } from 'src/modules/session/session.service';
import { parseUserAgent } from 'src/common/utils/user-agent.util';
import {
  UpdatePartenairePasswordDto,
  UpdatePartenaireTwoFaDto,
} from '../dto/partenaire-parametres.dto';

@Injectable()
export class SecuritePartenaireService {

  private readonly logger = new Logger(SecuritePartenaireService.name);

  constructor(
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(User)    private readonly userRepo:    Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly sessionService: SessionService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Statut de sécurité du compte
   *
   * BUG CORRIGÉ — `sessions` était codé en dur à `[]` ("feature à
   * brancher"), et le frontend affichait deux lignes 100% inventées
   * ("Android · Conakry", "Windows · Conakry") sans lien avec la vraie
   * activité du compte, avec un bouton "Déconnecter" qui ne faisait
   * qu'un toast local sans rien révoquer côté serveur.
   *
   * Shoneya impose UNE SEULE session active par compte (voir
   * SessionService, Redis `active_session:{userId}`) — se connecter
   * ailleurs remplace atomiquement la session précédente. Il ne peut
   * donc jamais exister plusieurs appareils "actifs" simultanément à
   * afficher : on expose la VRAIE session actuelle (device/navigateur/IP
   * réels, lus depuis Redis) plutôt que de simuler une liste multi-
   * appareils qui contredirait le modèle de sécurité réel de la
   * plateforme. Le bouton "Déconnecter" du frontend réutilise la
   * déconnexion normale (POST /auth/logout, déjà réelle et testée).
   * ────────────────────────────────────────────────────────── */
  async getSecurite(userId: string, currentSessionId?: string | null) {
    const partner = await this.findOrFail(userId);
    const meta = await this.sessionService.getSessionMeta(currentSessionId);
    return {
      twoFaEnabled: partner.twoFaEnabled,
      twoFaMethod:  partner.twoFaMethod,
      currentSession: meta ? {
        ...parseUserAgent(meta.userAgent),
        ipAddress:      meta.ipAddress,
        connectedSince: meta.createdAt,
      } : null,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   * Valide l'ancien mot de passe (bcrypt) avant d'accepter le nouveau.
   * ────────────────────────────────────────────────────────── */
  async updatePassword(userId: string, dto: UpdatePartenairePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'actuel.');
    }

    /* Charge uniquement les champs nécessaires (performance + sécurité) */
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
   * POST /auth/2fa/setup puis /auth/2fa/confirm (TwoFaService).
   * Cet endpoint ne permet plus qu'une désactivation directe.
   * ────────────────────────────────────────────────────────── */
  async updateTwoFa(userId: string, dto: UpdatePartenaireTwoFaDto) {
    const partner = await this.findOrFail(userId);

    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }

    partner.twoFaEnabled = false;
    partner.twoFaMethod  = null;
    partner.twoFaSecret  = null;
    await this.partnerRepo.save(partner);
    this.logger.log(`[2FA] Désactivée — userId=${userId}`);
    return { twoFaEnabled: false, message: '2FA désactivée avec succès.' };
  }

  /* ── Helper ── */
  async findOrFail(userId: string): Promise<Partner> {
    const p = await this.partnerRepo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Profil partenaire introuvable.');
    return p;
  }
}
