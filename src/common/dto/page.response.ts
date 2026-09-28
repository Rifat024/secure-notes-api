import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

const cache = new Map<Type<unknown>, Type<PageMeta & { items: unknown[] }>>();

/** Builds (once per item type) a named OpenAPI schema for `{ items: Item[], page, limit, total, totalPages }`. */
export function Paginated<T>(item: Type<T>): Type<PageMeta & { items: T[] }> {
  const cached = cache.get(item);
  if (cached) return cached as Type<PageMeta & { items: T[] }>;

  class PaginatedResponse extends PageMeta {
    @ApiProperty({ type: [item] })
    items: T[];
  }
  Object.defineProperty(PaginatedResponse, 'name', { value: `Paginated${item.name}` });
  cache.set(item, PaginatedResponse);
  return PaginatedResponse;
}
