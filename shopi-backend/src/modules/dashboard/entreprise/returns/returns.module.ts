/* ============================================================
 * FICHIER : returns/returns.module.ts
 * RÔLE    : Module NestJS du système de Retours & SAV.
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ── */
import { ReturnRequest }  from 'src/database/entities/returns/return-request.entity';
import { ReturnEvidence } from 'src/database/entities/returns/return-evidence.entity';
import { ReturnHistory }  from 'src/database/entities/returns/return-history.entity';
import { SavTicket }      from 'src/database/entities/returns/sav-ticket.entity';
import { SavMessage }     from 'src/database/entities/returns/sav-message.entity';
import { Company }        from 'src/database/entities/profiles/entreprise-profile.entity';
import { Client }         from 'src/database/entities/profiles/client-profile.entity';
import { Commande }       from 'src/database/entities/commande/commande.entity';
import { User }           from 'src/database/entities/user.entity';

/* ── Upload ── */
import { UploadModule } from 'src/modules/upload/upload.module';

/* ── Controllers ── */
import { ReturnsController } from './returns.controller';
import { SavController }     from './sav.controller';

/* ── Services ── */
import { ReturnsService }       from './services/returns.service';
import { ReturnsStatsService }  from './services/returns-stats.service';
import { SavService }           from './services/sav.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnRequest,
      ReturnEvidence,
      ReturnHistory,
      SavTicket,
      SavMessage,
      Company,
      Client,
      Commande,
      User,
    ]),
    UploadModule,
  ],

  controllers: [
    ReturnsController,
    SavController,
  ],

  providers: [
    ReturnsService,
    ReturnsStatsService,
    SavService,
  ],

  exports: [
    ReturnsService,
    SavService,
  ],
})
export class ReturnsModule {}
