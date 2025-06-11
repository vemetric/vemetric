#!/usr/bin/env bun
/* eslint-disable no-console */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

const customBots = [
  {
    regex: 'SEBot-WA',
    name: 'SEBot-WA',
  },
  {
    regex: 'vercel-screenshot',
    name: 'Vercel Screenshot',
  },
  {
    regex: 'PhantomJsCloud\\.com',
    name: 'PhantomJsCloud',
  },
  {
    regex: 'YisouSpider',
    name: 'YisouSpider',
  },
];

async function fetchBots() {
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/matomo-org/device-detector/master/regexes/bots.yml',
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch bots: ${response.status} ${response.statusText}`);
    }

    const yamlData = await response.text();

    const data = load(yamlData) as any;
    const bots = [...data, ...customBots];

    // Convert the data to a TypeScript constant
    const tsContent = `// Auto-generated file from fetch-bots.ts
// Source: https://raw.githubusercontent.com/matomo-org/device-detector/master/regexes/bots.yml

export const bots = ${JSON.stringify(bots)};
`;

    // Write to src/consts/bots.ts
    const outputPath = join(process.cwd(), 'src', 'consts', 'bots.ts');
    writeFileSync(outputPath, tsContent, 'utf-8');
    console.log('Successfully wrote bots data to src/consts/bots.ts');
  } catch (error) {
    console.error('Error fetching bots:', error);
    process.exit(1);
  }
}

// Execute the fetch
fetchBots();
