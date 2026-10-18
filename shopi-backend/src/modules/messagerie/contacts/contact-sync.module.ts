/* ============================================================
 * FICHIER : contact-sync.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserContact }        from 'src/database/entities/contacts/user-contact.entity';
import { ContactSyncSession } from 'src/database/entities/contacts/contact-sync-session.entity';
import { User }               from 'src/database/entities/user.entity';
import { MessagerieModule }   from '../messagerie.module';
import { ContactDirectoryModule } from 'src/modules/contact-directory/contact-directory.module';

import { ContactMatchingService }   from './contact-matching.service';
import { ContactSyncService }       from './contact-sync.service';
import { ContactDiscoveryService }  from './contact-discovery.service';
import { ContactSyncController }    from './contact-sync.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserContact, ContactSyncSession, User]),
    MessagerieModule,   // pour PresenceService
    ContactDirectoryModule, // cartes de profil de l'onglet Contacts
  ],
  controllers: [ContactSyncController],
  providers: [
    ContactMatchingService,
    ContactSyncService,
    ContactDiscoveryService,
  ],
  exports: [
    ContactMatchingService,
    ContactSyncService,
    ContactDiscoveryService,
  ],
})
export class ContactSyncModule {}
