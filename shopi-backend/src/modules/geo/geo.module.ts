import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';

import { GeoPays }       from '../../database/entities/geo/geo-pays.entity';
import { GeoRegion }     from '../../database/entities/geo/geo-region.entity';
import { GeoPrefecture } from '../../database/entities/geo/geo-prefecture.entity';
import { GeoCommune }    from '../../database/entities/geo/geo-commune.entity';
import { GeoQuartier }   from '../../database/entities/geo/geo-quartier.entity';
import { GeoZone }       from '../../database/entities/geo/geo-zone.entity';
import { Admin }         from '../../database/entities/profiles/admin-profile.entity';

import { GeoService }    from './geo.service';
import { GeoController } from './geo.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeoPays, GeoRegion, GeoPrefecture,
      GeoCommune, GeoQuartier, GeoZone,
      Admin,
    ]),
  ],
  providers:   [GeoService],
  controllers: [GeoController],
  exports:     [GeoService],
})
export class GeoModule {}
