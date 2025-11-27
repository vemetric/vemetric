import { logger } from './logger';
import { bots } from '../consts/bots';
import type { HonoContext } from '../types';

const suspiciousSingaporeUserAgent =
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.114 Safari/537.36';

export function isBot(context: HonoContext) {
  const {
    req,
    var: { geoData },
  } = context;

  const userAgent = req.header('user-agent') ?? '';

  if (geoData.countryCode === 'SG' && userAgent === suspiciousSingaporeUserAgent) {
    // this is suspicious bot traffic from Singapore with rotating IP Addresses
    return true;
  }

  const isCloudflareVerifiedBot = req.header('cf-verified-bot') === 'true';
  if (isCloudflareVerifiedBot) {
    return true;
  }

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
