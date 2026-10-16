/* ============================================================
 * FICHIER : src/modules/presence/presence.module.ts
 *
 * Présence à trois états (en ligne · joignable · hors ligne) : la partie
 * « téléphone » — ping de l'appareil application fermée et vérification
 * silencieuse. Le temps réel (sockets) reste dans MessagerieModule.
 * ============================================================ */

import { Module } from '@nestjs/common';

import { CallModule } from '../call/call.module';
import { MessagerieModule } from '../messagerie/messagerie.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PresenceController } from './presence.controller';
import { PresenceDeviceService } from './presence-device.service';

@Module({
  imports: [MessagerieModule, NotificationsModule, CallModule],
  controllers: [PresenceController],
  providers: [PresenceDeviceService],
  exports: [PresenceDeviceService],
})
export class PresenceModule {}
