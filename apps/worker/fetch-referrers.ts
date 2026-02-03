#!/usr/bin/env bun
/* eslint-disable no-console */
import { writeFileSync } from 'fs';
import { join } from 'path';

type OriginalReferrerData = Record<
  string,
  Record<
    string,
    {
      domains: string[];
    }
  >
>;

type ReferrerData = Record<
  string,
  {
    name: string;
    type: string;
  }
>;

const customReferrers = {
  'bsky.app': { name: 'Bluesky', type: 'social' },
  'chatgpt.com': { name: 'ChatGPT', type: 'llm' },
  'perplexity.ai': { name: 'Perplexity', type: 'llm' },
  perplexity: { name: 'Perplexity', type: 'llm' },
  'statics.teams.cdn.office.net': { name: 'Microsoft Teams', type: 'social' },
  'teams.microsoft.com': { name: 'Microsoft Teams', type: 'social' },
  'vemetric.com': { name: 'Vemetric', type: 'unknown' },
  'chat.deepseek.com': { name: 'DeepSeek', type: 'llm' },
  'chat.mistral.ai': { name: 'Mistral', type: 'llm' },
  'gemini.google.com': { name: 'Google Gemini', type: 'llm' },
  'claude.ai': { name: 'Claude', type: 'llm' },
  'search.brave.com': { name: 'Brave', type: 'search' },
  'ya.ru': { name: 'Yandex', type: 'search' },
  'yandex.kz': { name: 'Yandex', type: 'search' },
  'yandex.com.tr': { name: 'Yandex', type: 'search' },
  'api.x.com': { name: 'X', type: 'social' },
  'x.com': { name: 'X', type: 'social' },
  'np.reddit.com': { name: 'Reddit', type: 'social' },
  'out.reddit.com': { name: 'Reddit', type: 'social' },
  'old.reddit.com': { name: 'Reddit', type: 'social' },
  'com.reddit.frontpage': { name: 'Reddit', type: 'social' },
  'threads.com': { name: 'Threads', type: 'social' },
  'l.threads.com': { name: 'Threads', type: 'social' },
  'copilot.microsoft.com': { name: 'Microsoft Copilot', type: 'llm' },
  'discord.com': { name: 'Discord', type: 'social' },
};

function transformReferrerData(originalData: OriginalReferrerData): {
  transformedData: ReferrerData;
  referrerUrlMap: Record<string, string>;
} {
  const transformedData: ReferrerData = {};
  const referrerUrlMap: Record<string, string> = {};

  // Iterate through each type (e.g., "social", "search", etc.)
  for (const [type, sources] of Object.entries(originalData)) {
    // Iterate through each source and its domains
    for (const [sourceName, sourceData] of Object.entries(sources)) {
      // Add each domain as a key in the transformed data
      for (const originalDomain of sourceData.domains) {
        const domain = originalDomain.startsWith('www.') ? originalDomain.slice(4) : originalDomain;

        if (!referrerUrlMap[sourceName]) {
          referrerUrlMap[sourceName] = domain;
        }

        transformedData[domain] = {
          name: sourceName,
          type: type,
        };
      }
    }
  }

  return { transformedData, referrerUrlMap };
}

async function fetchReferrers() {
  try {
    const response = await fetch(
      'https://s3-eu-west-1.amazonaws.com/snowplow-hosted-assets/third-party/referer-parser/referers-latest.json',
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch referrers: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OriginalReferrerData;

    // Transform the data
    const { transformedData, referrerUrlMap } = transformReferrerData(data);

    Object.entries(customReferrers).forEach(([domain, referrer]) => {
      if (referrerUrlMap[referrer.name]) {
        return;
      }
      referrerUrlMap[referrer.name] = domain;
    });

    // Convert the data to a TypeScript constant
    const tsContent = `// Auto-generated file from fetch-referrers.ts
// Source: https://s3-eu-west-1.amazonaws.com/snowplow-hosted-assets/third-party/referer-parser/referers-latest.json

export const referrers = ${JSON.stringify({ ...transformedData, ...customReferrers })};
`;

    // Write to src/consts/referrers.ts
    const outputPath = join(process.cwd(), 'src', 'consts', 'referrers.ts');
    writeFileSync(outputPath, tsContent, 'utf-8');
    console.log('Successfully wrote referrers data to src/consts/referrers.ts');

    const referrerTypes = new Set(
      Object.values({ ...transformedData, ...customReferrers }).map((referrer) => referrer.type),
    );

    const tsContentTypes = `// Auto-generated file from fetch-referrers.ts
    
export const REFERRER_URL_MAP = ${JSON.stringify(referrerUrlMap)};
export const REFERRER_TYPES = ${JSON.stringify([...Array.from(referrerTypes), 'direct'])};`;

    const outputPathTypes = join(process.cwd(), '..', 'app', 'src', 'consts', 'referrer-types.ts');
    writeFileSync(outputPathTypes, tsContentTypes, 'utf-8');
  } catch (error) {
    console.error('Error fetching referrers:', error);
    process.exit(1);
  }
}

// Execute the fetch
fetchReferrers();
