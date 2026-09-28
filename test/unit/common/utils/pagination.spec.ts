import { buildPage, DEFAULT_LIMIT, MAX_LIMIT, parsePagination } from '../../../../src/common/utils/pagination.js';

describe('parsePagination', () => {
  it('defaults to the first page', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
    expect(parsePagination(undefined)).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('clamps the limit and ignores invalid values', () => {
    expect(parsePagination({ limit: 5000 }).limit).toBe(MAX_LIMIT);
    expect(parsePagination({ page: -4, limit: 'x' })).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });
});

describe('buildPage', () => {
  it('wraps items with paging metadata', () => {
    expect(buildPage(['a'], 12, { page: 2, limit: 5 })).toEqual({ items: ['a'], page: 2, limit: 5, total: 12, totalPages: 3 });
  });
});
