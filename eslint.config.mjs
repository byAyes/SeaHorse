import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/',
      '.next/',
      'public/',
      'data/',
      'dist/',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },

  // Base recommended from ESLint
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // React + Next.js specific
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'scripts/**/*.ts'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js
      'react/prop-types': 'off', // We use TypeScript

      // React Hooks
      ...reactHooksPlugin.configs.recommended.rules,

      // Next.js
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // TypeScript overrides
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off', // Some scripts use require
    },
  },

  // Test files - relaxed rules
  {
    files: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off', // Jest globals
    },
  },

  // Prettier (must be last to override other rules)
  eslintConfigPrettier,
];
