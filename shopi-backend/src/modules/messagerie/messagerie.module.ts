/* ============================================================
 * FICHIER : messagerie.module.ts
 *
 * RÔLE : Orchestre tous les composants de la messagerie :
 *   - MessagerieController  (REST API)
 *   - MessagerieService     (logique métier + broadcast)
 *   - MessagerieGateway     (Socket.IO temps réel)
 *   - PresenceService       (Redis présence utilisateurs)
 *   - BroadcastService      (émission Socket depuis REST)
 *   - MessagingPermissionsModule  (moteur de permissions)
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Conversation } from 'src/database/entities/messaging/conversation.entity';
import { Message }      from 'src/database/entities/messaging/message.entity';
import { User }         from 'src/database/entities/user.entity';
import { Client }       from 'src/database/entities/profiles/client-profile.entity';
import { Company }      from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }     from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }      from 'src/database/entities/profiles/partenaire-profile.entity';
import { Follow }       from 'src/database/entities/follow/follow.entity';
import { UserContact }  from 'src/database/entities/contacts/user-contact.entity';
import { Commande }     from 'src/database/entities/commande/commande.entity';
import { DeliveryGroup }       from 'src/database/entities/delivery-group/delivery-group.entity';
import { DeliveryGroupMember } from 'src/database/entities/delivery-group/delivery-group-member.entity';
import { GroupMessage }        from 'src/database/entities/delivery-group/group-message.entity';

import { AuthModule }                  from '../auth/auth.module';
import { NotificationsModule }         from '../notifications/notifications.module';
import { MessagingPermissionsModule }  from './permissions/messaging-permissions.module';

import { MessagerieController }   from './messagerie.controller';
import { MessagerieService }      from './messagerie.service';
import { MessagerieGateway }      from './gateways/messagerie.gateway';
import { GroupCallGateway }       from './gateways/group-call.gateway';
import { PresenceService }        from './services/presence.service';
import { BroadcastService }       from './services/broadcast.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      User,
      Client,
      Company,
      Delivery,
      Correspondent,
      Partner,
      Follow,
      UserContact,
      Commande,
      DeliveryGroup,
      DeliveryGroupMember,
      GroupMessage,
    ]),
    AuthModule,
    NotificationsModule,
    MessagingPermissionsModule,   // ← Moteur de permissions
  ],
  controllers: [MessagerieController],
  providers: [
    MessagerieService,
    MessagerieGateway,
    GroupCallGateway,
    PresenceService,
    BroadcastService,
  ],
  exports: [
    MessagerieService,
    BroadcastService,
    PresenceService,
  ],
})
export class MessagerieModule {}
