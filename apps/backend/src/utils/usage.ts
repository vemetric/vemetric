import type { UsageStats } from '@vemetric/common/usage';
import { clickhouseEvent } from 'clickhouse';
import type { BillingInfo, Organization } from 'database';
import { dbProject } from 'database';
import { addMonths, setDate, getDate } from 'date-fns';

export async function getUsagePerOrganization(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<UsageStats> {
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
    perProject,
  };
}

export async function getCurrentUsageCycle(organization: Organization, billingInfo: BillingInfo | null) {
  const usageResetDate = billingInfo
    ? billingInfo.subscriptionEndDate ?? billingInfo.createdAt
    : organization.createdAt;
  const usageResetDay = getDate(usageResetDate);

  let endDate = new Date();
  const currentDay = getDate(endDate);
  endDate = setDate(endDate, usageResetDay);
  if (currentDay >= usageResetDay) {
    endDate = addMonths(endDate, 1);
  }
  const startDate = addMonths(endDate, -1);

  return {
    startDate,
    endDate,
  };
}
