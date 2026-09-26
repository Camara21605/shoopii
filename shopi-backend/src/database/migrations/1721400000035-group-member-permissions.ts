/* ============================================================
 * FICHIER : src/database/migrations/1721400000035-group-member-permissions.ts
 *
 * RÔLE : permissions par membre dans un groupe libre (DeliveryGroupKind.CUSTOM).
 *
 * L'administrateur du groupe choisit pour chaque membre s'il peut :
 *   - envoyer des messages (texte, photos, fichiers…) → canSendMessages
 *   - envoyer des messages vocaux                     → canSendVoice
 *   - lancer un appel de groupe                       → canCall
 * Les trois à false = « lecture seule ».
 *
 * + droits par défaut du GROUPE (delivery_groups.defaultCan*) : réglés d'un coup
 *   par l'administrateur pour tous les membres non administrateurs, et appliqués
 *   aux membres ajoutés plus tard.
 *
 * Défaut true : les membres existants gardent exactement leurs droits actuels.
 * Sans effet pour un administrateur ni pour un groupe de commande (ORDER) —
 * voir DeliveryGroupService.effectivePermissions.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupMemberPermissions1721400000035 implements MigrationInterface {
  name = 'GroupMemberPermissions1721400000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_group_members"
        ADD COLUMN IF NOT EXISTS "canSendMessages" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "canSendVoice"    boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "canCall"         boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_groups"
        ADD COLUMN IF NOT EXISTS "defaultCanSendMessages" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "defaultCanSendVoice"    boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "defaultCanCall"         boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_groups"
        DROP COLUMN IF EXISTS "defaultCanSendMessages",
        DROP COLUMN IF EXISTS "defaultCanSendVoice",
        DROP COLUMN IF EXISTS "defaultCanCall"
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_group_members"
        DROP COLUMN IF EXISTS "canSendMessages",
        DROP COLUMN IF EXISTS "canSendVoice",
        DROP COLUMN IF EXISTS "canCall"
    `);
  }
}
