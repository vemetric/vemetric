import type { IFilterConfig } from '@vemetric/common/filters';
import { clickhouseEvent, clickhouseSession } from 'clickhouse';
import type { MetricsQueryGrouping } from 'clickhouse/src/utils/query-group';
import { normalizeGroupKeys } from './grouping';
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
      if (
        params.grouping.kind === 'event_prop' ||
        (params.grouping.kind === 'field' &&
          (params.grouping.token === 'event:name' ||
            params.grouping.token === 'browser' ||
            params.grouping.token === 'device_type' ||
            params.grouping.token === 'os'))
      ) {
        return [];
      }

      rows = await clickhouseSession.queryApiVisitDurationRows(params);
      break;
    }
    case 'bounce_rate': {
      if (params.grouping.kind === 'event_prop' || (params.grouping.kind === 'field' && params.grouping.token === 'event:name')) {
        return [];
      }
      rows = await clickhouseEvent.queryApiBounceRateRows(params);
      break;
    }
    default:
      return [];
  }

  return normalizeGroupKeys(rows, params.grouping);
}
