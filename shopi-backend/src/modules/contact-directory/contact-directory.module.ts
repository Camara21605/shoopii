/* ============================================================
 * FICHIER : src/modules/contact-directory/contact-directory.module.ts
 * MODULE : ContactDirectoryModule
 * ROLE : annuaire des contacts de la messagerie (cartes de profil) et
 *        notification « X a rejoint Shoneya ».
 * RESPONSABILITES : fournir ContactDirectoryService et ContactJoinedService
 *   à l'authentification (inscription), aux profils (changement de numéro)
 *   et à la synchronisation des contacts — SANS dépendre d'aucun de ces
 *   modules (pas de dépendance circulaire).
 * DEPENDANCES : TypeORM, NotificationsModule
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-18
 * ============================================================ */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserContact } from 'src/database/entities/contacts/user-contact.entity';
import { User } from 'src/database/entities/user.entity';
import { Client } from 'src/database/entities/profiles/client-profile.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { ContactDirectoryService } from './contact-directory.service';
import { ContactJoinedService } from './contact-joined.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserContact, User, Client, Company, Delivery, Correspondent, Partner]),
    NotificationsModule,
  ],
  providers: [ContactDirectoryService, ContactJoinedService],
  exports: [ContactDirectoryService, ContactJoinedService],
})
export class ContactDirectoryModule {}
