// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      /* `any` étant autorisé ci-dessus, ses usages restent signalés en
       * avertissement — à typer au fil de l'eau, sans bloquer la CI. */
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      /* Le code est volontairement aligné en colonnes, ce que Prettier
       * défait : le formatage n'est plus vérifié par ESLint. Les règles
       * de style qui entreraient en conflit restent désactivées par
       * eslint-config-prettier ; `npm run format` reste disponible. */
      'prettier/prettier': 'off',
      /* `async` sans `await` est volontaire ici : implémentations d'interface
       * (fournisseurs de paiement, évaluateurs), crons, stubs, et méthodes
       * qui lèvent une erreur — `async` garantit qu'elle devient une promesse
       * rejetée. Le retirer changerait silencieusement la propagation des
       * erreurs (throw synchrone chez l'appelant). */
      '@typescript-eslint/require-await': 'off',
      /* Paramètres et variables préfixés par _ : inutilisés volontairement. */
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    /* Tests : `expect(mock.methode)` est le cas d'usage normal de Jest
     * (faux positif de unbound-method), et require() sert à espionner le
     * vrai module (jest.spyOn) — un import ES en créerait une copie. */
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
