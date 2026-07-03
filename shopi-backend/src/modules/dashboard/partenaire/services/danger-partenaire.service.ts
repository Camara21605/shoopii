/* ============================================================
 * FICHIER : services/danger-partenaire.service.ts
 *
 * RÔLE : Zone danger — actions irréversibles sur le compte.
 *
 * SÉCURITÉ : Toutes les actions exigent le mot de passe actuel
 *   confirmé par bcrypt avant d'être exécutées.
 *
 * Endpoints :
 *   PATCH  /parametres/danger/pause      → suspend l'activité (PENDING)
 *   PATCH  /parametres/danger/desactiver → désactive 30j (SUSPENDED)
 *   DELETE /parametres/danger/supprimer  → supprime le profil partenaire
 * ============================================================ */

import {
  Injectable, NotFoundException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Partner, PartnerStatus } from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }                   from 'src/database/entities/user.entity';
import { PartenaireDangerConfirmDto }  from '../dto/partenaire-parametres.dto';

@Injectable()
export class DangerPartenaireService {

  private readonly logger = new Logger(DangerPartenaireService.name);

  constructor(
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(User)    private readonly userRepo:    Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre le compte en pause (réversible)
   * Le partenaire reste enregistré mais n'est plus actif.
   * ────────────────────────────────────────────────────────── */
  async pauseCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);

    partner.status = PartnerStatus.PENDING;
    await this.partnerRepo.save(partner);

    this.logger.warn(`[DANGER] Compte mis en pause — userId=${userId}`);
    return { message: 'Compte mis en pause. Réactivez depuis les paramètres.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver temporairement (30 jours)
   * Réactivation automatique après 30 jours.
   * ────────────────────────────────────────────────────────── */
  async desactiverCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);

    const reactivationAt = new Date();
    reactivationAt.setDate(reactivationAt.getDate() + 30);

    partner.status         = PartnerStatus.SUSPENDED;
    partner.suspendedUntil = reactivationAt;

    await this.partnerRepo.save(partner);
    this.logger.warn(
      `[DANGER] Compte désactivé 30j — userId=${userId} | réactivation=${reactivationAt.toISOString()}`,
    );
    return {
      message:         'Compte désactivé. Réactivation automatique dans 30 jours.',
      reactivationAt,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Suppression définitive du profil partenaire
   * Supprime l'entité Partner (User reste intact mais sans rôle
   * partenaire actif). Les acteurs recrutés conservent leur compte.
   * ────────────────────────────────────────────────────────── */
  async supprimerCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);

    await this.partnerRepo.remove(partner);

    this.logger.error(
      `[DANGER] ⚠️ Compte partenaire SUPPRIMÉ — userId=${userId} | partnerId=${partner.id}`,
    );
    return { message: 'Compte partenaire supprimé définitivement.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PRIVATE — Vérification bcrypt du mot de passe
   * Centralise la vérification pour toutes les actions danger.
   * ────────────────────────────────────────────────────────── */
  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'password'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
    }
  }

  /* ── Helper ── */
  async findOrFail(userId: string): Promise<Partner> {
    const p = await this.partnerRepo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Profil partenaire introuvable.');
    return p;
  }
}
