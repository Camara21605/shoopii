/* ============================================================
 * FICHIER : src/modules/location/location.module.ts
 * RÔLE    : Module indépendant de géolocalisation.
 *           Peut être importé dans n'importe quel autre module.
 * ============================================================ */

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { JwtModule }        from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule }   from '@nestjs/passport';

/* ── Entités ─────────────────────────────────────────────── */
import { Localisation }     from '../../database/entities/localisation.entity';
import { Delivery }         from '../../database/entities/profiles/livreur-profile.entity';
import { Company }          from '../../database/entities/profiles/entreprise-profile.entity';
import { Correspondent }    from '../../database/entities/profiles/correspondant-profile.entity';
import { CompanyBranch }    from '../../database/entities/location/company-branch.entity';
import { LocationHistory }  from '../../database/entities/location/location-history.entity';

/* ── Services ────────────────────────────────────────────── */
import { GeoService }                    from './services/geo.service';
import { ClientAddressService }          from './services/client-address.service';
import { DeliveryLocationService }       from './services/delivery-location.service';
import { CompanyLocationService }        from './services/company-location.service';
import { CorrespondantLocationService }  from './services/correspondant-location.service';

/* ── Gateway ─────────────────────────────────────────────── */
import { LocationGateway }  from './gateways/location.gateway';

/* ── Controllers ─────────────────────────────────────────── */
import { ClientAddressController }           from './controllers/client-address.controller';
import { DeliveryLocationController }        from './controllers/delivery-location.controller';
import { CompanyLocationController }         from './controllers/company-location.controller';
import { CorrespondantLocationController }   from './controllers/correspondant-location.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Localisation,
      Delivery,
      Company,
      Correspondent,
      CompanyBranch,
      LocationHistory,
    ]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],

  controllers: [
    ClientAddressController,
    DeliveryLocationController,
    CompanyLocationController,
    CorrespondantLocationController,
  ],

  providers: [
    GeoService,
    ClientAddressService,
    DeliveryLocationService,
    CompanyLocationService,
    CorrespondantLocationService,
    LocationGateway,
  ],

  exports: [
    GeoService,
    ClientAddressService,
    DeliveryLocationService,
    CompanyLocationService,
    CorrespondantLocationService,
    LocationGateway,
  ],
})
export class LocationModule {}
