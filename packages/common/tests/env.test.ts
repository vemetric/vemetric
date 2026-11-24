import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMcpUrl } from '../src/env';

describe('getMcpUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses MCP_URL when set', () => {
    vi.stubEnv('MCP_URL', 'https://mcp.vemetric.com/mcp');
    vi.stubEnv('DOMAIN', 'vemetric.com');
    expect(getMcpUrl()).toBe('https://mcp.vemetric.com/mcp');
  });

  it('is /mcp on the app otherwise', () => {
    vi.stubEnv('MCP_URL', '');
    vi.stubEnv('DOMAIN', 'vemetric.com');
    expect(getMcpUrl()).toBe('https://app.vemetric.com/mcp');
  });

  it("uses the app's dev server behind the dev proxy, since an http resource URL must be on localhost", () => {
    vi.stubEnv('MCP_URL', '');
    vi.stubEnv('DOMAIN', '');
    expect(getMcpUrl()).toBe('http://localhost:4000/mcp');
    vi.stubEnv('DOMAIN', 'vemetric.localhost:4050');
    expect(getMcpUrl()).toBe('http://localhost:4000/mcp');
  });
});
