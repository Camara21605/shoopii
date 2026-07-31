/* ============================================================
 * FICHIER : src/modules/call/call.module.ts
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Call }        from 'src/database/entities/call/call.entity';
import { CallHistory } from 'src/database/entities/call/call-history.entity';
import { User }         from 'src/database/entities/user.entity';
import { Client }        from 'src/database/entities/profiles/client-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';

import { AuthModule }                 from '../auth/auth.module';
import { NotificationsModule }        from '../notifications/notifications.module';
import { MessagingPermissionsModule } from '../messagerie/permissions/messaging-permissions.module';
import { MessagerieModule }           from '../messagerie/messagerie.module';

import { CallController } from './call.controller';
import { CallService }    from './call.service';
import { CallGateway }    from './call.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Call, CallHistory, User,
      Client, Company, Delivery, Correspondent, Partner,
    ]),
    AuthModule,
    NotificationsModule,
    MessagingPermissionsModule,
    MessagerieModule, // → PresenceService (présence en ligne/hors ligne)
  ],
  controllers: [CallController],
  providers: [CallService, CallGateway],
  exports: [CallService],
})
export class CallModule {}
