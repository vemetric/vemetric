import type { IStringFilter, IListFilter } from '@vemetric/common/filters';
import { escape } from 'sqlstring';

export const buildStringFilterQuery = (columnName: string, filter?: IStringFilter) => {
  if (!filter || filter.operator === 'any') {
    return '';
  }

  switch (filter.operator) {
    case 'is':
      return `${columnName} = ${escape(filter.value)}`;
    case 'isNot':
      return `${columnName} <> ${escape(filter.value)}`;
    case 'contains':
      return `${columnName} ILIKE ${escape('%' + filter.value + '%')}`;
    case 'notContains':
      return `${columnName} NOT ILIKE ${escape('%' + filter.value + '%')}`;
    case 'startsWith':
      return `${columnName} ILIKE ${escape(filter.value + '%')}`;
    case 'endsWith':
      return `${columnName} ILIKE ${escape('%' + filter.value)}`;
  }
};

export const buildListFilterQuery = (columnName: string, filter?: IListFilter) => {
  if (!filter || filter.operator === 'any' || filter.value.length === 0) {
    return '';
  }

  switch (filter.operator) {
    case 'oneOf':
      return `${columnName} IN (${filter.value.map((v) => escape(v)).join(',')})`;
    case 'noneOf':
      return `${columnName} NOT IN (${filter.value.map((v) => escape(v)).join(',')})`;
  }
};
