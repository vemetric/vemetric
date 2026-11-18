import { logger } from './logger';
import { bots } from '../consts/bots';
import type { HonoContext } from '../types';

const suspiciousSingaporeUserAgent =
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.114 Safari/537.36';

// Compiled the way Matomo's device detector applies its bots.yml: case-insensitive, and the match has to
// start at the beginning or after a non-word character. Matching case-sensitively missed e.g. "GrokBot/1.0".
const botRegexes = bots.flatMap((bot) => {
  try {
    return [new RegExp(`(?:^|[^A-Z0-9_\\-])(?:${bot.regex})`, 'i')];
  } catch (error) {
    logger.error(`Invalid bot regex for ${bot.name}: ${error}`);
    return [];
  }
});

export function isBotUserAgent(userAgent: string) {
  return botRegexes.some((regex) => regex.test(userAgent));
}

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

  if (isBotUserAgent(userAgent)) {
    return true;
  }

  if (userAgent.toLowerCase().includes('bot')) {
    logger.info('No bot detected, but potential bot: ' + userAgent);
  }

  return false;
}
