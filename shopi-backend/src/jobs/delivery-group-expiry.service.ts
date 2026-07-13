import { Injectable, Logger } from '@nestjs/common';
import { Cron }               from '@nestjs/schedule';
import { DeliveryGroupService } from '../modules/delivery-group/delivery-group.service';

/**
 * Vérifie toutes les heures les groupes de livraison complétés
 * et les marque EXPIRED lorsque leur délai de 72h est dépassé.
 */
@Injectable()
export class DeliveryGroupExpiryService {
  private readonly logger = new Logger(DeliveryGroupExpiryService.name);

  constructor(private readonly groupSvc: DeliveryGroupService) {}

  @Cron('0 0 * * * *') // chaque heure pile
  async handleExpiry(): Promise<void> {
    this.logger.debug('[DeliveryGroupExpiry] Vérification expiration groupes...');
    await this.groupSvc.expireCompletedGroups();
  }
}
