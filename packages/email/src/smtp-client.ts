import type { Transporter } from 'nodemailer';
import { getSmtpConfig } from './mail-config';

let cachedTransporter: Transporter | null = null;

/**
 * Returns a cached nodemailer transport built from the SMTP environment configuration.
 *
 * The transport keeps a connection pool so that drip sequences sending many mails in a row
 * do not open a new SMTP session per message.
 */
export async function getSmtpTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();
  const nodemailer = await import('nodemailer');

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    pool: true,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized,
    },
  });

  return cachedTransporter;
}
