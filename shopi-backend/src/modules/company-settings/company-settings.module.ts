/* ============================================================
 * FICHIER : src/modules/company-settings/company-settings.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanySetting }           from './company-settings.entity';
import { CompanySettingsService }   from './company-settings.service';
import { CompanySettingsController } from './company-settings.controller';
import { Admin }    from '../../database/entities/profiles/admin-profile.entity';
import { Category } from '../../database/entities/entreprise.table/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanySetting, Admin, Category]),
  ],
  providers:   [CompanySettingsService],
  controllers: [CompanySettingsController],
})
export class CompanySettingsModule {}
