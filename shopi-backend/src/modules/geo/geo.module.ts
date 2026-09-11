import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';

import { GeoPays }       from '../../database/entities/geo/geo-pays.entity';
import { GeoRegion }     from '../../database/entities/geo/geo-region.entity';
import { GeoPrefecture } from '../../database/entities/geo/geo-prefecture.entity';
import { GeoCommune }    from '../../database/entities/geo/geo-commune.entity';
import { GeoQuartier }   from '../../database/entities/geo/geo-quartier.entity';
import { GeoZone }       from '../../database/entities/geo/geo-zone.entity';
import { GeoAuditLog }   from '../../database/entities/geo/geo-audit-log.entity';
import { Admin }         from '../../database/entities/profiles/admin-profile.entity';
/* Nécessaires pour GeoResolutionService (résolution paysId/villeId) */
import { Partner }  from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }  from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../database/entities/profiles/livreur-profile.entity';

import { GeoService }           from './geo.service';
import { GeoResolutionService } from './geo-resolution.service';
import { GeoController }        from './geo.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeoPays, GeoRegion, GeoPrefecture,
      GeoCommune, GeoQuartier, GeoZone,
      GeoAuditLog,
      Admin,
      Partner, Company, Delivery,
    ]),
  ],
  providers:   [GeoService, GeoResolutionService],
  controllers: [GeoController],
  exports:     [GeoService, GeoResolutionService],
})
export class GeoModule {}
