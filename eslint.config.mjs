import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/dev-dist/**',
      'apps/api/prisma/migrations/**',
      'apps/web/public/**',
      // tsc build artefacts that must never be linted as sources
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: {
      // The design-system primitives are thin wrappers over these elements; without the
      // mapping every a11y rule stops at the custom component and sees nothing.
      'jsx-a11y': {
        components: {
          Input: 'input',
          Checkbox: 'input',
          Label: 'label',
          Button: 'button',
        },
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Errors, not warnings: the rest-timer and offline code in later phases is prime
      // stale-closure territory, and a backlog of warnings never gets paid down.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      // Nest relies on decorator metadata; empty ctor params are idiomatic there.
      '@typescript-eslint/no-extraneous-class': 'off',
      // `import type` erases the class from the emitted JS, so `emitDecoratorMetadata`
      // has nothing to write into design:paramtypes and constructor injection breaks at
      // runtime. Injectable providers must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.e2e-spec.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { 'no-console': 'off' },
  },
  {
    files: [
      '**/seed.ts',
      '**/*.config.*',
      '**/scripts/**',
      'apps/api/prisma/exercise-import/import.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    // Jest wiring has to stay CommonJS.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
