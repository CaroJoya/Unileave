// lib/utils/pagination.ts

interface PaginationParams {
  limit?: string;
  offset?: string;
  defaultLimit?: number;
  maxLimit?: number;
}

interface PaginationResult {
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationParams = {}
): PaginationResult {
  const { defaultLimit = 50, maxLimit = 100 } = options;
  
  // Parse limit with validation
  let limit = parseInt(searchParams.get("limit") || String(defaultLimit));
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  
  // Parse offset with validation
  let offset = parseInt(searchParams.get("offset") || "0");
  if (isNaN(offset) || offset < 0) offset = 0;
  
  return { limit, offset, hasMore: false };
}

export function paginateArray<T>(
  data: T[],
  limit: number,
  offset: number
): { items: T[]; hasMore: boolean } {
  const items = data.slice(offset, offset + limit);
  const hasMore = offset + limit < data.length;
  return { items, hasMore };
}

export function getPaginationHeaders(limit: number, offset: number, total: number) {
  return {
    "X-Total-Count": String(total),
    "X-Limit": String(limit),
    "X-Offset": String(offset),
  };
}