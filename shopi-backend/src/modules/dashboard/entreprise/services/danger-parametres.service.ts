/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/danger-parametres.service.ts
 *
 * RÔLE : Gère la zone sensible (section 12)
 *   PATCH /parametres/danger/pause       → mettre en pause la boutique
 *   PATCH /parametres/danger/desactiver  → désactiver 30 jours
 *   DELETE /parametres/danger/supprimer  → suppression définitive
 *
 * TOUTES CES ACTIONS NÉCESSITENT :
 *   1. Le mot de passe actuel de l'utilisateur (confirmation)
 *   2. Un audit log (TODO : NotificationsService.audit())
 * ============================================================ */

import {
  Injectable, NotFoundException, UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';

import {
  Company,
  CompanyStatus,
} from 'src/database/entities/profiles/entreprise-profile.entity';
import { User } from 'src/database/entities/user.entity';

/* ── DTO de confirmation (mot de passe requis pour toute action sensible) ── */
export class DangerConfirmDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

@Injectable()
export class DangerParametresService {

  private readonly logger = new Logger(DangerParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre la boutique en pause
   * La boutique est masquée mais toutes les données sont conservées.
   * ────────────────────────────────────────────────────────── */

  async pauseBoutique(userId: string, dto: DangerConfirmDto): Promise<{ message: string }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);

    company.status = CompanyStatus.SUSPENDED;
    await this.companyRepo.save(company);

    this.logger.warn(`[DANGER] Boutique mise en pause — userId=${userId}`);
    return { message: 'Boutique mise en pause. Réactivez-la depuis les paramètres.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver le compte 30 jours
   * Identique à la pause, mais avec une date de réactivation auto.
   * ────────────────────────────────────────────────────────── */

  async desactiverCompte(userId: string, dto: DangerConfirmDto): Promise<{ message: string; reactivationAt: Date }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);

    const reactivationAt = new Date();
    reactivationAt.setDate(reactivationAt.getDate() + 30);

    company.status         = CompanyStatus.SUSPENDED;
    company.suspendedUntil = reactivationAt;

    await this.companyRepo.save(company);
    this.logger.warn(
      `[DANGER] Boutique désactivée 30j — userId=${userId} | réactivation le ${reactivationAt.toISOString()}`,
    );
    return {
      message:         'Compte désactivé. Il sera réactivé automatiquement dans 30 jours.',
      reactivationAt,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer définitivement la boutique
   * ACTION IRRÉVERSIBLE — supprime le profil Company + cascade
   * ────────────────────────────────────────────────────────── */

  async supprimerBoutique(userId: string, dto: DangerConfirmDto): Promise<{ message: string }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);

    // La suppression CASCADE efface aussi products, horaires, etc.
    await this.companyRepo.remove(company);

    this.logger.error(`[DANGER] ⚠️ Boutique SUPPRIMÉE — userId=${userId} | companyId=${company.id}`);
    return { message: 'Boutique supprimée définitivement.' };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  /**
   * Vérifie que le mot de passe fourni correspond bien au compte.
   * Appelé AVANT toute action sensible.
   */
  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
    }
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
