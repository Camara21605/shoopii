// src/database/database.module.ts

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource }    from 'typeorm';
import { databaseConfigFactory } from '../config/database.config';

/* ── Migrations ── */
import { AddClientSettingsFields1700000000000 }
  from './migrations/1700000000000-add-client-settings-fields';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      ...databaseConfigFactory,

      dataSourceFactory: async (options) => {
        const dataSource = new DataSource({
          ...options!,

          /* ✅ Migrations enregistrées ici */
          migrations: [
            AddClientSettingsFields1700000000000,
            /* Ajoute tes futures migrations ici */
          ],

          /*
           * migrationsRun: true  → exécute auto au démarrage
           * migrationsRun: false → tu lances manuellement avec :
           *   npx typeorm migration:run -d src/database/data-source.ts
           */
          migrationsRun: false, // ⚠️ À mettre à false en production et gérer les migrations manuellement
        });

        await dataSource.initialize();
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}