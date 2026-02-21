import type { IFilterConfig } from '@vemetric/common/filters';
import { clickhouseEvent, clickhouseSession } from 'clickhouse';
import type { MetricsQueryGrouping } from 'clickhouse';
import { normalizeGroupKeys } from './grouping';
import { isMetricApplicableForGrouping } from './metrics';
import type { Metric, MetricRow } from '../../consts/analytics';

export async function queryMetricRows(input: {
  metric: Metric;
  projectId: bigint;
  startDate: Date;
  endDate?: Date;
  grouping: MetricsQueryGrouping;
  filterQueries: string;
  filterConfig?: IFilterConfig;
}): Promise<MetricRow[]> {
  const { metric, ...params } = input;

  if (!isMetricApplicableForGrouping(metric, params.grouping)) {
    return [];
  }

  let rows: MetricRow[] = [];
  switch (metric) {
    case 'users':
    case 'pageviews':
    case 'events': {
      rows = await clickhouseEvent.queryApiMetricRows({
        metric,
        ...params,
      });
      break;
    }
    case 'visit_duration': {
      rows = await clickhouseSession.queryApiVisitDurationRows(params);
      break;
    }
    case 'bounce_rate': {
      rows = await clickhouseEvent.queryApiBounceRateRows(params);
      break;
    }
    default:
      return [];
  }

  return normalizeGroupKeys(rows, params.grouping);
}
