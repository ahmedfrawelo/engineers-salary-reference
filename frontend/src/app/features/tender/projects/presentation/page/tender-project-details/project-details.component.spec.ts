import { describe, expect, it } from 'vitest';
import {
  parseChecklistNotesEnvelope,
  serializeChecklistNotesEnvelope
} from './project-details-checklist-notes.util';

describe('Project details checklist notes compatibility', () => {
  it('preserves tt metadata when serializing checklist notes', () => {
    const raw = JSON.stringify({
      n: 'Legacy note',
      s: [['Sub A', 0]],
      o: 1,
      tt: { v: 1, priority: 'high', status: 'review' },
      ext: 'keep'
    });

    const parsed = parseChecklistNotesEnvelope(raw, () => 'sub-fixed-id');

    const serialized = serializeChecklistNotesEnvelope({
      subItems: parsed.subItems,
      noteText: 'Updated note',
      order: 4,
      notesEnvelope: parsed.envelope
    });

    const decoded = JSON.parse(serialized || '{}') as Record<string, unknown>;
    const tt = decoded.tt as Record<string, unknown>;
    expect(decoded.ext).toBe('keep');
    expect(decoded.n).toBe('Updated note');
    expect(decoded.o).toBe(4);
    expect(tt?.priority).toBe('high');
    expect(tt?.status).toBe('review');
  });
});
