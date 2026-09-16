/* ============================================================
 * FICHIER : src/modules/correspondants/correspondants.module.ts
 *
 * MISE À JOUR : import de CodesModule pour injecter
 *               CodeCreationService dans InvitationService.
 * ============================================================ */

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

import { Correspondent }
  from 'src/database/entities/profiles/correspondant-profile.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }
  from 'src/database/entities/profiles/livreur-profile.entity';
import { CreationCode }
  from 'src/database/entities/code-creation.entity';
import { Follow }
  from 'src/database/entities/follow/follow.entity';

import { CorrespondantsController } from './correspondants.controller';
import { CorrespondantsService }    from './services/correspondants.service';
import { InvitationService }        from './services/invitation.service';

import { MailModule }  from 'src/modules/email/email.module';

import { CodesModule }         from 'src/modules/auth/code-creation/code-creation.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { CompanyTeamModule }   from 'src/modules/company-team/company-team.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Correspondent,
      Company,
      Delivery,
      CreationCode,
      Follow,   // isSuivi — l'entreprise suit-elle ce correspondant ?
    ]),

    MailModule,
    CodesModule,
    NotificationsModule,
    /* Pour TeamPermissionGuard (voir correspondants.controller.ts) —
     * audit sécurité : ces routes n'étaient protégées que par @Roles(COMPANY),
     * qui ne distingue pas propriétaire/collaborateur. */
    CompanyTeamModule,
  ],

  controllers: [
    CorrespondantsController,
  ],

  providers: [
    CorrespondantsService,
    InvitationService,
  ],

  exports: [
    CorrespondantsService,
  ],
})
export class CorrespondantsModule {}