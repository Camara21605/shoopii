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
        /* Log de diagnostic (masque le mot de passe) */
        const urlForLog = (options as any)?.url
          ? (options as any).url.replace(/:[^:@]+@/, ':***@')
          : 'no URL';
        console.log(`[DB] Connecting to: ${urlForLog}`);
        console.log(`[DB] SSL enabled  : ${JSON.stringify((options as any)?.extra?.ssl ?? false)}`);

        const dataSource = new DataSource({
          ...options!,
          migrations: [AddClientSettingsFields1700000000000],
          migrationsRun: false,
        });

        await dataSource.initialize();
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}