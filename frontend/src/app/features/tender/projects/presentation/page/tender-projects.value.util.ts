export function parseProjectNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
  const normalizedDigits = raw.replace(/[٠-٩۰-۹]/g, ch => {
    const ai = arabicIndic.indexOf(ch);
    if (ai >= 0) return String(ai);
    const ei = easternArabicIndic.indexOf(ch);
    return ei >= 0 ? String(ei) : ch;
  });
  const text = normalizedDigits
    .replace(/[\u066B]/g, '.') // Arabic decimal separator
    .replace(/[\u066C,]/g, '') // Arabic/English thousands separators
    .replace(/[^\d.\-+]/g, '')
    .trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProjectLabel(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === '-' || text === '—') return null;
  return text;
}

export function parseProjectPositiveId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatProjectDate(iso?: unknown): string {
  if (!iso) return '—';
  const date = new Date(String(iso));
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatProjectMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatProjectPercentFromDecimal(value: unknown, fallback = '—'): string {
  const parsed = parseProjectNumberOrNull(value);
  if (parsed == null) return fallback;
  const percent = parsed >= 0 && parsed <= 1 ? parsed * 100 : parsed;
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(percent);
  return `${formatted}%`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export type ProjectApiFieldIssue = {
  field: string;
  message: string;
};

export type ProjectApiErrorDetails = {
  message: string;
  fieldIssues: ProjectApiFieldIssue[];
};

export function extractProjectApiErrorDetails(err: unknown): ProjectApiErrorDetails {
  if (!err) {
    return {
      message: 'Please check your connection and try again',
      fieldIssues: []
    };
  }
  const errRecord = asRecord(err);
  const original = asRecord(errRecord?.['originalError']) ?? errRecord;
  const rawPayload = original?.['error'];
  const payload = asRecord(rawPayload);
  const payloadText = typeof rawPayload === 'string' ? normalizeProjectLabel(rawPayload) : null;
  const errors = payload?.['Errors'] ?? payload?.['errors'];
  const fieldIssues = collectProjectApiFieldIssues(errors);
  const firstErrorMessage =
    fieldIssues[0]?.message ?? collectProjectApiErrorMessages(errors)[0] ?? null;
  const message =
    firstErrorMessage ??
    normalizeProjectLabel(payload?.['Message']) ??
    normalizeProjectLabel(payload?.['message']) ??
    payloadText ??
    normalizeProjectLabel(errRecord?.['message']) ??
    normalizeProjectLabel(original?.['message']);

  return {
    message: message ?? 'Please check your connection and try again',
    fieldIssues
  };
}

export function extractProjectApiErrorMessage(err: unknown): string {
  return extractProjectApiErrorDetails(err).message;
}

function collectProjectApiErrorMessages(errors: unknown): string[] {
  if (!errors) {
    return [];
  }

  if (Array.isArray(errors)) {
    return errors
      .map(value => normalizeProjectLabel(value))
      .filter((value): value is string => Boolean(value));
  }

  if (typeof errors === 'object') {
    const messages: string[] = [];
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          const text = normalizeProjectLabel(entry);
          if (text) {
            messages.push(text);
          }
        }
        continue;
      }

      const text = normalizeProjectLabel(value);
      if (text) {
        messages.push(text);
      }
    }
    return messages;
  }

  const message = normalizeProjectLabel(errors);
  return message ? [message] : [];
}

function collectProjectApiFieldIssues(errors: unknown): ProjectApiFieldIssue[] {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return [];
  }

  const issues: ProjectApiFieldIssue[] = [];
  const seen = new Set<string>();
  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    const message =
      (Array.isArray(value)
        ? value
            .map(entry => normalizeProjectLabel(entry))
            .find((entry): entry is string => Boolean(entry))
        : normalizeProjectLabel(value)) ?? null;
    if (!message) {
      continue;
    }

    const key = `${field.toLowerCase()}:${message.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    issues.push({ field, message });
  }

  return issues;
}
