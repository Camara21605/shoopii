/* ============================================================
 * FICHIER      : src/database/migrations/1721400000009-conversation-listing-indexes.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Index composites pour la requête de listage des conversations
 * (MessagerieService.listConversationsPage(), utilisée par
 * GET /messagerie/conversations et /conversations/archived),
 * identifiés lors de l'audit performance messagerie (2026-08-29) :
 *
 *   WHERE ("initiatorType"=:t AND "initiatorId"=:id AND "status"=:s
 *          AND "deletedByInitiator"=false AND "archivedByInitiator"=:a)
 *      OR ("recipientType"=:t AND "recipientId"=:id AND "status"=:s
 *          AND "deletedByRecipient"=false AND "archivedByRecipient"=:a)
 *   ORDER BY COALESCE("lastMessageAt", "updatedAt") DESC, "id" DESC
 *
 * Les index existants (IDX_conv_initiator, IDX_conv_recipient) ne
 * couvrent que (type, id) — Postgres devait ensuite filtrer status,
 * archivedBy.. et deletedBy.. et trier lastMessageAt séparément. Ces deux
 * nouveaux index composites (dont l'expression COALESCE, alignée sur
 * la pagination cursor keyset) couvrent exactement le WHERE + ORDER BY
 * de chaque branche.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-29
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationListingIndexes1721400000009 implements MigrationInterface {
  name = 'ConversationListingIndexes1721400000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conv_initiator_activity"
        ON "conversations" (
          "initiatorType", "initiatorId", "status", "archivedByInitiator", "deletedByInitiator",
          (COALESCE("lastMessageAt", "updatedAt")) DESC, "id" DESC
        )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conv_recipient_activity"
        ON "conversations" (
          "recipientType", "recipientId", "status", "archivedByRecipient", "deletedByRecipient",
          (COALESCE("lastMessageAt", "updatedAt")) DESC, "id" DESC
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conv_initiator_activity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conv_recipient_activity"`);
  }
}
