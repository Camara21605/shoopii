import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';

/**
 * Exécute TypeORM synchronize() en désactivant temporairement les FK.
 *
 * MySQL  : SET FOREIGN_KEY_CHECKS = 0 / 1
 * PostgreSQL : SET session_replication_role = 'replica' / 'origin'
 *   → Désactive triggers + FK checks pour la session courante.
 *   → Requiert le rôle SUPERUSER ou l'attribut REPLICATION sur le user.
 *   → Fallback : synchronize() directement (TypeORM gère l'ordre de création).
 */
@Injectable()
export class DisableFkSubscriber {
  private readonly logger = new Logger(DisableFkSubscriber.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      /* Désactive les contraintes FK/triggers pour la session PostgreSQL */
      await this.dataSource.query("SET session_replication_role = 'replica'");
      await this.dataSource.synchronize();
      await this.dataSource.query("SET session_replication_role = 'origin'");
    } catch (err: any) {
      /* Si l'utilisateur ne dispose pas du privilège REPLICATION,
         on synchronise directement — TypeORM ordonne correctement les tables. */
      this.logger.warn(
        `[DB Sync] session_replication_role non disponible (${err.message}), ` +
        'synchronize() sans désactivation FK.',
      );
      await this.dataSource.synchronize();
    }
  }
}
