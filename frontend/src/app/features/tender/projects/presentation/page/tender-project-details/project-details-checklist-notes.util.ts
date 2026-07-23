export type ChecklistNotesSubItem = {
  id: string;
  text: string;
  done: boolean;
};

export type ChecklistNotesParseResult = {
  noteText: string | null;
  subItems: ChecklistNotesSubItem[];
  order: number | null;
  envelope: Record<string, unknown> | null;
};

export type ChecklistNotesSerializeInput = {
  subItems?: ChecklistNotesSubItem[] | null;
  noteText?: string | null;
  order?: number | null;
  notesEnvelope?: Record<string, unknown> | null;
};

export function parseChecklistNotesEnvelope(
  raw: string | null | undefined,
  createSubItemId: () => string = defaultSubItemId
): ChecklistNotesParseResult {
  if (!raw) return { noteText: null, subItems: [], order: null, envelope: null };
  const text = String(raw).trim();
  if (!text) return { noteText: null, subItems: [], order: null, envelope: null };
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return {
        noteText: null,
        subItems: normalizeSubItems(parsed, createSubItemId),
        order: null,
        envelope: null
      };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const items = obj.subItems ?? obj.subitems ?? obj.items ?? obj.checklistItems ?? obj.s;
      const noteText =
        typeof obj.noteText === 'string' ? obj.noteText : typeof obj.n === 'string' ? obj.n : null;
      const order = parseChecklistOrderValue(obj.order ?? obj.sortOrder ?? obj.sortIndex ?? obj.o);
      const subItems = Array.isArray(items) ? normalizeSubItems(items, createSubItemId) : [];
      return { noteText, subItems, order, envelope: { ...obj } };
    }
  } catch {
    // Fallback to plain text path.
  }
  return { noteText: text, subItems: [], order: null, envelope: null };
}

export function serializeChecklistNotesEnvelope(item: ChecklistNotesSerializeInput): string | null {
  const subItems = (item.subItems ?? [])
    .map(sub => {
      const text = (sub.text ?? '').trim();
      if (!text) return null;
      return [text, sub.done ? 1 : 0] as const;
    })
    .filter((entry): entry is readonly [string, 0 | 1] => !!entry);
  const noteText = item.noteText ? String(item.noteText) : null;
  const order = normalizeChecklistOrderValue(item.order);
  const payload =
    item.notesEnvelope && typeof item.notesEnvelope === 'object'
      ? { ...item.notesEnvelope }
      : ({} as Record<string, unknown>);

  if (noteText) payload.n = noteText;
  else delete payload.n;

  if (subItems.length) payload.s = subItems;
  else delete payload.s;

  if (order != null) payload.o = order;
  else delete payload.o;

  if (!Object.keys(payload).length) return null;
  return JSON.stringify(payload);
}

export function parseChecklistOrderValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeChecklistOrderValue(value: unknown): number | null {
  const parsed = parseChecklistOrderValue(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function normalizeSubItems(
  items: unknown[],
  createSubItemId: () => string
): ChecklistNotesSubItem[] {
  const out: ChecklistNotesSubItem[] = [];
  for (const entry of items) {
    if (entry == null) continue;
    if (Array.isArray(entry)) {
      const [a, b, c] = entry;
      if (typeof a === 'string' && typeof b === 'string') {
        const text = b.trim();
        if (!text) continue;
        out.push({ id: a, text, done: normalizeDone(c) });
        continue;
      }
      const text = String(a ?? '').trim();
      if (!text) continue;
      out.push({ id: createSubItemId(), text, done: normalizeDone(b) });
      continue;
    }
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) continue;
      out.push({ id: createSubItemId(), text, done: false });
      continue;
    }
    if (typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const text = String(obj.text ?? obj.name ?? '').trim();
      if (!text) continue;
      const id = String(obj.id ?? createSubItemId());
      const done = normalizeDone(obj.done ?? obj.isCompleted ?? false);
      out.push({ id, text, done });
    }
  }
  return out;
}

function normalizeDone(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function defaultSubItemId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `sub-${Date.now().toString(36)}-${rand}`;
}
