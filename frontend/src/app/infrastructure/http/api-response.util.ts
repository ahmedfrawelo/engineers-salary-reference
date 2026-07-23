type LooseValue = ReturnType<typeof JSON.parse>;
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  errors: LooseValue[];
}

// Paginated response structure from Backend
export interface PaginatedData<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  grouping?: PagedGroupingMeta | null;
}

export type ApiResponseLike<T> = ApiResponse<T> | T | null | undefined;

export type PagedGroupSummary = {
  field: string;
  key: string;
  value: string | null;
  count: number;
};

export type PagedGroupingMeta = {
  field: string;
  direction: 'asc' | 'desc';
  dateInterval?: string | null;
  totalGroups: number;
  groups: PagedGroupSummary[];
};

export type PaginationMeta = Partial<Omit<PaginatedData<unknown>, 'items'>> & {
  grouping?: PagedGroupingMeta | null;
};

export type PagedItemsWithMeta<T> = {
  items: T[];
  meta: PaginationMeta | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  (value ?? {}) as unknown as Record<string, unknown>;

const unwrapArrayLike = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = toRecord(value);
  const wrapped = candidate.$values;
  return Array.isArray(wrapped) ? wrapped : null;
};

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const readProp = <T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined => {
  for (const key of keys) {
    if (hasOwn(obj, key)) {
      return obj[key] as T;
    }
  }
  return undefined;
};

