import { getClientIp } from '@vemetric/common/request-ip';
import { dbUserIdentificationMap, dbSalt, generateUserId } from 'database';
import { HTTPException } from 'hono/http-exception';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { HonoContext } from '../../src/types';
import { getUserIdFromCookie } from '../../src/utils/cookie';
import { getUserIdFromRequest } from '../../src/utils/request';
import { hasActiveSession } from '../../src/utils/session';

// Mock dependencies
vi.mock('../../src/utils/cookie', () => ({
  getUserIdFromCookie: vi.fn(),
}));

vi.mock('../../src/utils/session', () => ({
  hasActiveSession: vi.fn(),
}));

vi.mock('@vemetric/common/request-ip', () => ({
  getClientIp: vi.fn(),
}));

vi.mock('database', () => ({
  dbUserIdentificationMap: {
    findByIdentifier: vi.fn(),
  },
  dbSalt: {
    getLatestSalts: vi.fn(),
  },
  generateUserId: vi.fn(),
}));

describe('getUserIdFromRequest', () => {
  const mockHeader = vi.fn() as Mock;
  const mockJson = vi.fn() as Mock;

  const mockContext = {
    req: {
      header: mockHeader,
      json: mockJson,
      path: '/test',
    },
    var: {
      projectId: BigInt(123),
      project: {
        id: BigInt(123),
        name: 'Test Project',
      },
      allowCookies: true,
    },
    env: {},
    finalized: false,
    error: null,
    event: {} as FetchEvent,
  } as unknown as HonoContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeader.mockImplementation((name: string) => {
      if (name === 'user-agent') return 'test-agent';
      return null;
    });
  });

  it('should return userId from cookie if available', async () => {
    const mockUserId = BigInt(123);
    vi.mocked(getUserIdFromCookie).mockReturnValue(mockUserId);

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(mockUserId);
    expect(getUserIdFromCookie).toHaveBeenCalledWith(mockContext);
  });

  it('should return userId from API call identifier', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({ userIdentifier: 'api-user-123' });
    vi.mocked(dbUserIdentificationMap.findByIdentifier).mockResolvedValue({
      userId: '456',
      identifier: 'api-user-123',
      projectId: '123',
    });

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(BigInt(456));
    expect(dbUserIdentificationMap.findByIdentifier).toHaveBeenCalledWith('123', 'api-user-123');
  });

  it('should throw 401 if API user identifier not found', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({ userIdentifier: 'non-existent' });
    vi.mocked(dbUserIdentificationMap.findByIdentifier).mockResolvedValue(null);

    await expect(getUserIdFromRequest(mockContext)).rejects.toThrow(HTTPException);
  });

  it('should return userId from browser identifier', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({ identifier: 'browser-user-123' });
    vi.mocked(dbUserIdentificationMap.findByIdentifier).mockResolvedValue({
      userId: '789',
      identifier: 'browser-user-123',
      projectId: '123',
    });

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(BigInt(789));
    expect(dbUserIdentificationMap.findByIdentifier).toHaveBeenCalledWith('123', 'browser-user-123');
  });

  it('should return null if cookies allowed and no identifier found', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({});
    Object.defineProperty(mockContext.var, 'allowCookies', { value: true });

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBeNull();
  });

  it('should generate userId from IP and UserAgent when cookies not allowed', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({});
    Object.defineProperty(mockContext.var, 'allowCookies', { value: false });
    vi.mocked(dbSalt.getLatestSalts).mockResolvedValue({
      currentSalt: { id: 'current-salt', createdAt: new Date() },
      previousSalt: { id: 'previous-salt', createdAt: new Date() },
    });
    vi.mocked(hasActiveSession).mockResolvedValue(false);
    vi.mocked(generateUserId).mockReturnValue(BigInt(999));
    vi.mocked(getClientIp).mockReturnValue('127.0.0.1');

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(BigInt(999));
    expect(generateUserId).toHaveBeenCalledWith({
      projectId: BigInt(123),
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      salt: 'current-salt',
    });
  });

  it('should use previous salt if active session exists', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({});
    Object.defineProperty(mockContext.var, 'allowCookies', { value: false });
    vi.mocked(dbSalt.getLatestSalts).mockResolvedValue({
      currentSalt: { id: 'current-salt', createdAt: new Date() },
      previousSalt: { id: 'previous-salt', createdAt: new Date() },
    });
    vi.mocked(hasActiveSession).mockResolvedValue(true);
    vi.mocked(generateUserId).mockReturnValue(BigInt(888));
    vi.mocked(getClientIp).mockReturnValue('192.168.1.1');

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(BigInt(888));
    expect(generateUserId).toHaveBeenCalledWith({
      projectId: BigInt(123),
      ipAddress: '192.168.1.1',
      userAgent: 'test-agent',
      salt: 'previous-salt',
    });
  });

  it('should generate random userId if no user agent', async () => {
    vi.mocked(getUserIdFromCookie).mockReturnValue(null);
    mockJson.mockResolvedValue({});
    Object.defineProperty(mockContext.var, 'allowCookies', { value: false });
    mockHeader.mockImplementation(() => null);
    vi.mocked(generateUserId).mockReturnValue(BigInt(777));

    const result = await getUserIdFromRequest(mockContext);
    expect(result).toBe(BigInt(777));
    expect(generateUserId).toHaveBeenCalledWith();
  });
});
