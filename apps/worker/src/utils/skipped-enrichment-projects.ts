export function parseSkippedEnrichmentProjectIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((projectId) => projectId.trim())
      .filter(Boolean),
  );
}

const skippedEnrichmentProjectIds = parseSkippedEnrichmentProjectIds(process.env.SKIP_ENRICHMENT_PROJECT_IDS);

export function shouldSkipEnrichmentProject(projectId: string): boolean {
  return skippedEnrichmentProjectIds.has(projectId);
}

export function getSkippedEnrichmentProjectIds(): string[] {
  return Array.from(skippedEnrichmentProjectIds);
}
