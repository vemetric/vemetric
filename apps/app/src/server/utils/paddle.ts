import type { Environment } from '@paddle/paddle-node-sdk';
import { LogLevel, Paddle } from '@paddle/paddle-node-sdk';

export const paddleApi = new Paddle(process.env.PADDLE_API_KEY ?? '', {
  environment: (process.env.PADDLE_ENVIRONMENT as Environment) ?? 'sandbox',
  logLevel: LogLevel.warn,
});
