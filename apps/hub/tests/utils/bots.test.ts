import { describe, expect, it } from 'vitest';
import { isBotUserAgent } from '../../src/utils/bots';

describe('isBotUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; MoonshotBot/1.0; +https://kimi.ai/)',
    'Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai/)',
    'Mozilla/5.0 (compatible; DeepSeekBot/1.0; +https://www.deepseek.com/)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ])('detects %s', (userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36 Instagram 357.0.0.48.80 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; en_US; 654321)',
  ])('does not flag the browser %s', (userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(false);
  });
});
