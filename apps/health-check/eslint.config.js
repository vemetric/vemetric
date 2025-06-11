import { config } from '@vemetric/eslint-config/node';

/** @type {import('eslint').Linter.Config} */
export default [
  ...config,
  {
    rules: {
      'no-console': 'off',
    },
  },
];
