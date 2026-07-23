import { Activity } from './tender-project-details/tabs/activity-tab.component';
import { TenderRow } from './tender-project-details/project-details.component';
import { TenderProjectsAuditActivityBase } from './tender-projects-audit.activity.base';
import type { AuditTrail } from './tender-projects.contracts';

export type TenderProjectsAuditHelperDeps = {
  normalizeLabel: (value: unknown) => string | null;
  parseId: (value: unknown) => number | null;
  pickName: (...values: unknown[]) => string | null;
  auditTimeFormatter: Intl.DateTimeFormat;
};

export class TenderProjectsAuditHelper extends TenderProjectsAuditActivityBase {
  constructor(private readonly deps: TenderProjectsAuditHelperDeps) {
    super();
  }

  protected override normalizeLabel(value: unknown): string | null {
    return this.deps.normalizeLabel(value);
  }

  protected override parseId(value: unknown): number | null {
    return this.deps.parseId(value);
  }

  private pickName(...values: unknown[]): string | null {
    return this.deps.pickName(...values);
  }

  private get auditTimeFormatter(): Intl.DateTimeFormat {
    return this.deps.auditTimeFormatter;
  }

  private asAuditRecord(item: AuditTrail): Record<string, unknown> {
    return item as unknown as Record<string, unknown>;
  }

