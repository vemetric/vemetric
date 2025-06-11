import pino from 'pino';

export const createLogger = (appName: string) =>
  pino(
    {
      level: process.env.AXIOM_TOKEN ? 'info' : 'debug',
      mixin: () => ({
        appName,
      }),
    },
    process.env.AXIOM_TOKEN
      ? pino.transport({
          target: '@axiomhq/pino',
          options: {
            dataset: 'vemetric',
            token: process.env.AXIOM_TOKEN,
          },
        })
      : pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'appName',
          },
        }),
  );
