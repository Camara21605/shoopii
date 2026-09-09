/* ============================================================
 * FICHIER : src/database/migrations/1721400000017-group-photo.ts
 *
 * RÔLE : Ajoute delivery_groups.photoUrl — photo de profil du groupe
 * (URL Cloudinary, dossier avatars), modifiable par n'importe quel
 * membre actif via PATCH /delivery-groups/:id, même règle que
 * `description` déjà en place. null = pas de photo, le frontend
 * retombe alors sur l'émoji par défaut (voir useDeliveryGroups.ts).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupPhoto1721400000017 implements MigrationInterface {
  name = 'GroupPhoto1721400000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPhotoUrl = await queryRunner.hasColumn('delivery_groups', 'photoUrl');
    if (!hasPhotoUrl) {
      await queryRunner.query(
        `ALTER TABLE "delivery_groups" ADD COLUMN "photoUrl" varchar(500) NULL DEFAULT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_groups" DROP COLUMN IF EXISTS "photoUrl"`);
  }
}
