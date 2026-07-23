export type SearchSelectDisplayFn<T> = ((option: T) => string) | undefined;

function getSearchSelectOptionText<T>(
  option: T | null,
  displayFn?: SearchSelectDisplayFn<T>
): string {
  if (option == null) return '';
  return displayFn ? displayFn(option) : String(option);
}

function normalizeSearchSelectOptionText<T>(
  option: T | null,
  displayFn?: SearchSelectDisplayFn<T>
): string {
  return getSearchSelectOptionText(option, displayFn).trim().toLowerCase();
}

export function resolveInlineSearchCommitCandidate<T>(
  options: readonly T[] | null | undefined,
  filtered: readonly T[] | null | undefined,
  query: string,
  displayFn?: SearchSelectDisplayFn<T>
): T | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  const exactMatch =
    (options || []).find(
      option => normalizeSearchSelectOptionText(option, displayFn) === normalizedQuery
    ) ?? null;
  if (exactMatch != null) {
    return exactMatch;
  }

  return (filtered || []).length === 1 ? (filtered?.[0] ?? null) : null;
}
