import type { UsageStats } from '@vemetric/common/usage';
import { clickhouseEvent } from 'clickhouse';
import type { BillingInfo, Organization } from 'database';
import { dbProject } from 'database';
import { addMonths, setDate, getDate, subMonths, subDays, format } from 'date-fns';

// Cache for usage cycles with stale-while-revalidate pattern
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: UsageStats[];
  timestamp: number;
}

const usageCyclesCache = new Map<string, CacheEntry>();

export async function getUsageForPeriod(organizationId: string, startDate: Date, endDate: Date): Promise<UsageStats> {
  const projects = await dbProject.findByOrganizationId(organizationId);

  const usageStats = await clickhouseEvent.getUsagePerProject(
    projects.map((project) => project.id),
    startDate,
    endDate,
  );
  const perProject = projects.map((project) => {
    return {
      name: project.name,
      domain: project.domain,
      events: usageStats.find((stat) => stat.projectId === project.id)?.events ?? 0,
    };
  });
  const total = perProject.reduce((acc, curr) => acc + curr.events, 0);

  return {
    total,
    periodStart: format(startDate, 'yyyy-MM-dd'),
    // Show inclusive end date (day before the exclusive end date) for user-friendly display
    periodEnd: format(subDays(endDate, 1), 'yyyy-MM-dd'),
    perProject,
  };
}

export function getCurrentCycleDates(organization: Organization, billingInfo: BillingInfo | null) {
  const usageResetDate = billingInfo
    ? (billingInfo.subscriptionEndDate ?? billingInfo.createdAt)
    : organization.createdAt;
  const usageResetDay = getDate(usageResetDate);

  let endDate = new Date();
  const currentDay = getDate(endDate);
  endDate = setDate(endDate, usageResetDay);
  if (currentDay >= usageResetDay) {
    endDate = addMonths(endDate, 1);
  }
  const startDate = addMonths(endDate, -1);

  return { startDate, endDate };
}

async function computeUsageCycles(
  organizationId: string,
  organization: Organization,
  billingInfo: BillingInfo | null,
  numberOfPastCycles: number,
): Promise<UsageStats[]> {
  const currentCycle = getCurrentCycleDates(organization, billingInfo);
  const cycles: UsageStats[] = [];

  // Current cycle (index 0)
  const currentUsage = await getUsageForPeriod(organizationId, currentCycle.startDate, currentCycle.endDate);
  cycles.push(currentUsage);

  // Past cycles (index 1, 2, ...)
  for (let i = 1; i <= numberOfPastCycles; i++) {
    const pastCycleEndDate = subMonths(currentCycle.endDate, i);
    const pastCycleStartDate = subMonths(currentCycle.endDate, i + 1);

    const pastUsage = await getUsageForPeriod(organizationId, pastCycleStartDate, pastCycleEndDate);
    cycles.push(pastUsage);
  }

  return cycles;
}

/**
 * Returns usage cycles in descending order (current cycle first, then past cycles).
 * Index 0 is always the current cycle.
 *
 * Uses in-memory cache with stale-while-revalidate pattern:
 * - Returns cached data immediately if available
 * - If cache is stale, triggers background refresh and returns stale data
 * - Cache TTL is 5 minutes
 */
export async function getUsageCycles(
  organizationId: string,
  organization: Organization,
  billingInfo: BillingInfo | null,
  numberOfPastCycles: number = 2,
): Promise<UsageStats[]> {
  const cacheKey = organizationId;
  const cached = usageCyclesCache.get(cacheKey);
  const now = Date.now();

  if (cached) {
    const isStale = now - cached.timestamp > CACHE_TTL_MS;

    if (isStale) {
      // Trigger background refresh
      computeUsageCycles(organizationId, organization, billingInfo, numberOfPastCycles).then((data) => {
        usageCyclesCache.set(cacheKey, { data, timestamp: Date.now() });
      });
    }

    // Return cached data (even if stale)
    return cached.data;
  }

  // No cache, compute synchronously
  const data = await computeUsageCycles(organizationId, organization, billingInfo, numberOfPastCycles);
  usageCyclesCache.set(cacheKey, { data, timestamp: now });
  return data;
}
