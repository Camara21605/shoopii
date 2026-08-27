/* ============================================================
 * FICHIER      : src/database/migrations/1721400000007-backfill-phone-hash.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * User.phoneHash (ajouté precédemment) n'était jusqu'ici JAMAIS
 * calculé nulle part dans le code applicatif — aucun utilisateur,
 * même récemment inscrit, n'a de phoneHash renseigné. Conséquence :
 * la synchronisation de contacts (contact-matching.service.ts,
 * WHERE u.phoneHash IN (:...hashes)) ne trouve structurellement
 * aucune correspondance, pour personne.
 *
 * user.entity.ts calcule désormais phoneHash automatiquement à
 * chaque save() (@BeforeInsert/@BeforeUpdate) — ça couvre les
 * futures inscriptions et mises à jour de profil. Cette migration
 * comble le passé : elle recalcule phoneHash pour tous les
 * utilisateurs existants qui ont un `phone` mais pas encore de
 * `phoneHash`.
 *
 * L'algorithme de hachage est volontairement DUPLIQUÉ ici (plutôt
 * qu'importé depuis phone-hash.util.ts) : une migration doit rester
 * un instantané figé dans le temps, indépendant du code applicatif
 * qui, lui, continuera d'évoluer.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-26
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';

function normalizeE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  return '+' + normalized;
}

function hashPhone(phone: string): string | null {
  const normalized = normalizeE164(phone);
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

export class BackfillPhoneHash1721400000007 implements MigrationInterface {
  name = 'BackfillPhoneHash1721400000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    const users: Array<{ id: string; phone: string }> = await queryRunner.query(
      `SELECT id, phone FROM users WHERE phone IS NOT NULL AND "phoneHash" IS NULL`,
    );

    for (const user of users) {
      const hash = hashPhone(user.phone);
      if (!hash) continue;
      await queryRunner.query(
        `UPDATE users SET "phoneHash" = $1 WHERE id = $2`,
        [hash, user.id],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    /* Pas de retour en arrière ciblé possible (on ne sait plus quelles
     * lignes cette migration a remplies vs déjà présentes) — no-op
     * volontaire plutôt que d'effacer un phoneHash légitime calculé
     * depuis par l'application. */
  }
}
