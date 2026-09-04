/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/securite-parametres.service.ts
 *
 * RÔLE : Gère la sécurité du compte (section 9)
 *   PATCH /parametres/securite/password  → changer le mot de passe
 *   PATCH /parametres/securite/2fa       → activer/configurer la 2FA
 *   GET   /parametres/securite/sessions  → voir les sessions actives (TODO WebSocket)
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }    from 'src/database/entities/user.entity';
import { RefreshToken } from 'src/database/entities/refresh-token.entity';
import { UpdateTwoFaDto, UpdatePasswordDto } from '../dto/update-securite.dto';

@Injectable()
export class SecuriteParametresService {

  private readonly logger = new Logger(SecuriteParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   * Le mot de passe est stocké dans user.entity.ts
   * ────────────────────────────────────────────────────────── */

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    /* FIX I1 — Sélectionner aussi lastPasswordChangedAt pour pouvoir le mettre à jour. */
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password', 'lastPasswordChangedAt'],
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const SALT_ROUNDS = 12;
    user.password = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    /* FIX I1 — Invalider les tokens JWT émis AVANT ce changement.
     * jwt.strategy.ts vérifie que iat >= lastPasswordChangedAt :
     * tous les anciens tokens (jusqu'à 7 jours en rememberMe) sont
     * révoqués instantanément, même s'ils n'ont pas encore expiré. */
    user.lastPasswordChangedAt = new Date();

    await this.userRepo.save(user);

    /* Révoque toutes les sessions actives — un refresh token volé sur un
     * autre appareil ne doit pas survivre à un changement de mot de passe
     * volontaire. */
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });

    this.logger.log(`[MOT DE PASSE] Changé + tokens révoqués — userId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Activer / configurer la 2FA (section 9)
   *
   * L'activation réelle (secret + vérification) passe désormais par
   * POST /auth/2fa/setup puis /auth/2fa/confirm (TwoFaService), qui
   * n'active la 2FA qu'après un code TOTP valide. Cet endpoint ne
   * permet plus qu'une désactivation directe — l'activer sans jamais
   * vérifier un code ne protégeait rien.
   * ────────────────────────────────────────────────────────── */

  async updateTwoFa(userId: string, dto: UpdateTwoFaDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.twoFaEnabled) {
      throw new BadRequestException(
        "Activez la 2FA via POST /auth/2fa/setup puis /auth/2fa/confirm (vérification du code requise).",
      );
    }

    company.twoFaEnabled = false;
    company.twoFaMethod  = null;
    company.twoFaSecret  = null;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[2FA] Désactivée — userId=${userId}`);

    return updated;
  }

  /* ──────────────────────────────────────────────────────────
   * GET — Statut sécurité actuel
   * ────────────────────────────────────────────────────────── */

  async getSecurite(userId: string) {
    const company = await this.findCompanyOrFail(userId);

    return {
      twoFaEnabled: company.twoFaEnabled,
      twoFaMethod:  company.twoFaMethod,
      // Les sessions actives seront gérées via Redis / JWT blacklist
    };
  }

  /* ── HELPER ── */
  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
