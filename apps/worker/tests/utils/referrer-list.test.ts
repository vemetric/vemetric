import { describe, expect, it, vi } from 'vitest';
import { getReferrer } from '../../src/utils/referrer';

vi.mock('../../src/utils/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('database', () => ({ dbProject: { findById: vi.fn() } }));

// Uses the real referrer list, so the custom entries (apps/worker/fetch-referrers.ts) stay in the generated file.
describe('referrer list', () => {
  it.each([
    ['https://kagi.com/search?q=analytics', 'Kagi', 'search'],
    ['https://cn.bing.com/', 'Bing', 'search'],
    ['https://noai.duckduckgo.com/', 'DuckDuckGo', 'search'],
    ['https://html.duckduckgo.com/', 'DuckDuckGo', 'search'],
    ['https://start.duckduckgo.com/', 'DuckDuckGo', 'search'],
    ['https://r.search.yahoo.com/', 'Yahoo!', 'search'],
    ['https://ph.search.yahoo.com/', 'Yahoo!', 'search'],
    ['https://www.startpage.com/', 'Startpage', 'search'],
    ['https://safe.search.brave.com/', 'Brave', 'search'],
    ['https://yandex.uz/', 'Yandex', 'search'],
    ['https://search.nortonsafesearch.com/', 'Norton Safe Search', 'search'],
    ['https://www.doubao.com/chat', 'Doubao', 'llm'],
    ['https://www.kimi.com/', 'Kimi', 'llm'],
    ['https://copilot.com/', 'Microsoft Copilot', 'llm'],
    ['https://edgeservices.bing.com/', 'Microsoft Copilot', 'llm'],
    ['https://grok.com/', 'Grok', 'llm'],
    ['https://notebooklm.google.com/', 'NotebookLM', 'llm'],
    ['https://aistudio.google.com/', 'Google AI Studio', 'llm'],
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/x', 'Google Gemini', 'llm'],
    ['https://m.youtube.com/watch?v=x', 'Youtube', 'social'],
    ['https://go.bsky.app/x', 'Bluesky', 'social'],
    ['https://teams.public.onecdn.static.microsoft/', 'Microsoft Teams', 'social'],
    ['https://l.wl.co/l?u=x', 'WhatsApp', 'social'],
  ])('types %s as %s (%s)', (url, name, type) => {
    expect(getReferrer('example.com', url)).toEqual({ referrer: name, referrerUrl: url, referrerType: type });
  });

  it.each([
    ['gemini', 'Google Gemini', 'llm'],
    ['openai', 'ChatGPT', 'llm'],
    ['threads', 'Threads', 'social'],
    ['kagi.com', 'Kagi', 'search'],
  ])('types the param value %s as %s (%s)', (paramValue, name, type) => {
    expect(getReferrer('example.com', undefined, paramValue)).toEqual({
      referrer: name,
      referrerUrl: '',
      referrerType: type,
    });
  });

  it.each(['fb', 'ig', 'google'])('keeps the campaign param %s unknown', (paramValue) => {
    expect(getReferrer('example.com', undefined, paramValue).referrerType).toBe('unknown');
  });

  it('keeps Google tools without a category', () => {
    expect(getReferrer('example.com', 'https://accounts.google.com/').referrerType).toBe('unknown');
    expect(getReferrer('example.com', 'https://docs.google.com/document/d/x').referrerType).toBe('unknown');
  });
});
