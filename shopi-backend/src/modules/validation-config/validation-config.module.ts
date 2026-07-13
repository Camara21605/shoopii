/* ============================================================
 * FICHIER : src/modules/validation-config/validation-config.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ValidationConfig }           from './validation-config.entity';
import { ValidationConfigService }    from './validation-config.service';
import { ValidationConfigController } from './validation-config.controller';
import { Admin }                      from '../../database/entities/profiles/admin-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ValidationConfig, Admin]),
  ],
  providers:   [ValidationConfigService],
  controllers: [ValidationConfigController],
})
export class ValidationConfigModule {}
