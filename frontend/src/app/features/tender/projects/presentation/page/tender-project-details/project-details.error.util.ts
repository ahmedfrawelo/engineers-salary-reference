export function extractProjectDetailsErrorMessage(err: unknown): string {
  if (!err) return 'Please check your connection and try again';

  const errRecord = asRecord(err);
  const original = asRecord(errRecord?.['originalError']) ?? errRecord;
  const rawUnknown = original?.['error'] ?? original;

  if (typeof rawUnknown === 'string') {
    const text = rawUnknown.trim();
    if (text) return text;
  }

  const raw = asRecord(rawUnknown) ?? {};
  const errors = raw['Errors'] ?? raw['errors'];
  if (Array.isArray(errors) && errors.length) {
    return String(errors[0]);
  }

  if (errors && typeof errors === 'object') {
    const firstKey = Object.keys(errors)[0];
    const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null;
    if (Array.isArray(firstValue) && firstValue.length) {
      return String(firstValue[0]);
    }
  }

  const detail = raw['detail'] ?? raw['Detail'];
  if (detail) return String(detail);

  const serverMessage = raw['Message'] ?? raw['message'] ?? raw['title'] ?? raw['Title'];
  if (serverMessage) return String(serverMessage);

  return errRecord?.['message']
    ? String(errRecord['message'])
    : 'Please check your connection and try again';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
