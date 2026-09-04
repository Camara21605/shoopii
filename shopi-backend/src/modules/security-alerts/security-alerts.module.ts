/* ============================================================
 * FICHIER : src/modules/security-alerts/security-alerts.module.ts
 *
 * RÔLE : Module autonome (aucune dépendance vers AuthModule,
 *        ClientModule ou PaymentEngineModule — juste des entités
 *        TypeORM + MailModule) afin d'être importable depuis
 *        n'importe lequel des trois sans risque de cycle :
 *          - ClientModule        → routes GET/PATCH securite/alertes
 *          - AuthModule          → alertes connexion / tentatives échouées
 *          - PaymentEngineModule → alerte transaction refusée
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

import { User }   from '../../database/entities/user.entity';
import { Client } from '../../database/entities/profiles/client-profile.entity';

import { MailModule } from '../email/email.module';

import { SecurityAlertsService } from './security-alerts.service';
import { GeoIpService }          from './geo-ip.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Client]),
    MailModule,
  ],
  providers: [SecurityAlertsService, GeoIpService],
  exports:   [SecurityAlertsService, GeoIpService],
})
export class SecurityAlertsModule {}
