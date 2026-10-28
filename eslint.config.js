import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: hooks.configs.recommended.rules,
  },
  {
    files: ['src/rendering/**/*.js'],
    // Preserved procedural artwork is JS; the public scene boundary is typed.
    rules: {
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
