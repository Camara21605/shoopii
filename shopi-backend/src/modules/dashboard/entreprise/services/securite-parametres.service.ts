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
import { UpdateTwoFaDto, UpdatePasswordDto } from '../dto/update-securite.dto';

@Injectable()
export class SecuriteParametresService {

  private readonly logger = new Logger(SecuriteParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer le mot de passe
   * Le mot de passe est stocké dans user.entity.ts
   * ────────────────────────────────────────────────────────── */

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<{ message: string }> {
    // Validation : les deux nouveaux mots de passe doivent correspondre
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    // Récupérer l'utilisateur avec le hash du mot de passe
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const SALT_ROUNDS = 12;
    user.password = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.userRepo.save(user);

    this.logger.log(`[MOT DE PASSE] Changé — userId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Activer / configurer la 2FA (section 9)
   * ────────────────────────────────────────────────────────── */

  async updateTwoFa(userId: string, dto: UpdateTwoFaDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    company.twoFaEnabled = dto.twoFaEnabled;

    if (dto.twoFaEnabled && dto.twoFaMethod) {
      company.twoFaMethod = dto.twoFaMethod;
      // TODO : Si method = "app", générer le secret TOTP via otplib
      // et retourner le QR code à afficher au front
    }

    if (!dto.twoFaEnabled) {
      // Désactivation : effacer la méthode et le secret
      company.twoFaMethod = null;
      company.twoFaSecret = null;
    }

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[2FA] ${dto.twoFaEnabled ? 'Activée' : 'Désactivée'} — userId=${userId}`);

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
  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
