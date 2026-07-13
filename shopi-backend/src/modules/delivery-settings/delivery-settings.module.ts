/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.module.ts
 * ============================================================ */

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';

import { DeliverySetting }           from './delivery-settings.entity';
import { DeliverySettingsService }   from './delivery-settings.service';
import { DeliverySettingsController }from './delivery-settings.controller';
import { Admin }                     from '../../database/entities/profiles/admin-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliverySetting, Admin]),
  ],
  controllers: [DeliverySettingsController],
  providers:   [DeliverySettingsService],
  exports:     [DeliverySettingsService],
})
export class DeliverySettingsModule {}
