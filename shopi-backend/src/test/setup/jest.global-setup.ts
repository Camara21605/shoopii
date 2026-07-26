/* ============================================================
 * FICHIER : src/test/setup/jest.global-setup.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Initialisation globale avant l'ensemble de la suite de tests.
 * S'exécute UNE SEULE FOIS avant tout describe/it.
 *
 * ACTIONS
 * ─────────────────────────────────────────────────────────────
 *   - Définit NODE_ENV = test
 *   - Supprime toute connexion Sentry / Datadog en test
 *   - Log le démarrage de la suite QA
 * ============================================================ */

export default async function globalSetup(): Promise<void> {
  process.env['NODE_ENV']          = 'test';
  process.env['JWT_SECRET']        = 'shopi-test-jwt-secret-32chars-min';
  process.env['JWT_REFRESH_SECRET']= 'shopi-test-refresh-secret-32chars';
  process.env['JWT_EXPIRATION']    = '1h';

  /* Désactive les appels Redis en tests unitaires */
  process.env['REDIS_HOST']     = 'localhost';
  process.env['REDIS_PORT']     = '6379';
  process.env['REDIS_PASSWORD'] = '';

  /* Désactive les envois d'email */
  process.env['MAIL_TRANSPORT'] = 'stub';

  console.log('\n🧪 Shopi QA Platform — Suite de tests démarrée');
  console.log(`   Date      : ${new Date().toISOString()}`);
  console.log(`   Node      : ${process.version}`);
  console.log(`   NODE_ENV  : ${process.env['NODE_ENV']}\n`);
}
