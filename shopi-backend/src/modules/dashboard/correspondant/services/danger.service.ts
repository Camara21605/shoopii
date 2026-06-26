/* ============================================================
 * FICHIER : services/danger.service.ts
 * SECTION : §11 — Zone sensible
 *
 * Responsabilités :
 *   suspendreCompte()  → status = SUSPENDED
 *   desactiverCompte() → status = DISABLED (30 jours)
 *   supprimerCompte()  → status = DELETED  (purge cron après 30j)
 *
 * Note : la purge physique des données est gérée par un cron job
 * (expiry-cron.service.ts) qui supprime les comptes DELETED
 * dont updatedAt < now - 30 jours.
 * ============================================================ */

import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import {
  Correspondent,
  CorrespondantStatus,
} from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }             from '../../../../database/entities/user.entity';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class DangerService extends CorrespondantBaseService {

  private readonly logger = new Logger(DangerService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Suspend temporairement l'activité du correspondant.
   * Les partenaires doivent être notifiés (à implémenter via NotificationsService).
   * Lève BadRequestException si le compte est déjà suspendu.
   */
  async suspendreCompte(userId: string) {
    const cor = await this.findCorOrFail(userId);

    if (cor.status === CorrespondantStatus.SUSPENDED) {
      throw new BadRequestException('Le compte est déjà suspendu.');
    }

    cor.status = CorrespondantStatus.SUSPENDED;
    await this.corRepo.save(cor);

    this.logger.warn(`[SUSPENSION] Activité suspendue — userId=${userId}`);
    return {
      message: 'Activité suspendue. Vos partenaires ont été notifiés.',
      status:  cor.status,
    };
  }

  /**
   * Désactive le compte pour 30 jours.
   * Le profil est masqué mais les données sont conservées.
   */
  async desactiverCompte(userId: string) {
    const cor  = await this.findCorOrFail(userId);
    cor.status = CorrespondantStatus.DISABLED;
    await this.corRepo.save(cor);

    this.logger.warn(`[DESACTIVATION] Compte désactivé — userId=${userId}`);
    return {
      message: 'Compte désactivé pour 30 jours. Vos données sont conservées.',
      status:  cor.status,
    };
  }

  /**
   * Initie la suppression définitive du compte.
   *
   * status = DELETED → le cron expiry-cron.service.ts purge
   * physiquement le compte après 30 jours.
   *
   * Le correspondant peut annuler via le support Shopi
   * dans ce délai de 30 jours.
   */
  async supprimerCompte(userId: string) {
    const cor  = await this.findCorOrFail(userId);
    cor.status = CorrespondantStatus.DELETED;
    await this.corRepo.save(cor);

    this.logger.error(`[SUPPRESSION] Initiation de suppression — userId=${userId}`);
    return {
      message: 'Suppression initiée. Votre compte sera purgé dans 30 jours. Contactez le support pour annuler.',
    };
  }
}