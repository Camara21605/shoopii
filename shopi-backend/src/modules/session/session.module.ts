/* ============================================================
 * FICHIER : src/modules/session/session.module.ts
 *
 * Module autonome — voir le commentaire d'en-tête de session.service.ts
 * pour pourquoi il n'est PAS rattaché à AuthModule (cycle avec
 * NotificationsModule sinon).
 * ============================================================ */

import { Module } from '@nestjs/common';
import { SessionService } from './session.service';

@Module({
  providers: [SessionService],
  exports:   [SessionService],
})
export class SessionModule {}