  protected override auditValue(item: AuditTrail, ...keys: string[]): unknown {
    const record = this.asAuditRecord(item);
    for (const key of keys) {
      const value = record[key];
      if (value != null) return value;
    }
    return undefined;
  }
  override resolveAuditEntityId(item: AuditTrail): number | null {
    const raw = this.auditValue(
      item,
      'entityId',
      'entityID',
      'entityKey',
      'recordId',
      'recordID',
      'targetId',
      'projectId',
      'projectID',
      'id'
    );
    return this.parseId(raw);
  }
  auditTextHaystack(item: AuditTrail): string {
    const parts = [
      item.message,
      item.description,
      item.details,
      item.actionType,
      item.action,
      item.entityName,
      item.userName,
      item.user,
      item.performedBy,
      item.createdBy
    ]
      .filter(Boolean)
      .map(value => String(value));
    return parts.join(' ').toLowerCase();
  }
  mapAuditToActivity(item: AuditTrail, row: TenderRow): Activity | null {
    const date = this.parseAuditDate(item);
    const message = this.normalizeLabel(item.message ?? item.description ?? item.details);
    const actionRaw = this.normalizeLabel(item.actionType ?? item.action);
    const actor = this.normalizeLabel(
      item.userName ?? item.user ?? item.performedBy ?? item.createdBy
    );
    const rawEntityLabel =
      this.normalizeLabel(
        item.entityName ??
          this.auditValue(item, 'entity', 'entityType', 'table', 'tableName', 'module', 'resource')
      ) ?? 'Project';
    const entityLabel = this.normalizeEntityLabel(rawEntityLabel);
    const rowTitle = this.normalizeLabel(row?.title);
    const entityDisplay = this.normalizeLabel(
      this.auditValue(
        item,
        'entityDisplayName',
        'entityTitle',
        'recordName',
        'recordTitle',
        'targetName',
        'referenceName'
      )
    );
    const activityId = this.parseId(
      this.auditValue(item, 'id', 'activityId', 'commentId', 'noteId')
    );
    const entityId = this.resolveAuditEntityId(item);
    const contextLabel = rowTitle ?? entityDisplay ?? null;
    const targetLabel = contextLabel ?? entityLabel;
    const fieldLabel = this.extractAuditFieldLabel(item);
    const actionLabel = this.toSentenceCase(actionRaw ?? 'Updated');
    const titleEntity =
      this.shouldUseFieldInTitle(actionRaw, message) && fieldLabel ? fieldLabel : entityLabel;
    const baseTitle = this.buildAuditTitle(actionLabel, titleEntity, message);
    const title = this.isGeneratedAuditTitle(baseTitle, actionLabel, entityLabel)
      ? this.shrinkAuditTitle(baseTitle, actionLabel, entityLabel)
      : baseTitle;
    const metaBase = this.buildAuditMeta(targetLabel, title);
    const meta = this.mergeAuditMeta(metaBase, null, title);
    const changeSummary = this.buildAuditChangeSummary(item);
    const detailFromMessage = this.pickAuditDetail(message, title);
    const fallbackDetail = this.pickAuditTitleFallback(rowTitle, title, meta) ?? entityDisplay;
    const detail = detailFromMessage ?? changeSummary?.short ?? fallbackDetail ?? undefined;
    let detailShort: string | undefined;
    let detailLong: string | undefined;
    if (changeSummary?.long) {
      if (detailFromMessage) {
        const combined = this.combineDetail(detailFromMessage, changeSummary.long);
        if (combined && combined !== detailFromMessage) {
          detailShort = detailFromMessage;
          detailLong = combined;
        }
      } else if (changeSummary.short && changeSummary.long !== changeSummary.short) {
        detailShort = changeSummary.short;
        detailLong = changeSummary.long;
      }
    }
    const toneInfo = this.resolveAuditTone(actionRaw, message);
    const noteHint = [rawEntityLabel, entityDisplay, fieldLabel, actionRaw]
      .filter(Boolean)
      .some(value => /comment|note/i.test(String(value)));
    const kind = noteHint ? 'note' : this.resolveAuditKind(actionRaw, message);
    const badge = this.shouldShowBadge(toneInfo.badge, title) ? toneInfo.badge : undefined;

    if (!title) return null;

    const sanitized =
      kind === 'note'
        ? this.sanitizeNoteActivity({ title, detail, detailShort, detailLong })
        : { title, detail, detailShort, detailLong };

    return {
      id: activityId ?? undefined,
      entityId: entityId ?? undefined,
      when: date ? this.formatRelativeTime(date) : '',
      title: sanitized.title,
      meta: meta ?? undefined,
      actor: actor ?? undefined,
      detail: sanitized.detail ?? undefined,
      detailShort: sanitized.detailShort,
      detailLong: sanitized.detailLong,
      badge,
      icon: toneInfo.icon,
      tone: toneInfo.tone,
      kind,
      at: date?.getTime(),
      fullTime: date ? this.auditTimeFormatter.format(date) : undefined,
      signature: [
        sanitized.title,
        meta,
        actor,
        kind,
        entityId,
        changeSummary?.signature ?? sanitized.detail
      ]
        .filter(Boolean)
        .join('|')
        .toLowerCase()
    };
  }
  sanitizeNoteActivity(value: {
    title: string;
    detail?: string | null;
    detailShort?: string | null;
    detailLong?: string | null;
  }): { title: string; detail?: string; detailShort?: string; detailLong?: string } {
    const rawDetail = value.detailLong ?? value.detailShort ?? value.detail ?? value.title;
    const detailText = (rawDetail ?? '').trim();
    const fallback = this.stripMentions(value.title) || 'Comment';
    return {
      title: 'Comment',
      detail: detailText || fallback,
      detailShort: undefined,
      detailLong: undefined
    };
  }
  stripMentions(text: string): string {
    if (!text) return '';
    const cleaned = text
      .replace(/@[^\s@]{1,64}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleaned;
  }
  override parseAuditDate(item: AuditTrail): Date | null {
    const raw = this.auditValue(
      item,
      'createdAt',
      'createdOn',
      'timestamp',
      'time',
      'date',
      'actionDate',
      'createdDate'
    );
    if (raw == null) return null;
    if (typeof raw === 'number') {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    const text = String(raw);
    const d = new Date(text);
    return isNaN(d.getTime()) ? null : d;
  }
  formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 0) return this.auditTimeFormatter.format(date);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    return this.auditTimeFormatter.format(date);
  }
  buildAuditTitle(actionLabel: string, entityLabel: string, message: string | null): string {
    const action = this.normalizeLabel(actionLabel) ?? 'Updated';
    const entity = this.normalizeLabel(entityLabel) ?? 'Project';
    const messageTitle = this.normalizeLabel(message);
    if (messageTitle && !this.isGenericAuditMessage(messageTitle, action, entity)) {
      const msgLower = messageTitle.toLowerCase();
      const actionLower = action.toLowerCase();
      const entityLower = entity.toLowerCase();
      if (
        messageTitle.length <= 80 &&
        !msgLower.includes(' by ') &&
        (msgLower.includes(actionLower) || msgLower.includes(entityLower))
      ) {
        return messageTitle;
      }
    }
    if (action.toLowerCase().includes(entity.toLowerCase())) return action;
    return `${action} ${entity}`;
  }
  isGenericAuditMessage(message: string, action: string, entity: string): boolean {
    const msgLower = message.trim().toLowerCase();
    if (!msgLower) return true;
    const actionLower = action.trim().toLowerCase();
    const entityLower = entity.trim().toLowerCase();
    if (msgLower === actionLower || msgLower === entityLower) return true;
    if (msgLower === `${actionLower} ${entityLower}`) return true;
    const generic = new Set([
      'modified',
      'updated',
      'update',
      'changed',
      'change',
      'edited',
      'edit',
      'created',
      'create',
      'deleted',
      'delete',
      'removed',
      'remove',
      'assigned',
      'assign',
      'approved',
      'approve',
      'rejected',
      'reject',
      'submitted',
      'submit',
      'commented',
      'comment',
      'note',
      'noted',
      'login',
      'logout'
    ]);
    if (msgLower.length <= 12 && generic.has(msgLower)) return true;
    return false;
  }
  buildAuditMeta(targetLabel: string, title?: string | null): string | null {
    const target = this.normalizeLabel(targetLabel);
    const titleLower = title?.toLowerCase() ?? '';
    if (target && !titleLower.includes(target.toLowerCase())) return target;
    return null;
  }
  pickAuditDetail(message: string | null, title: string): string | null {
    if (!message) return null;
    const msg = message.trim();
    if (!msg) return null;
    if (this.isGenericAuditText(msg)) return null;
    const titleLower = title.toLowerCase();
    const msgLower = msg.toLowerCase();
    if (titleLower === msgLower) return null;
    if (titleLower.includes(msgLower) || msgLower.includes(titleLower)) return null;
    return msg;
  }
  pickAuditTitleFallback(
    rowTitle: string | null,
    title: string,
    meta: string | null
  ): string | null {
    const label = this.normalizeLabel(rowTitle);
    if (!label) return null;
    const titleLower = title.toLowerCase();
    const metaLower = meta?.toLowerCase() ?? '';
    const labelLower = label.toLowerCase();
    if (titleLower.includes(labelLower) || metaLower.includes(labelLower)) return null;
    return label;
  }
  extractAuditFieldLabel(item: AuditTrail): string | null {
    const raw = this.normalizeLabel(
      this.auditValue(
        item,
        'field',
        'fieldName',
        'property',
        'propertyName',
        'column',
        'columnName',
        'attribute',
        'attributeName'
      )
    );
    if (!raw) return null;
    const human = this.humanizeLabel(raw);
    if (!human || this.isIdField(human)) return null;
    return human;
  }
  shouldUseFieldInTitle(actionRaw: string | null, message: string | null): boolean {
    const haystack = `${actionRaw ?? ''} ${message ?? ''}`.toLowerCase();
    const triggers = ['update', 'modify', 'edit', 'change', 'status', 'stage', 'assign', 'set'];
    return triggers.some(trigger => haystack.includes(trigger));
  }
  mergeAuditMeta(
    meta: string | null,
    fieldLabel: string | null,
    title: string,
    contextLabel?: string | null
  ): string | null {
    const parts: string[] = [];
    const titleLower = title.toLowerCase();
    const addPart = (value: string | null | undefined) => {
      const label = this.normalizeLabel(value);
      if (!label) return;
      const lower = label.toLowerCase();
      if (titleLower.includes(lower)) return;
      if (
        parts.some(part => part.toLowerCase().includes(lower) || lower.includes(part.toLowerCase()))
      )
        return;
      parts.push(label);
    };
    addPart(meta);
    addPart(fieldLabel);
    addPart(contextLabel);
    return parts.length ? parts.join(' | ') : null;
  }
  buildAuditChangeSummary(
    item: AuditTrail
  ): { short?: string; long?: string; signature?: string } | null {
    const changes = this.extractAuditChanges(item);
    if (!changes.length) return null;
    const lines = changes.map(change => this.formatChangeLine(change)).filter(Boolean) as string[];
    if (!lines.length) return null;
    const maxShort = 4;
    const withBullets = lines.length > 1;
    const decorated = withBullets ? lines.map(line => `- ${line}`) : lines;
    const shortLines = decorated.slice(0, maxShort);
    let short = shortLines.join('\n');
    if (decorated.length > maxShort) {
      short = `${short}\n- +${decorated.length - maxShort} more`;
    }
    const long = decorated.join('\n');
    return {
      short,
      long: long !== short ? long : undefined,
      signature: lines.join('|')
    };
  }
  formatChangeLine(change: { field: string; from?: string; to?: string }): string | null {
    const field = change.field?.trim();
    if (!field) return null;
    const from = change.from?.trim() ?? '';
    const to = change.to?.trim() ?? '';
    if (from && to && this.isSameAuditValue(from, to)) return null;
    if (from && to) return `${field}: ${from} -> ${to}`;
    if (to) return `${field}: ${to}`;
    if (from) return `${field}: ${from}`;
    return null;
  }
  extractAuditChanges(item: AuditTrail): Array<{ field: string; from?: string; to?: string }> {
    const direct = this.parseChangeEntries(
      this.auditValue(item, 'changes', 'changeSet', 'changeset', 'diff', 'diffs', 'delta')
    );
    if (direct.length) return direct;

    const fieldLabel = this.extractAuditFieldLabel(item);
    const fromRaw = this.auditValue(item, 'oldValue', 'previous', 'before', 'from', 'old');
    const toRaw = this.auditValue(item, 'newValue', 'current', 'after', 'to', 'new');
    if (fieldLabel && (fromRaw != null || toRaw != null)) {
      const from = this.formatAuditValue(fromRaw);
      const to = this.formatAuditValue(toRaw);
      if (from && to && this.isSameAuditValue(from, to)) {
        // Skip no-op changes and keep checking other diff sources.
      } else if (from || to) {
        return [{ field: fieldLabel, from: from ?? undefined, to: to ?? undefined }];
      }
    }

    const oldValues = this.parseAuditObject(
      this.auditValue(item, 'oldValues', 'previousValues', 'beforeValues', 'before', 'old')
    );
    const newValues = this.parseAuditObject(
      this.auditValue(item, 'newValues', 'currentValues', 'afterValues', 'after', 'new')
    );
    const diff = this.buildChangesFromValueSet(oldValues, newValues);
    if (diff.length) return diff;

    const fromDetails = this.parseChangeEntries(item.details ?? item.description ?? item.message);
    return fromDetails;
  }
  buildChangesFromValueSet(
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ): Array<{ field: string; from?: string; to?: string }> {
    if (!oldValues && !newValues) return [];
    const keys = new Set<string>([
      ...Object.keys(oldValues ?? {}),
      ...Object.keys(newValues ?? {})
    ]);
    const skipKeys = new Set([
      'id',
      'createdat',
      'createdon',
      'updatedat',
      'updatedon',
      'timestamp',
      'time',
      'date',
      'createdby',
      'updatedby'
    ]);
    const output: Array<{ field: string; from?: string; to?: string }> = [];
    for (const key of keys) {
      if (output.length >= 12) break;
      if (skipKeys.has(key.toLowerCase())) continue;
      const fieldLabel = this.humanizeLabel(key);
      if (this.isIdField(fieldLabel)) continue;
      const from = this.formatAuditValue(oldValues ? oldValues[key] : undefined);
      const to = this.formatAuditValue(newValues ? newValues[key] : undefined);
      if (!from && !to) continue;
      if (from && to && this.isSameAuditValue(from, to)) continue;
      output.push({
        field: fieldLabel,
        from: from ?? undefined,
        to: to ?? undefined
      });
    }
    return output;
  }
  parseChangeEntries(value: unknown): Array<{ field: string; from?: string; to?: string }> {
    const parsed = this.parseJsonMaybe(value);
    if (!parsed || typeof parsed !== 'object') return [];
    if (Array.isArray(parsed)) {
      const output: Array<{ field: string; from?: string; to?: string }> = [];
      for (const entry of parsed) {
        if (output.length >= 12) break;
        const parsedEntry = this.parseChangeEntry(entry);
        if (parsedEntry) output.push(parsedEntry);
      }
      return output;
    }
    const direct = this.parseChangeEntry(parsed);
    if (direct) return [direct];
    const output: Array<{ field: string; from?: string; to?: string }> = [];
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (output.length >= 12) break;
      const parsedEntry = this.parseChangeEntry(entry, key);
      if (parsedEntry) output.push(parsedEntry);
    }
    return output;
  }
  parseChangeEntry(
    value: unknown,
    fallbackField?: string
  ): { field: string; from?: string; to?: string } | null {
    const parsed = this.parseJsonMaybe(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const rawField = this.normalizeLabel(
        obj.field ??
          obj.fieldName ??
          obj.property ??
          obj.propertyName ??
          obj.key ??
          obj.name ??
          obj.column ??
          obj.columnName ??
          fallbackField
      );
      const field = rawField
        ? this.humanizeLabel(rawField)
        : fallbackField
          ? this.humanizeLabel(fallbackField)
          : '';
      if (field && this.isIdField(field)) return null;
      const from = this.formatAuditValue(
        obj.oldValue ?? obj.old ?? obj.previous ?? obj.before ?? obj.from
      );
      const to = this.formatAuditValue(
        obj.newValue ?? obj.new ?? obj.current ?? obj.after ?? obj.to
      );
      if (field && (from || to)) {
        return { field, from: from ?? undefined, to: to ?? undefined };
      }
      const valueLabel = this.formatAuditValue(obj.value ?? obj.val ?? obj.data ?? obj.result);
      if (field && valueLabel) {
        return { field, to: valueLabel };
      }
    }
    if (fallbackField) {
      const to = this.formatAuditValue(parsed);
      if (to) return { field: this.humanizeLabel(fallbackField), to };
    }
    return null;
  }
  parseAuditObject(value: unknown): Record<string, unknown> | null {
    const parsed = this.parseJsonMaybe(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  }
  parseJsonMaybe(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    const looksJson =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));
    if (!looksJson) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  cleanAuditText(value: string): string {
    let cleaned = value
      .replace(/[\u0000-\u001F]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    cleaned = cleaned.replace(/[;,]+$/g, '');
    if (!/\d/.test(cleaned)) {
      cleaned = cleaned.replace(/[^\p{L}\p{N}\s._-]+$/gu, '');
    }
    return cleaned.trim();
  }
  normalizeCompareValue(value: string): string {
    const cleaned = this.cleanAuditText(value);
    return cleaned.toLowerCase().replace(/\s+/g, ' ');
  }
  isSameAuditValue(a: string, b: string): boolean {
    return this.normalizeCompareValue(a) === this.normalizeCompareValue(b);
  }
  isNullishAuditText(value: string): boolean {
    const cleaned = this.cleanAuditText(value).toLowerCase();
    if (!cleaned) return true;
    return ['null', 'undefined', 'n/a', 'na', 'none', '-', '--'].includes(cleaned);
  }
  formatAuditValue(value: unknown, maxLen = 60): string | null {
    if (value == null) return null;
    if (typeof value === 'string') {
      const cleaned = this.cleanAuditText(value);
      if (!cleaned || this.isNullishAuditText(cleaned)) return null;
      const parsed = this.parseJsonMaybe(cleaned);
      if (parsed !== cleaned) {
        return this.formatAuditValue(parsed, maxLen);
      }
      return this.truncateAuditText(cleaned, maxLen);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return this.auditTimeFormatter.format(value);
    }
    const label = this.pickName(value);
    if (label) {
      const cleaned = this.cleanAuditText(label);
      if (!cleaned || this.isNullishAuditText(cleaned)) return null;
      return this.truncateAuditText(cleaned, maxLen);
    }
    if (Array.isArray(value)) {
      const parts = value
        .map(entry => this.formatAuditValue(entry, 20))
        .filter(Boolean) as string[];
      if (!parts.length) return null;
      const combined = this.cleanAuditText(parts.join(', '));
      if (!combined || this.isNullishAuditText(combined)) return null;
      return this.truncateAuditText(combined, maxLen);
    }
    if (typeof value === 'object') {
      const json = this.stringifyAuditValue(value);
      if (!json) return null;
      const cleaned = this.cleanAuditText(json);
      if (!cleaned || this.isNullishAuditText(cleaned)) return null;
      return this.truncateAuditText(cleaned, maxLen);
    }
    const fallback = this.cleanAuditText(String(value));
    if (!fallback || this.isNullishAuditText(fallback)) return null;
    return this.truncateAuditText(fallback, maxLen);
  }
  stringifyAuditValue(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  truncateAuditText(value: string, maxLen: number): string {
    if (value.length <= maxLen) return value;
    const safeLen = Math.max(0, maxLen - 3);
    return `${value.slice(0, safeLen)}...`;
  }
}
