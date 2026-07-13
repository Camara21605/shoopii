/* ================================================================
 * FICHIER : src/modules/appearance/appearance.module.ts
 *
 * Module NestJS autonome pour la gestion des préférences
 * d'apparence utilisateur.
 *
 * IMPORTÉ PAR : AppModule (src/app.module.ts)
 * ROUTES      : /api/appearance (GET, PUT, POST /reset)
 * ================================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppearancePreference } from '../../database/entities/appearance-preference.entity';
import { User }                  from '../../database/entities/user.entity';
import { AppearanceService }     from './appearance.service';
import { AppearanceController }  from './appearance.controller';

@Module({
  imports: [
    /* Entités nécessaires au service */
    TypeOrmModule.forFeature([AppearancePreference, User]),
  ],
  providers:   [AppearanceService],
  controllers: [AppearanceController],
  exports:     [AppearanceService], /* exporté pour usage éventuel dans d'autres modules */
})
export class AppearanceModule {}
