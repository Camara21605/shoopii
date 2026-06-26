/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/danger-livreur.service.ts
 * RÔLE : Section 10 — Zone sensible
 *   PATCH  /parametres/danger/pause      → mettre en pause
 *   PATCH  /parametres/danger/desactiver → désactiver 30j
 *   DELETE /parametres/danger/supprimer  → suppression définitive
 * Toutes ces actions requièrent le mot de passe de confirmation.
 * ============================================================ */

import {
  Injectable, NotFoundException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Delivery, LivreurStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }                    from 'src/database/entities/user.entity';
import { LivreurDangerConfirmDto } from '../dto/livreur-parametres.dto';

@Injectable()
export class DangerLivreurService {

  private readonly logger = new Logger(DangerLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
  ) {}

  async pauseCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);
    livreur.status = LivreurStatus.PENDING;
    await this.livreurRepo.save(livreur);
    this.logger.warn(`[DANGER] Compte mis en pause — userId=${userId}`);
    return { message: 'Compte mis en pause. Réactivez depuis les paramètres.' };
  }

  async desactiverCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);
    livreur.status = LivreurStatus.SUSPENDED;
    // TODO : cron job pour réactivation automatique J+30
    await this.livreurRepo.save(livreur);
    this.logger.warn(`[DANGER] Compte désactivé 30j — userId=${userId}`);
    return { message: 'Compte désactivé. Réactivation automatique dans 30 jours.' };
  }

  async supprimerCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);
    await this.livreurRepo.remove(livreur);
    this.logger.error(`[DANGER] ⚠️ Compte SUPPRIMÉ — userId=${userId} | livreurId=${livreur.id}`);
    return { message: 'Compte supprimé définitivement.' };
  }

  private async verifyPassword(userId: string, password: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id','password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}