/* ============================================================
 * FICHIER : services/notifications.service.ts
 * SECTION : §9 — Notifications
 *
 * Responsabilités :
 *   updateNotifications() → notifSettings (JSON structuré)
 *
 * Structure JSON attendue :
 * {
 *   colis:    { nouveauColis, colisEnAttente48h, transfertLivreur, colisRecupere, saturation80 },
 *   finances: { commissionEncaissee, virementEffectue, bilanHebdo, seuilWallet },
 *   canaux:   { push, sms, whatsapp, email }
 * }
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateNotificationsDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class NotificationsService extends CorrespondantBaseService {

  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour toutes les préférences de notifications.
   * Le JSON complet est remplacé à chaque appel.
   */
  async updateNotifications(userId: string, dto: UpdateNotificationsDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.notifSettings !== undefined) cor.notifSettings = dto.notifSettings ?? null;

    const updated = await this.corRepo.save(cor);
    this.logger.log(`[NOTIFS] Préférences mises à jour — userId=${userId}`);
    return updated;
  }
}