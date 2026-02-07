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
          patterns: [
            {
              group: ['**/src/backend/**', '**/backend/**', '@/backend/**'],
              message: 'Frontend modules must not import backend code. Move shared logic to a common module instead.',
            },
          ],
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
          patterns: [
            {
              group: ['**/src/frontend/**', '**/frontend/**', '@/**'],
              message:
                'Backend modules must not import frontend code or frontend-only aliases. Keep backend runtime dependencies server-only.',
            },
          ],
        },
      ],
    },
    files: ['src/backend/**/*.{ts,tsx}'],
  })),
  {
    files: ['src/backend/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/backend-logger'],
              message: 'Public API code must use api-logger.ts to keep API logs separated from backend logs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/backend/**/*.{ts,tsx}'],
    ignores: ['src/backend/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api-logger'],
              message: 'Non-API backend code must use backend-logger.ts and must not write to the API logger stream.',
            },
          ],
        },
      ],
    },
  },
];
