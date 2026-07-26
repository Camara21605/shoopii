/* ============================================================
 * FICHIER : src/test/setup/jest.global-teardown.ts
 * RÔLE    : Nettoyage global après l'ensemble de la suite.
 * ============================================================ */

export default async function globalTeardown(): Promise<void> {
  console.log('\n✅ Shopi QA Platform — Suite de tests terminée\n');
}
