import { formatClickhouseDate } from '@vemetric/common/date';
import type { IUserSortConfig } from '@vemetric/common/sort';
import { escape } from 'sqlstring';
import { buildEventFilterQueries } from '../filters/event-filter';

type UsersOrderByField = 'lastSeenAt' | 'displayName' | 'identifier' | 'countryCode';

export const buildUserSortQueries = (
  sortConfig: IUserSortConfig,
  projectId: bigint,
  startDate?: Date,
  endDate?: Date,
) => {
  const sortBy = sortConfig?.by;
  if (sortBy && typeof sortBy === 'object' && sortBy.type === 'event' && sortBy.nameFilter) {
    const eventFilterQueries = buildEventFilterQueries({
      operator: 'and',
      filters: [sortBy],
    });
    const direction = sortConfig.direction === 'asc' ? 'ASC' : 'DESC';

    return {
      joinClause: `LEFT JOIN (
        SELECT userId, maxOrNull(createdAt) as lastEventFiredAt
        FROM event
        WHERE projectId=${escape(projectId)}
          ${startDate ? `AND createdAt >= '${formatClickhouseDate(startDate)}'` : ''}
          ${endDate ? `AND createdAt < '${formatClickhouseDate(endDate)}'` : ''}
          ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
          AND isPageView <> 1
        GROUP BY userId
      ) e ON e.userId = u.userId`,
      sortSelect: ', e.lastEventFiredAt as lastEventFiredAt',
      orderByClause: `ORDER BY e.lastEventFiredAt ${direction} NULLS LAST, u.userId ASC`,
      isSortByEvent: true,
    };
  }

  const orderFieldMap: Partial<Record<UsersOrderByField, string>> = {
    lastSeenAt: 'maxCreatedAt',
  };
  const field = sortConfig?.by.type === 'field' ? sortConfig.by.fieldName : 'lastSeenAt';
  const direction = sortConfig?.direction === 'asc' ? 'ASC' : 'DESC';
  const orderColumn = orderFieldMap[field] ?? field;

  return {
    joinClause: '',
    sortSelect: '',
    orderByClause: `ORDER BY u.${orderColumn} ${direction}, u.userId ASC`,
    isSortByEvent: false,
  };
};
