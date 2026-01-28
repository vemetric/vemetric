import { clickhouseEvent } from 'clickhouse';
import { dbProject } from 'database';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUsageForPeriod, getCurrentCycleDates } from './usage';

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

describe('getUsageForPeriod', () => {
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
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const result = await getUsageForPeriod('org-1', startDate, endDate);

    expect(dbProject.findByOrganizationId).toHaveBeenCalledWith({
      organizationId: 'org-1',
    });
    expect(clickhouseEvent.getUsagePerProject).toHaveBeenCalledWith(['1', '2'], expect.any(Date), expect.any(Date));

    expect(result).toEqual({
      total: 300,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-30', // Inclusive end date (day before exclusive end)
      perProject: [
        { name: 'Project 1', domain: 'project1.com', events: 100 },
        { name: 'Project 2', domain: 'project2.com', events: 200 },
      ],
    });
  });

  it('should handle projects with no usage data', async () => {
    (clickhouseEvent.getUsagePerProject as any).mockResolvedValue([{ projectId: '1', events: 100 }]);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const result = await getUsageForPeriod('org-1', startDate, endDate);

    expect(result).toEqual({
      total: 100,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-30', // Inclusive end date (day before exclusive end)
      perProject: [
        { name: 'Project 1', domain: 'project1.com', events: 100 },
        { name: 'Project 2', domain: 'project2.com', events: 0 },
      ],
    });
  });

  it('should handle empty project list', async () => {
    (dbProject.findByOrganizationId as any).mockResolvedValue([]);
    (clickhouseEvent.getUsagePerProject as any).mockResolvedValue([]);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const result = await getUsageForPeriod('org-1', startDate, endDate);

    expect(result).toEqual({
      total: 0,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-30', // Inclusive end date (day before exclusive end)
      perProject: [],
    });
  });
});

describe('getCurrentCycleDates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate usage cycle based on subscription end date', () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2023-01-01'),
    } as any;

    const billingInfo = {
      subscriptionEndDate: new Date('2024-02-13'),
      createdAt: new Date('2023-10-04'),
    } as any;

    const result = getCurrentCycleDates(organization, billingInfo);

    expect(result).toEqual({
      startDate: new Date('2025-01-13T12:00:00.000Z'),
      endDate: new Date('2025-02-13T12:00:00.000Z'),
    });
  });

  it('should calculate usage cycle based on billing info creation date when no subscription end date', () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2023-01-01'),
    } as any;

    const billingInfo = {
      subscriptionEndDate: null,
      createdAt: new Date('2024-01-10'),
    } as any;

    const result = getCurrentCycleDates(organization, billingInfo);

    expect(result).toEqual({
      startDate: new Date('2025-01-10T12:00:00.000Z'),
      endDate: new Date('2025-02-10T12:00:00.000Z'),
    });
  });

  it('should calculate usage cycle based on organization creation date when no billing info', () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-10'),
    } as any;

    const result = getCurrentCycleDates(organization, null);

    expect(result).toEqual({
      startDate: new Date('2025-01-10T12:00:00.000Z'),
      endDate: new Date('2025-02-10T12:00:00.000Z'),
    });
  });

  it('should handle usage reset day in current month', () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-20'),
    } as any;

    const result = getCurrentCycleDates(organization, null);

    expect(result).toEqual({
      startDate: new Date('2024-12-20T12:00:00.000Z'),
      endDate: new Date('2025-01-20T12:00:00.000Z'),
    });
  });

  it('should handle usage reset day in next month', () => {
    const organization = {
      id: 'org-1',
      createdAt: new Date('2024-01-05'),
    } as any;

    const result = getCurrentCycleDates(organization, null);

    expect(result).toEqual({
      startDate: new Date('2025-01-05T12:00:00.000Z'),
      endDate: new Date('2025-02-05T12:00:00.000Z'),
    });
  });
});
