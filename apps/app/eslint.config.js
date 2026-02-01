import { config as reactConfig } from '@vemetric/eslint-config/react-internal';
import { config as nodeConfig } from '@vemetric/eslint-config/node';

/** @type {import('eslint').Linter.Config} */
export default [
  ...reactConfig.map((entry) => ({
    ...entry,
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/**'],
  })),
  ...nodeConfig.map((entry) => ({
    ...entry,
    files: ['src/server/**/*.{ts,tsx}'],
  })),
];
