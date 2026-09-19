/* ============================================================
 * FICHIER : src/database/migrations/1721400000031-actor-admin-links.ts
 *
 * RÔLE : rattrape le rattachement des acteurs à leur administrateur.
 * register() ne renseignait jamais adminId (partenaires/entreprises/
 * livreurs) : les pages "de la zone" de l'administrateur (commandes,
 * acteurs, finances…) restaient vides. Le code corrigé le renseigne
 * désormais ; cette migration traite les comptes déjà créés :
 *   1. partenaires inscrits avec un code émis par un admin
 *      (creation_codes.adminId, consommé par usedById = userId) ;
 *   2. entreprises / livreurs inscrits avec un code d'admin ;
 *   3. entreprises / livreurs recrutés par un partenaire déjà rattaché
 *      à un admin (partnerId → partenaires.adminId).
 * Ne touche que les lignes dont adminId est NULL. down() : sans effet
 * (on ne sait plus distinguer les lignes rattachées ici des autres).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActorAdminLinks1721400000031 implements MigrationInterface {
  name = 'ActorAdminLinks1721400000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* 1 + 2. Directement via le code d'invitation de l'admin */
    for (const table of ['partenaires', 'entreprises', 'livreurs']) {
      await queryRunner.query(`
        UPDATE "${table}" t SET "adminId" = cc."adminId"
        FROM "creation_codes" cc
        WHERE cc."usedById" = t."userId" AND cc."adminId" IS NOT NULL AND t."adminId" IS NULL
      `);
    }
    /* 3. Via le partenaire recruteur (après l'étape 1, qui rattache les partenaires) */
    for (const table of ['entreprises', 'livreurs']) {
      await queryRunner.query(`
        UPDATE "${table}" t SET "adminId" = p."adminId"
        FROM "partenaires" p
        WHERE t."partnerId" = p."id" AND p."adminId" IS NOT NULL AND t."adminId" IS NULL
      `);
    }
  }

  public async down(): Promise<void> { /* irréversible */ }
}
