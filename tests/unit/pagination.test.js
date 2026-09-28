import { parsePagination, buildPage, DEFAULT_LIMIT, MAX_LIMIT } from '../../src/utils/pagination.js';

describe('parsePagination', () => {
  test('defaults to the first page with the default limit', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  test('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  test('clamps the limit to the maximum', () => {
    expect(parsePagination({ limit: '5000' }).limit).toBe(MAX_LIMIT);
  });

  test.each([
    [{ page: '0' }, 1],
    [{ page: '-4' }, 1],
    [{ page: 'abc' }, 1],
  ])('treats invalid page %o as page %i', (query, expected) => {
    expect(parsePagination(query).page).toBe(expected);
  });

  test('falls back to the default limit for zero or garbage input', () => {
    expect(parsePagination({ limit: '0' }).limit).toBe(DEFAULT_LIMIT);
    expect(parsePagination({ limit: 'many' }).limit).toBe(DEFAULT_LIMIT);
  });
});

describe('buildPage', () => {
  test('wraps items with paging metadata', () => {
    expect(buildPage(['a', 'b'], 12, { page: 2, limit: 5 })).toEqual({
      items: ['a', 'b'],
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    });
  });

  test('reports zero pages for an empty result', () => {
    expect(buildPage([], 0, { page: 1, limit: 10 }).totalPages).toBe(0);
  });
});
