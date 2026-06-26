/* ============================================================
 * FICHIER : services/securite.service.ts
 * SECTION : §8 — Sécurité & Connexion
 *
 * Responsabilités :
 *   updateSecurite()  → twoFaEnabled, twoFaMethod (dans Correspondent)
 *   changePassword()  → User.password + User.lastPasswordChangedAt
 *
 * Note importante :
 *   Le mot de passe est dans User (pas dans Correspondent).
 *   changePassword() doit forcer la sélection via QueryBuilder
 *   car password a select:false dans l'entité User.
 * ============================================================ */

import {
  Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateSecuriteDto, ChangePasswordDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService }             from './base.service';

@Injectable()
export class SecuriteService extends CorrespondantBaseService {

  private readonly logger = new Logger(SecuriteService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Active/désactive la 2FA et définit la méthode.
   * Seuls twoFaEnabled et twoFaMethod sont dans Correspondent.
   * Le secret 2FA (twoFaSecret) est géré séparément via un flux TOTP.
   */
  async updateSecurite(userId: string, dto: UpdateSecuriteDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.twoFaEnabled !== undefined) cor.twoFaEnabled = dto.twoFaEnabled;
    if (dto.twoFaMethod  !== undefined) cor.twoFaMethod  = dto.twoFaMethod ?? null;

    const updated = await this.corRepo.save(cor);
    this.logger.log(`[2FA] enabled=${cor.twoFaEnabled} method=${cor.twoFaMethod} — userId=${userId}`);
    return updated;
  }

  /**
   * Change le mot de passe de l'utilisateur.
   *
   * Étapes :
   *   1. Charger User.password via QueryBuilder (select:false → pas dans findOne)
   *   2. Vérifier l'ancien mot de passe avec bcrypt.compare
   *   3. Hacher le nouveau avec bcrypt (12 rounds)
   *   4. Mettre à jour User.password + User.lastPasswordChangedAt
   *      (lastPasswordChangedAt invalide les JWT antérieurs)
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    /* Forcer la sélection du champ password (select:false dans user.entity.ts) */
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('user.id = :id', { id: userId })
      .addSelect('user.password')
      .getOne();

    if (!user) throw new Error('Utilisateur introuvable.');

    /* Vérifier l'ancien mot de passe */
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    /* Hacher et sauvegarder le nouveau */
    user.password              = await bcrypt.hash(dto.newPassword, 12);
    user.lastPasswordChangedAt = new Date();
    await this.userRepo.save(user);

    this.logger.log(`[MOT DE PASSE] Changé dans User — userId=${userId}`);
    return { message: 'Mot de passe modifié avec succès.' };
  }
}