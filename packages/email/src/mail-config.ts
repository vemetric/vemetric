/** Default sender used for transactional mails when no override is configured. */
export const TRANSACTIONAL_FROM_EMAIL = 'Vemetric <info@vemetric.com>';
/** Default sender used for tips/drip mails when no override is configured. */
export const TIPS_FROM_EMAIL = 'Vemetric <info@notifications.vemetric.com>';

export type MailProvider = 'postmark' | 'smtp';

const MAIL_PROVIDERS: ReadonlyArray<MailProvider> = ['postmark', 'smtp'];

/**
 * Resolves the mail provider to use.
 *
 * An explicit `MAIL_PROVIDER` always wins. Without it we fall back to SMTP as soon as
 * `SMTP_HOST` is set, which keeps existing Postmark based deployments working unchanged.
 */
export function getMailProvider(): MailProvider {
  const configured = process.env.MAIL_PROVIDER?.trim().toLowerCase();

  if (configured) {
    const provider = MAIL_PROVIDERS.find((candidate) => candidate === configured);
    if (!provider) {
      throw new Error(`Invalid MAIL_PROVIDER. Supported values are: ${MAIL_PROVIDERS.join(', ')}.`);
    }
    return provider;
  }

  return process.env.SMTP_HOST?.trim() ? 'smtp' : 'postmark';
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  rejectUnauthorized: boolean;
}

function parsePort(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid SMTP_PORT. Expected an integer between 1 and 65535.');
  }

  return port;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }

  throw new Error('Invalid boolean environment value. Expected "true" or "false".');
}

/**
 * Reads and validates the SMTP configuration from the environment.
 *
 * Credentials are optional so that unauthenticated relays inside a private network keep working,
 * but user and password have to be provided together to avoid half configured setups.
 */
export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new Error('SMTP_HOST is not specified.');
  }

  const port = parsePort(process.env.SMTP_PORT, 587);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const rejectUnauthorized = parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;

  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('Incomplete SMTP credentials. Set both SMTP_USER and SMTP_PASSWORD, or neither.');
  }

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    rejectUnauthorized,
  };
}

/**
 * Validates the mail configuration once at startup.
 *
 * The built in sender addresses belong to vemetric.com and only pass SPF and DMARC when mail
 * goes out through Vemetric's own Postmark account. An SMTP server run by someone else sending
 * as vemetric.com gets rejected or lands in spam, and since `sendMail` never throws, that
 * failure would stay invisible. A configured SMTP server therefore requires an explicit
 * `MAIL_FROM_ADDRESS`. Without `SMTP_HOST` no mail is sent at all, so there is nothing to check.
 * @throws {Error} If `MAIL_PROVIDER` is invalid, or SMTP is configured without a sender address.
 */
export function assertMailConfig(): void {
  if (getMailProvider() !== 'smtp' || !process.env.SMTP_HOST?.trim()) {
    return;
  }

  if (!process.env.MAIL_FROM_ADDRESS?.trim()) {
    throw new Error(
      'MAIL_FROM_ADDRESS is required when SMTP_HOST is set. Use an address on a domain your SMTP server is allowed to send for.',
    );
  }
}

/** Sender address for transactional mails, overridable via `MAIL_FROM_ADDRESS`. */
export function getTransactionalFromAddress(): string {
  return process.env.MAIL_FROM_ADDRESS?.trim() || TRANSACTIONAL_FROM_EMAIL;
}

/** Sender address for tips/drip mails, overridable via `MAIL_TIPS_FROM_ADDRESS`. */
export function getTipsFromAddress(): string {
  return process.env.MAIL_TIPS_FROM_ADDRESS?.trim() || process.env.MAIL_FROM_ADDRESS?.trim() || TIPS_FROM_EMAIL;
}
