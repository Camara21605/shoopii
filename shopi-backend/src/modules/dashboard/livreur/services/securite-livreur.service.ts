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
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }     from 'src/database/entities/user.entity';
import { UpdateLivreurPasswordDto, UpdateLivreurTwoFaDto } from '../dto/livreur-parametres.dto';

@Injectable()
export class SecuriteLivreurService {

  private readonly logger = new Logger(SecuriteLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
  ) {}

  async getSecurite(userId: string) {
    const livreur = await this.findOrFail(userId);
    return { twoFaEnabled: livreur.twoFaEnabled, twoFaMethod: livreur.twoFaMethod };
  }

  async updatePassword(userId: string, dto: UpdateLivreurPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id','password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.save(user);
    this.logger.log(`[MOT DE PASSE] Changé — userId=${userId}`);
    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  async updateTwoFa(userId: string, dto: UpdateLivreurTwoFaDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    livreur.twoFaEnabled = dto.twoFaEnabled;
    if (dto.twoFaEnabled && dto.twoFaMethod) {
      livreur.twoFaMethod = dto.twoFaMethod;
      // TODO : si method='app', générer secret TOTP + QR code
    }
    if (!dto.twoFaEnabled) {
      livreur.twoFaMethod = null;
      livreur.twoFaSecret = null;
    }
    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[2FA] ${dto.twoFaEnabled ? 'Activée' : 'Désactivée'} — userId=${userId}`);
    return updated;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}