const extractArrayCandidate = (value: unknown): unknown[] | null => {
  const arrayKeys = [
    'items',
    'Items',
    'result',
    'Result',
    'results',
    'Results',
    'list',
    'List',
    'rows',
    'Rows',
    'values',
    'Values'
  ];
  const containerKeys = [
    'data',
    'Data',
    'payload',
    'Payload',
    'value',
    'Value',
    'response',
    'Response',
    'content',
    'Content'
  ];
  const visited = new Set<object>();

  const visit = (node: unknown, depth: number): unknown[] | null => {
    if (!node || typeof node !== 'object' || depth > 6) {
      return null;
    }

    const objectNode = node as object;
    if (visited.has(objectNode)) {
      return null;
    }
    visited.add(objectNode);

    const directArray = unwrapArrayLike(node);
    if (directArray) {
      return directArray;
    }

    if (isPaginatedData(node)) {
      const paginatedItems = readProp(toRecord(node), ['items', 'Items']);
      const wrappedItems = unwrapArrayLike(paginatedItems);
      if (wrappedItems) {
        return wrappedItems;
      }
    }

    const candidate = toRecord(node);
    for (const key of arrayKeys) {
      const direct = readProp(candidate, [key]);
      const wrapped = unwrapArrayLike(direct);
      if (wrapped) {
        return wrapped;
      }
      if (direct && typeof direct === 'object') {
        const nested = visit(direct, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }

    for (const key of containerKeys) {
      const nestedContainer = readProp(candidate, [key]);
      if (!nestedContainer || typeof nestedContainer !== 'object') {
        continue;
      }
      const nested = visit(nestedContainer, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  return visit(value, 0);
};

export function isApiResponse<T>(input: ApiResponseLike<T>): input is ApiResponse<T> {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const candidate = toRecord(input);
  const hasData = hasOwn(candidate, 'data') || hasOwn(candidate, 'Data');
  const hasMeta =
    hasOwn(candidate, 'statusCode') ||
    hasOwn(candidate, 'StatusCode') ||
    hasOwn(candidate, 'success') ||
    hasOwn(candidate, 'Success') ||
    hasOwn(candidate, 'message') ||
    hasOwn(candidate, 'Message');
  return hasData && hasMeta;
}

export function isPaginatedData<T>(input: LooseValue): input is PaginatedData<T> {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const candidate = toRecord(input);
  const items = readProp(candidate, ['items', 'Items']);
  const totalCount = readProp(candidate, ['totalCount', 'TotalCount']);
  return !!unwrapArrayLike(items) && totalCount !== undefined;
}

export function unwrapApiResponse<T>(input: ApiResponseLike<T>): T {
  if (isApiResponse<T>(input)) {
    const candidate = toRecord(input);
    const data = readProp(candidate, ['data', 'Data']);
    // If data is paginated, return only the items array
    if (isPaginatedData(data)) {
      const items = readProp(toRecord(data), ['items', 'Items']);
      const wrapped = unwrapArrayLike(items);
      return (wrapped ?? items) as unknown as T;
    }
    const list = extractArrayCandidate(data);
    if (list) {
      return list as unknown as T;
    }
    return data as T;
  }
  // If input itself is paginated, return items
  if (isPaginatedData(input)) {
    const items = readProp(toRecord(input), ['items', 'Items']);
    return items as unknown as T;
  }
  const list = extractArrayCandidate(input);
  if (list) {
    return list as unknown as T;
  }
  return input as T;
}

export function extractItemsAndPaginationMeta<T>(
  input: ApiResponseLike<T[] | PaginatedData<T>> | unknown
): PagedItemsWithMeta<T> {
  const unwrapItems = (value: unknown): T[] => {
    const arrayLike = unwrapArrayLike(value);
    return arrayLike ? (arrayLike as T[]) : [];
  };

  const normalizePaged = (value: unknown): PagedItemsWithMeta<T> => {
    const record = toRecord(value);
    return {
      items: unwrapItems(readProp(record, ['items', 'Items'])),
      meta: {
        totalCount: toFiniteNumber(readProp(record, ['totalCount', 'TotalCount'])),
        pageNumber: toFiniteNumber(readProp(record, ['pageNumber', 'PageNumber'])),
        pageSize: toFiniteNumber(readProp(record, ['pageSize', 'PageSize'])),
        totalPages: toFiniteNumber(readProp(record, ['totalPages', 'TotalPages'])),
        hasPreviousPage: toBoolean(readProp(record, ['hasPreviousPage', 'HasPreviousPage'])),
        hasNextPage: toBoolean(readProp(record, ['hasNextPage', 'HasNextPage'])),
        grouping: normalizePagedGrouping(readProp(record, ['grouping', 'Grouping']))
      }
    };
  };

  const payload = isApiResponse(input as ApiResponseLike<unknown>)
    ? readProp(toRecord(input), ['data', 'Data'])
    : input;

  if (isPaginatedData<T>(payload as LooseValue)) {
    return normalizePaged(payload);
  }

  const arrayLike = unwrapArrayLike(payload);
  if (arrayLike) {
    return { items: arrayLike as T[], meta: null };
  }

  return { items: [], meta: null };
}

export function normalizePagedGrouping(payload: unknown): PagedGroupingMeta | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = toRecord(payload);
  const field = String(readProp(record, ['field', 'Field']) ?? '').trim();
  if (!field) {
    return null;
  }

  const directionRaw = String(readProp(record, ['direction', 'Direction']) ?? '')
    .trim()
    .toLowerCase();
  const interval = String(readProp(record, ['dateInterval', 'DateInterval']) ?? '').trim();
  const rawGroups = readProp(record, ['groups', 'Groups']);
  const groups = (Array.isArray(rawGroups) ? rawGroups : [])
    .map(item => normalizePagedGroupSummary(item, field))
    .filter((item): item is PagedGroupSummary => item !== null);

  return {
    field,
    direction: directionRaw === 'desc' ? 'desc' : 'asc',
    dateInterval: interval || null,
    totalGroups: Math.max(
      0,
      toFiniteNumber(readProp(record, ['totalGroups', 'TotalGroups'])) ?? groups.length
    ),
    groups
  };
}

function normalizePagedGroupSummary(payload: unknown, field: string): PagedGroupSummary | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = toRecord(payload);
  const key = String(readProp(record, ['key', 'Key']) ?? '').trim();
  const count = toFiniteNumber(readProp(record, ['count', 'Count']));
  if (!key || count == null) {
    return null;
  }

  const value = String(readProp(record, ['value', 'Value']) ?? key).trim();
  return {
    field,
    key,
    value: value || null,
    count: Math.max(0, count)
  };
}

function toFiniteNumber(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
