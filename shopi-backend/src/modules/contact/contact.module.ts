/* ============================================================
 * FICHIER  : src/modules/contact/contact.module.ts
 * ROLE     : Module NestJS du formulaire de contact Shopi.
 *
 * RESPONSABILITES :
 *   - Enregistrer l'entité ContactMessage (TypeORM).
 *   - Déclarer les providers :
 *       · ContactService           → soumission + liste admin
 *       · ContactEscalationService → escalade Contact → Ticket support
 *   - Importer SupportModule → exporte SupportService
 *     (consommé par ContactEscalationService).
 *
 * DEPENDANCES :
 *   - MailModule    → ContactService envoie emails de confirmation
 *   - SupportModule → ContactEscalationService crée des tickets
 *
 * DÉPENDANCES CIRCULAIRES :
 *   ContactModule → SupportModule → MailModule  ✅ (sens unique)
 *   SupportModule n'importe PAS ContactModule   ✅
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContactMessage } from '../../database/entities/contact/contact-message.entity';
import { MailModule }     from '../email/email.module';
import { SupportModule }  from '../support/support.module';

import { ContactService }           from './services/contact.service';
import { ContactEscalationService } from './services/contact-escalation.service';
import { ContactController }        from './controllers/contact.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactMessage]),
    MailModule,
    /* SupportModule exporte SupportService — utilisé par ContactEscalationService
     * pour créer un SupportTicket lors de l'escalade. */
    SupportModule,
  ],

  providers: [
    ContactService,
    ContactEscalationService,
  ],

  controllers: [ContactController],
})
export class ContactModule {}
