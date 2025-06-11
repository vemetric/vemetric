import type { HonoRequest } from 'hono';
import { logger } from './logger';
import { bots } from '../consts/bots';

export function isBot(req: HonoRequest) {
  const isCloudflareVerifiedBot = req.header('cf-verified-bot') === 'true';
  if (isCloudflareVerifiedBot) {
    return true;
  }

  const userAgent = req.header('user-agent') ?? '';
  for (const bot of bots) {
    try {
      if (new RegExp(bot.regex).test(userAgent)) {
        return true;
      }
    } catch (error) {
      logger.error('Error detecting bot: ' + error);
    }
  }

  if (userAgent.toLowerCase().includes('bot')) {
    logger.info('No bot detected, but potential bot: ' + userAgent);
  }

  return false;
}
