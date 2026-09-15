/* ============================================================
 * FICHIER : src/database/migrations/1721400000022-drop-redundant-message-conversationid-index.ts
 *
 * RÔLE : Supprime l'index simple sur messages.conversationId,
 * redevenu redondant depuis que IDX_msg_conversation_date
 * (conversationId, createdAt) existe — un index B-tree composite
 * sert déjà les recherches sur son seul préfixe gauche
 * (conversationId), donc l'index simple ne fait plus qu'ajouter
 * du travail à chaque INSERT sur la table à plus fort volume
 * d'écriture de l'app, sans jamais être choisi par le planner.
 *
 * Le nom exact de cet index (auto-généré par TypeORM au moment
 * du bootstrap via synchronize) n'est pas connu à l'avance — on
 * le recherche dynamiquement plutôt que de le deviner.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRedundantMessageConversationIdIndex1721400000022 implements MigrationInterface {
  name = 'DropRedundantMessageConversationIdIndex1721400000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        idx RECORD;
      BEGIN
        FOR idx IN
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'messages'
            AND indexdef ILIKE '%("conversationId")%'
            AND indexname <> 'IDX_msg_conversation_date'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_msg_conversationId" ON "messages" ("conversationId")
    `);
  }
}
