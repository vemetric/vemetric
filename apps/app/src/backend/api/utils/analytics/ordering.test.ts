import { describe, expect, it } from 'vitest';
import { applyOrdering, getDefaultOrderBy } from './ordering';

function row(group: Record<string, string>, metrics: Record<string, number | null>) {
  return { group, metrics };
}

describe('getDefaultOrderBy', () => {
  it('orders time series by date, oldest first', () => {
    expect(getDefaultOrderBy({ kind: 'interval', interval: 'day' } as never, ['users'])).toEqual([['date', 'asc']]);
  });

  it('orders other groupings by the first metric, highest first', () => {
    expect(getDefaultOrderBy({ kind: 'field', token: 'page:path' } as never, ['pageviews', 'users'])).toEqual([
      ['pageviews', 'desc'],
    ]);
  });

  it('skips metrics that are null for the grouping', () => {
    expect(getDefaultOrderBy({ kind: 'field', token: 'page:path' } as never, ['bounceRate', 'pageviews'])).toEqual([
      ['pageviews', 'desc'],
    ]);
  });

  it("doesn't order totals", () => {
    expect(getDefaultOrderBy({ kind: 'none' } as never, ['users'])).toEqual([]);
  });
});

describe('applyOrdering', () => {
  const rows = [
    row({ 'page:path': '/pricing' }, { users: 5 }),
    row({ 'page:path': '/blog' }, { users: 9 }),
    row({ 'page:path': '/about' }, { users: 5 }),
    row({ 'page:path': '/' }, { users: 5 }),
  ];

  it('orders by the field and breaks ties by the group value', () => {
    expect(applyOrdering(rows, [['users', 'desc']]).map((r) => r.group['page:path'])).toEqual([
      '/blog',
      '/',
      '/about',
      '/pricing',
    ]);
  });

  it('orders by the group value without orderBy', () => {
    expect(applyOrdering(rows, []).map((r) => r.group['page:path'])).toEqual(['/', '/about', '/blog', '/pricing']);
  });

  it('orders dates chronologically', () => {
    const series = [
      row({ date: '2026-10-24T00:00:00Z' }, { users: 1 }),
      row({ date: '2026-10-12T00:00:00Z' }, { users: 2 }),
      row({ date: '2026-11-06T00:00:00Z' }, { users: 1 }),
    ];
    expect(applyOrdering(series, [['date', 'asc']]).map((r) => r.group.date)).toEqual([
      '2026-10-12T00:00:00Z',
      '2026-10-24T00:00:00Z',
      '2026-11-06T00:00:00Z',
    ]);
  });
});
