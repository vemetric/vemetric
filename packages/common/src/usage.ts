export interface UsageStats {
  total: number;
  periodStart: string;
  periodEnd: string;
  perProject: {
    name: string;
    domain: string;
    events: number;
  }[];
}
