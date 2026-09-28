export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export const buildPage = (items, total, { page, limit }) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/**
 * Runs a sorted, paginated find alongside its count. An empty filter uses collection
 * metadata for the count instead of scanning.
 */
export async function paginateFind(Model, filter, query, { sort = { _id: -1 }, projection, populate } = {}) {
  const pagination = parsePagination(query);
  let cursor = Model.find(filter, projection).sort(sort).skip(pagination.skip).limit(pagination.limit).lean();
  if (populate) cursor = cursor.populate(populate);
  const count = Object.keys(filter).length === 0 ? Model.estimatedDocumentCount() : Model.countDocuments(filter);
  const [items, total] = await Promise.all([cursor, count]);
  return buildPage(items, total, pagination);
}
