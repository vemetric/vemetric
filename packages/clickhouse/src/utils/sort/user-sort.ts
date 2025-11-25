import type { IUserSortConfig } from '@vemetric/common/sort';
import { escape } from 'sqlstring';
import { buildEventFilterQueries } from '../filters/event-filter';

export const buildUserSortQueries = (sortConfig: IUserSortConfig, projectId: bigint) => {
  const isSortByEvent = sortConfig?.by?.type === 'event' && sortConfig.by.nameFilter;
  let joinClause = '';
  let orderByClause = '';
  let sortSelect = '';

  if (isSortByEvent) {
    const eventFilterQueries = buildEventFilterQueries({
      operator: 'and',
      filters: [sortConfig.by],
    });
    // Join on userId, projectId, and filter for the event
    joinClause = `LEFT JOIN (
        SELECT userId, maxOrNull(createdAt) as lastEventFiredAt
        FROM event
        WHERE projectId=${escape(projectId)}
          ${eventFilterQueries ? `AND (${eventFilterQueries})` : ''}
          AND isPageView <> 1
        GROUP BY userId
      ) e ON e.userId = u.userId`;
    sortSelect = ', e.lastEventFiredAt as lastEventFiredAt';
    orderByClause = 'ORDER BY e.lastEventFiredAt DESC NULLS LAST';
  } else {
    orderByClause = `ORDER BY u.maxCreatedAt DESC`;
  }

  return {
    joinClause,
    orderByClause,
    sortSelect,
    isSortByEvent,
  };
};
