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
 *   Branches  : 60 %   Fonctions  : 70 %
 *   Lignes    : 70 %   Statements : 70 %
 *
 * LE DÉPLOIEMENT EST BLOQUÉ si un seuil n'est pas atteint.
 * Voir .github/workflows/qa-pipeline.yml — step "coverage-gate".
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
  coverageThreshold: {
    global: {
      branches:   60,
      functions:  70,
      lines:      70,
      statements: 70,
    },
    /* Seuils renforcés sur les moteurs financiers critiques */
    './src/modules/wallet-engine/services/wallet-validator.service.ts': {
      branches:   80,
      functions:  90,
      lines:      90,
      statements: 90,
    },
    './src/modules/commission/services/commission-calculator.service.ts': {
      branches:   80,
      functions:  90,
      lines:      90,
      statements: 90,
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
