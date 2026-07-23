export function normalizeApiUrl(base: string, path: string): string {
  const sanitizedBase = (base || '').replace(/\/+$/, '');
  const sanitizedPath = (path || '').replace(/^\/+/, '');
  return `${sanitizedBase}/${sanitizedPath}`;
}
