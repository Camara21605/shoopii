/* ============================================================
 * MIGRATION : 1721400000003-call-active-pair-unique.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Défense en profondeur (Partie 3 — concurrence) : garantit au niveau DB
 * qu'il ne peut jamais exister deux lignes `calls` actives pour la même
 * paire d'utilisateurs, quel que soit le sens (A appelle B == B appelle A).
 *
 * `calls` ne contient QUE des appels actifs par construction (finalizeCall
 * supprime la ligne dès qu'un appel se termine — voir call.entity.ts) :
 * pas besoin de clause WHERE status='...', chaque ligne existante EST
 * "active" par définition.
 *
 * POURQUOI LEAST/GREATEST ET PAS UNIQUE("callerId","calleeId") SIMPLE :
 * un index unique classique sur (callerId, calleeId) n'empêche PAS
 * l'insertion de la paire inverse (calleeId, callerId) — deux lignes
 * (A,B) et (B,A) sont "différentes" pour Postgres alors qu'elles
 * représentent le même appel. LEAST/GREATEST normalise l'ordre des deux
 * UUID avant de les indexer, donc (A,B) et (B,A) produisent la MÊME clé
 * et se rentrent mutuellement en collision — exactement ce qui manquait
 * au verrou applicatif (advisory lock, voir CallService.startCall) pour
 * avoir un filet de sécurité même si un futur code bypassait le service.
 *
 * IDEMPOTENCE : IF NOT EXISTS.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallActivePairUnique1721400000003 implements MigrationInterface {
  name = 'CallActivePairUnique1721400000003';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_calls_active_pair"
      ON "calls" (LEAST("callerId", "calleeId"), GREATEST("callerId", "calleeId"));
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "UNIQ_calls_active_pair";`);
  }
}
