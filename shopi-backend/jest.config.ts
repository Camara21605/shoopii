/* ============================================================
 * FICHIER : jest.config.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Configuration Jest centralisée pour la QA Platform Shopi.
 *
 * PROJETS (3)
 * ─────────────────────────────────────────────────────────────
 *   unit         — src/**‌/*.spec.ts         (sans DB, mocks purs)
 *   integration  — test/integration/**      (avec DB de test SQLite)
 *   security     — test/security/**         (validation RBAC/injections)
 *
 * SEUILS DE COUVERTURE
 * ─────────────────────────────────────────────────────────────
 *   Stratégie "cliquet" : seuils juste sous la couverture actuelle,
 *   relevés au fur et à mesure (voir coverageThreshold plus bas).
 *
 * LE DÉPLOIEMENT EST BLOQUÉ si un seuil n'est pas atteint.
 * Vérifié par Jest (--coverage) dans .github/workflows/qa-pipeline.yml.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import type { Config } from 'jest';

const config: Config = {

  /* ── Racine du projet ─────────────────────────────────── */
  rootDir: '.',

  /* ── Transformateur TypeScript ────────────────────────── */
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: { ignoreCodes: ['TS151001'] },
    }],
  },

  /* ── Extensions reconnues ─────────────────────────────── */
  moduleFileExtensions: ['js', 'json', 'ts'],

  /* ── Alias de modules ─────────────────────────────────── */
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },

  /* ── Environnement de test ────────────────────────────── */
  testEnvironment: 'node',

  /* ── Setup global avant TOUS les tests ───────────────── */
  setupFilesAfterEnv: [],
  globalSetup:    '<rootDir>/src/test/setup/jest.global-setup.ts',
  globalTeardown: '<rootDir>/src/test/setup/jest.global-teardown.ts',

  /* ── Projets séparés (unit / integration / security) ─── */
  projects: [

    /* ── UNIT TESTS ─────────────────────────────────────── */
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
      testEnvironment: 'node',
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '\\.module\\.ts$',
        '\\.entity\\.ts$',
        '\\.events?\\.ts$',
        '\\.dto\\.ts$',
        '\\.enum\\.ts$',
        'migration',
        'main\\.ts',
      ],
    },

    /* ── INTEGRATION TESTS ─────────────────────────────── */
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
      testEnvironment: 'node',
      testTimeout: 30_000,
    },

    /* ── SECURITY TESTS ────────────────────────────────── */
    {
      displayName: 'security',
      testMatch: ['<rootDir>/test/security/**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
      testEnvironment: 'node',
      testTimeout: 15_000,
    },

  ],

  /* ── Couverture de code ───────────────────────────────── */
  collectCoverage:     false,  // activé via --coverage
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.module.(t|j)s',
    '!src/**/*.entity.(t|j)s',
    '!src/**/main.(t|j)s',
    '!src/**/migration*/**',
    '!src/**/*.events?.(t|j)s',
    '!src/**/*.enum.(t|j)s',
    '!src/**/*.dto.(t|j)s',
    '!src/test/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  /* ── SEUILS — bloquent le CI si non atteints ─────────── */
  /*
   * Stratégie "cliquet" : chaque seuil est fixé juste SOUS la couverture
   * réelle mesurée (2026-09). Toute régression fait échouer le CI ; quand
   * des tests sont ajoutés, on RELÈVE le seuil correspondant — on ne le
   * baisse jamais. Objectif à terme : 70 % global, 90 % sur les moteurs
   * financiers.
   *
   * NB : un fichier/dossier listé ci-dessous est exclu du calcul "global".
   */
  coverageThreshold: {
    /* Hors moteurs financiers ci-dessous (exclus du global par Jest) */
    global: {
      branches:   6,
      functions:  10,
      lines:      12,
      statements: 11,
    },
    /* Moteurs financiers — seuils dédiés (agrégés par dossier) */
    './src/modules/commission/': {
      branches:   39,
      functions:  41,
      lines:      57,
      statements: 58,
    },
    './src/modules/wallet-engine/': {
      branches:   74,
      functions:  72,
      lines:      82,
      statements: 82,
    },
    './src/modules/escrow-engine/': {
      branches:   51,
      functions:  65,
      lines:      87,
      statements: 86,
    },
    './src/modules/payment-engine/': {
      branches:   40,
      functions:  30,
      lines:      55,
      statements: 54,
    },
    './src/modules/settlement-engine/': {
      branches:   33,
      functions:  27,
      lines:      59,
      statements: 61,
    },
    './src/modules/resolution-engine/': {
      branches:   33,
      functions:  27,
      lines:      60,
      statements: 60,
    },
    /* Fichiers critiques */
    './src/modules/escrow-engine/escrow.engine.ts': {
      branches:   87,
      functions:  66,
      lines:      91,
      statements: 92,
    },
    './src/modules/escrow-engine/services/escrow-manager.service.ts': {
      branches:   92,
      functions:  100,
      lines:      100,
      statements: 99,
    },
    './src/modules/escrow-engine/services/escrow-validator.service.ts': {
      branches:   96,
      functions:  100,
      lines:      100,
      statements: 100,
    },
    './src/modules/escrow-engine/services/escrow-release.service.ts': {
      branches:   85,
      functions:  100,
      lines:      96,
      statements: 96,
    },
    './src/modules/escrow-engine/services/escrow-refund.service.ts': {
      branches:   92,
      functions:  100,
      lines:      91,
      statements: 92,
    },
    './src/modules/wallet-engine/wallet.engine.ts': {
      branches:   87,
      functions:  100,
      lines:      98,
      statements: 98,
    },
    './src/modules/wallet-engine/services/wallet-movement.service.ts': {
      branches:   81,
      functions:  100,
      lines:      95,
      statements: 93,
    },
    './src/modules/wallet-engine/services/wallet-lock.service.ts': {
      branches:   100,
      functions:  100,
      lines:      100,
      statements: 100,
    },
    './src/modules/wallet-engine/services/wallet-validator.service.ts': {
      branches:   80,
      functions:  90,
      lines:      90,
      statements: 90,
    },
    './src/modules/commission/services/commission-calculator.service.ts': {
      branches:   98,
      functions:  100,
      lines:      100,
      statements: 100,
    },
  },

  /* ── Reporters ──────────────────────────────────────────── */
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/reports',
      outputName:      'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate:    '{title}',
    }],
  ],

  /* ── Timeouts ─────────────────────────────────────────── */
  testTimeout: 10_000,

  /* ── Verbose en CI ────────────────────────────────────── */
  verbose: process.env['CI'] === 'true',

  /* ── Nettoyage automatique entre tests ───────────────── */
  clearMocks:   true,
  resetMocks:   false,
  restoreMocks: true,
};

export default config;
