/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.module.ts
 * ============================================================ */

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';

import { DeliverySetting }           from './delivery-settings.entity';
import { DeliverySettingsService }   from './delivery-settings.service';
import { DeliverySettingsController }from './delivery-settings.controller';
import { Admin }                     from '../../database/entities/profiles/admin-profile.entity';
import { PlatformSettings }          from '../../database/entities/platform-settings.entity';
import { CommissionModule }          from '../commission/commission.module';
import { PerformanceModule }         from '../performance-engine/performance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliverySetting, Admin, PlatformSettings]),
    CommissionModule,  // pour CommissionConfigService (resynchronise CommissionRule quand platformCommissionRate change)
    PerformanceModule, // pour PlatformSettingsCacheService (invalide le cache Redis PlatformSettings)
  ],
  controllers: [DeliverySettingsController],
  providers:   [DeliverySettingsService],
  exports:     [DeliverySettingsService],
})
export class DeliverySettingsModule {}
