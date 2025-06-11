import { clickhouseEvent } from 'clickhouse';
import { dbProject } from 'database';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUsagePerOrganization, getCurrentUsageCycle } from '../../src/utils/usage';

// Mock the database and clickhouse modules
vi.mock('database', () => ({
  dbProject: {
    findByOrganizationId: vi.fn(),
  },
}));

vi.mock('clickhouse', () => ({
  clickhouseEvent: {
    getUsagePerProject: vi.fn(),
  },
}));

describe('getUsagePerOrganization', () => {
  const mockProjects = [
    { id: '1', name: 'Project 1', domain: 'project1.com' },
    { id: '2', name: 'Project 2', domain: 'project2.com' },
  ];

  const mockUsageStats = [
    { projectId: '1', events: 100 },
    { projectId: '2', events: 200 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (dbProject.findByOrganizationId as any).mockResolvedValue(mockProjects);
    (clickhouseEvent.getUsagePerProject as any).mockResolvedValue(mockUsageStats);
  });

  it('should return usage stats for all projects in an organization', async () => {
    const result = await getUsagePerOrganization('org-1', new Date('2024-01-01'), new Date('2024-01-31'));

    expect(dbProject.findByOrganizationId).toHaveBeenCalledWith('org-1');
    expect(clickhouseEvent.getUsagePerProject).toHaveBeenCalledWith(['1', '2'], expect.any(Date), expect.any(Date));

    expect(result).toEqual({
      total: 300,
      perProject: [
        { name: 'Project 1', domain: 'project1.com', events: 100 },
        { name: 'Project 2', domain: 'project2.com', events: 200 },
      ],
    });
  });

  it('should handle projects with no usage data', async () => {
    (clickhouseEvent.getUsagePerProject as any).mockResolvedValue([{ projectId: '1', events: 100 }]);

    const result = await getUsagePerOrganization('org-1', new Date('2024-01-01'), new Date('2024-01-31'));

    expect(result).toEqual({
      total: 100,
      perProject: [
        { name: 'Project 1', domain: 'project1.com', events: 100 },
        { name: 'Project 2', domain: 'project2.com', events: 0 },
      ],
    });
  });

  it('should handle empty project list', async () => {
    (dbProject.findByOrganizationId as any).mockResolvedValue([]);
    (clickhouseEvent.getUsagePerProject as any).mockResolvedValue([]);

    const result = await getUsagePerOrganization('org-1', new Date('2024-01-01'), new Date('2024-01-31'));

    expect(result).toEqual({
      total: 0,
      perProject: [],
    });
  });
});

describe('getCurrentUsageCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate usage cycle based on subscription end date', async () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2023-01-01'),
    } as any;

    const billingInfo = {
      subscriptionEndDate: new Date('2024-02-13'),
      createdAt: new Date('2023-10-04'),
    } as any;

    const result = await getCurrentUsageCycle(organization, billingInfo);

    expect(result).toEqual({
      startDate: new Date('2025-01-13T12:00:00.000Z'),
      endDate: new Date('2025-02-13T12:00:00.000Z'),
    });
  });

  it('should calculate usage cycle based on billing info creation date when no subscription end date', async () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2023-01-01'),
    } as any;

    const billingInfo = {
      subscriptionEndDate: null,
      createdAt: new Date('2024-01-10'),
    } as any;

    const result = await getCurrentUsageCycle(organization, billingInfo);

    expect(result).toEqual({
      startDate: new Date('2025-01-10T12:00:00.000Z'),
      endDate: new Date('2025-02-10T12:00:00.000Z'),
    });
  });

  it('should calculate usage cycle based on organization creation date when no billing info', async () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-10'),
    } as any;

    const result = await getCurrentUsageCycle(organization, null);

    expect(result).toEqual({
      startDate: new Date('2025-01-10T12:00:00.000Z'),
      endDate: new Date('2025-02-10T12:00:00.000Z'),
    });
  });

  it('should handle usage reset day in current month', async () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-20'),
    } as any;

    const result = await getCurrentUsageCycle(organization, null);

    expect(result).toEqual({
      startDate: new Date('2024-12-20T12:00:00.000Z'),
      endDate: new Date('2025-01-20T12:00:00.000Z'),
    });
  });

  it('should handle usage reset day in next month', async () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-05'),
    } as any;

    const result = await getCurrentUsageCycle(organization, null);

    expect(result).toEqual({
      startDate: new Date('2025-01-05T12:00:00.000Z'),
      endDate: new Date('2025-02-05T12:00:00.000Z'),
    });
  });
});
