/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.module.ts
 * RÔLE    : Module NestJS du centre de contrôle territorial admin.
 * ================================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Admin }      from '../../database/entities/profiles/admin-profile.entity';
import { GeoZone }    from '../../database/entities/geo/geo-zone.entity';
import { GeoCommune } from '../../database/entities/geo/geo-commune.entity';
import { Partner }    from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }    from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }   from '../../database/entities/profiles/livreur-profile.entity';

import { ZoneAdminService }    from './zone-admin.service';
import { ZoneAdminController } from './zone-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      GeoZone,
      GeoCommune,
      Partner,
      Company,
      Delivery,
    ]),
  ],
  providers:   [ZoneAdminService],
  controllers: [ZoneAdminController],
  exports:     [ZoneAdminService],
})
export class ZoneAdminModule {}
