import { config as reactConfig } from '@vemetric/eslint-config/react-internal';
import { config as nodeConfig } from '@vemetric/eslint-config/node';

/** @type {import('eslint').Linter.Config} */
export default [
  ...reactConfig.map((entry) => ({
    ...entry,
    rules: {
      ...entry.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/src/backend/**', '**/backend/**', '@/backend/**'],
        },
      ],
    },
    files: ['src/frontend/**/*.{ts,tsx}'],
  })),
  ...nodeConfig.map((entry) => ({
    ...entry,
    rules: {
      ...entry.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/src/frontend/**', '**/frontend/**', '@/**'],
        },
      ],
    },
    files: ['src/backend/**/*.{ts,tsx}'],
  })),
];
