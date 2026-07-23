function normalizeActionUrl(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  return /^https?:\/\//i.test(normalized) || normalized.startsWith('/')
    ? normalized
    : `/${normalized}`;
}

function splitActionUrl(value: string): {
  path: string;
  query: URLSearchParams;
} {
  const [path, query = ''] = value.split('?', 2);
  return {
    path: path || '/',
    query: new URLSearchParams(query)
  };
}

function buildActionUrl(path: string, query: URLSearchParams): string {
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function resolveNotificationActionUrl(options: {
  rawActionUrl?: string | null;
  derivedActionUrl: string;
  genericActionUrl: string;
}): string {
  const rawActionUrl = normalizeActionUrl(options.rawActionUrl);
  const derivedActionUrl = normalizeActionUrl(options.derivedActionUrl);
  const genericActionUrl = normalizeActionUrl(options.genericActionUrl);

  if (!rawActionUrl) {
    return derivedActionUrl;
  }

  if (
    /^https?:\/\//i.test(rawActionUrl) ||
    !derivedActionUrl ||
    derivedActionUrl === genericActionUrl
  ) {
    return rawActionUrl;
  }

  if (rawActionUrl === derivedActionUrl) {
    return derivedActionUrl;
  }

  const raw = splitActionUrl(rawActionUrl);
  const derived = splitActionUrl(derivedActionUrl);
  const generic = splitActionUrl(genericActionUrl);

  if (raw.path !== derived.path || raw.path !== generic.path) {
    return rawActionUrl;
  }

  const mergedQuery = new URLSearchParams(raw.query);
  derived.query.forEach((value, key) => {
    mergedQuery.set(key, value);
  });

  return buildActionUrl(derived.path, mergedQuery);
}
