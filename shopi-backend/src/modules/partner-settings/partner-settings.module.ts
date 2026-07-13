/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PartnerSetting }             from './partner-settings.entity';
import { PartnerSettingsService }     from './partner-settings.service';
import { PartnerSettingsController }  from './partner-settings.controller';
import { Admin }                      from '../../database/entities/profiles/admin-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartnerSetting, Admin]),
  ],
  controllers: [PartnerSettingsController],
  providers:   [PartnerSettingsService],
  exports:     [PartnerSettingsService],
})
export class PartnerSettingsModule {}
