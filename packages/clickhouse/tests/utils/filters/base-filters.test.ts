import type { IStringFilter, IListFilter } from '@vemetric/common/filters';
import { describe, it, expect } from 'vitest';
import { buildStringFilterQuery, buildListFilterQuery } from '../../../src/utils/filters/base-filters';

describe('buildStringFilterQuery', () => {
  const columnName = 'test_column';

  it('should return empty string for undefined filter', () => {
    expect(buildStringFilterQuery(columnName)).toBe('');
  });

  it('should return empty string for "any" operator', () => {
    const filter: IStringFilter = { operator: 'any', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe('');
  });

  it('should build "is" operator query', () => {
    const filter: IStringFilter = { operator: 'is', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column = 'test'");
  });

  it('should build "isNot" operator query', () => {
    const filter: IStringFilter = { operator: 'isNot', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column <> 'test'");
  });

  it('should build "contains" operator query', () => {
    const filter: IStringFilter = { operator: 'contains', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column ILIKE '%test%'");
  });

  it('should build "notContains" operator query', () => {
    const filter: IStringFilter = { operator: 'notContains', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column NOT ILIKE '%test%'");
  });

  it('should build "startsWith" operator query', () => {
    const filter: IStringFilter = { operator: 'startsWith', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column ILIKE 'test%'");
  });

  it('should build "endsWith" operator query', () => {
    const filter: IStringFilter = { operator: 'endsWith', value: 'test' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column ILIKE '%test'");
  });

  it('should escape special characters in values', () => {
    const filter: IStringFilter = { operator: 'is', value: "test'value" };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column = 'test\\'value'");
  });

  it('should handle empty string values', () => {
    const filter: IStringFilter = { operator: 'is', value: '' };
    expect(buildStringFilterQuery(columnName, filter)).toBe("test_column = ''");
  });
});

describe('buildListFilterQuery', () => {
  const columnName = 'test_column';

  it('should return empty string for undefined filter', () => {
    expect(buildListFilterQuery(columnName)).toBe('');
  });

  it('should return empty string for "any" operator', () => {
    const filter: IListFilter = { operator: 'any', value: ['test'] };
    expect(buildListFilterQuery(columnName, filter)).toBe('');
  });

  it('should return empty string for empty value array', () => {
    const filter: IListFilter = { operator: 'oneOf', value: [] };
    expect(buildListFilterQuery(columnName, filter)).toBe('');
  });

  it('should build "oneOf" operator query with single value', () => {
    const filter: IListFilter = { operator: 'oneOf', value: ['test'] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column IN ('test')");
  });

  it('should build "oneOf" operator query with multiple values', () => {
    const filter: IListFilter = { operator: 'oneOf', value: ['test1', 'test2', 'test3'] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column IN ('test1','test2','test3')");
  });

  it('should build "noneOf" operator query with single value', () => {
    const filter: IListFilter = { operator: 'noneOf', value: ['test'] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column NOT IN ('test')");
  });

  it('should build "noneOf" operator query with multiple values', () => {
    const filter: IListFilter = { operator: 'noneOf', value: ['test1', 'test2', 'test3'] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column NOT IN ('test1','test2','test3')");
  });

  it('should escape special characters in values', () => {
    const filter: IListFilter = { operator: 'oneOf', value: ["test'value", "another'value"] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column IN ('test\\'value','another\\'value')");
  });

  it('should handle empty string values in array', () => {
    const filter: IListFilter = { operator: 'oneOf', value: ['', 'test'] };
    expect(buildListFilterQuery(columnName, filter)).toBe("test_column IN ('','test')");
  });
});
