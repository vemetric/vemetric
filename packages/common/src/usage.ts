export interface UsageStats {
  total: number;
  perProject: {
    name: string;
    domain: string;
    events: number;
  }[];
}
