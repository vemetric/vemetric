import pino from 'pino';

type TransportTarget = pino.TransportTargetOptions<Record<string, unknown>>;

const getDefaultTransportTarget = (): TransportTarget =>
  process.env.AXIOM_TOKEN
    ? {
        target: '@axiomhq/pino',
        options: {
          dataset: 'vemetric',
          token: process.env.AXIOM_TOKEN,
        },
      }
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'appName',
        },
      };

const createTransport = () => {
  const logFile = process.env.LOG_FILE;
  return pino.transport({
    targets: [
      getDefaultTransportTarget(),
      ...(logFile
        ? [
            {
              target: 'pino/file',
              options: {
                destination: logFile,
                mkdir: true,
              },
            },
          ]
        : []),
    ],
  });
};

export const createLogger = (appName: string) =>
  pino(
    {
      level: process.env.AXIOM_TOKEN ? 'info' : 'debug',
      mixin: () => ({
        appName,
      }),
    },
    createTransport(),
  );
