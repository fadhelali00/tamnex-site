import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'shots/**', '.claude/**', 'site/assets/fonts/**'] },
  js.configs.recommended,
  {
    files: ['site/assets/**/*.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: { ...globals.browser, module: 'readonly' } },
    rules: { 'no-var': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] }
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } }
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, axe: 'readonly' } }
  }
];
