import type { FilterQuery, Model, PopulateOptions, ProjectionType, SortOrder } from 'mongoose';
import { rethrowDbError } from '../database/db-error';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export interface PageQuery {
  page?: number | string;
  limit?: number | string;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(query: PageQuery | undefined = {}): Pagination {
  const page = Math.max(1, Number.parseInt(String(query?.page ?? ''), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(String(query?.limit ?? ''), 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export const buildPage = <T>(items: T[], total: number, { page, limit }: Pick<Pagination, 'page' | 'limit'>): Page<T> => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

interface PaginateOptions {
  sort?: Record<string, SortOrder>;
  projection?: ProjectionType<unknown>;
  populate?: PopulateOptions;
}

/**
 * Runs a sorted, paginated find alongside its count. An empty filter reads the count from
 * collection metadata instead of scanning.
 */
export async function paginateFind<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: PageQuery,
  { sort = { _id: -1 }, projection, populate }: PaginateOptions = {},
): Promise<Page<unknown>> {
  const pagination = parsePagination(query);
  try {
    let cursor = model.find(filter, projection).sort(sort).skip(pagination.skip).limit(pagination.limit).lean();
    if (populate) cursor = cursor.populate(populate);
    const count = Object.keys(filter ?? {}).length === 0 ? model.estimatedDocumentCount() : model.countDocuments(filter);
    const [items, total] = await Promise.all([cursor.exec(), count]);
    return buildPage((items ?? []) as unknown[], total ?? 0, pagination);
  } catch (error) {
    rethrowDbError(error, `paginate(${model?.collection?.name})`);
  }
}
