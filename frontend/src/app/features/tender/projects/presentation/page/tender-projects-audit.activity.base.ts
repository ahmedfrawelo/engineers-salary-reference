import { Activity } from './tender-project-details/tabs/activity-tab.component';
import { TenderRow } from './tender-project-details/project-details.component';
import type { AuditTrail } from './tender-projects.contracts';

export abstract class TenderProjectsAuditActivityBase {
  protected abstract normalizeLabel(value: unknown): string | null;
  protected abstract parseId(value: unknown): number | null;
  protected abstract auditValue(item: AuditTrail, ...keys: string[]): unknown;
  abstract parseAuditDate(item: AuditTrail): Date | null;
  abstract resolveAuditEntityId(item: AuditTrail): number | null;

  combineDetail(primary: string, secondary: string): string {
    const first = primary.trim();
    const second = secondary.trim();
    if (!first) return second;
    if (!second) return first;
    const firstLower = first.toLowerCase();
    const secondLower = second.toLowerCase();
    if (firstLower.includes(secondLower)) return first;
    if (secondLower.includes(firstLower)) return second;
    return `${first}; ${second}`;
  }

  shouldShowBadge(badge: string | undefined, title: string): boolean {
    if (!badge) return false;
    const badgeLower = badge.toLowerCase();
    const titleLower = title.toLowerCase();
    if (!badgeLower || !titleLower) return false;
    if (titleLower.includes(badgeLower)) return false;
    return true;
  }

  shrinkAuditTitle(title: string, actionLabel: string, entityLabel: string): string {
    const raw = title.trim();
    if (!raw) return raw;
    const entity = this.normalizeLabel(entityLabel) ?? '';
    const action = this.normalizeLabel(actionLabel) ?? '';
    let candidate = raw;
    if (entity && entity.toLowerCase() === 'project') {
      const pattern = new RegExp(`\\b${this.escapeRegExp(entity)}\\b`, 'ig');
      candidate = candidate
        .replace(pattern, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    if (!candidate) candidate = action || raw;
    return candidate;
  }

  escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isGeneratedAuditTitle(title: string, actionLabel: string, entityLabel: string): boolean {
    const action = this.normalizeLabel(actionLabel) ?? '';
    const entity = this.normalizeLabel(entityLabel) ?? '';
    if (!action || !entity) return false;
    const rawLower = title.trim().toLowerCase();
    const expected = `${action} ${entity}`.toLowerCase();
    return rawLower === expected;
  }

  isGenericAuditText(value: string): boolean {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return true;
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
      'status',
      'stage'
    ]);
    return generic.has(cleaned);
  }

  resolveAuditTone(
    actionRaw: string | null,
    message: string | null
  ): { badge?: string; icon?: string; tone?: Activity['tone'] } {
    const haystack = `${actionRaw ?? ''} ${message ?? ''}`.toLowerCase();
    if (haystack.includes('delete') || haystack.includes('remove')) {
      return { badge: 'Deleted', icon: 'trash', tone: 'danger' };
    }
    if (haystack.includes('create') || haystack.includes('add') || haystack.includes('new')) {
      return { badge: 'Created', icon: 'plus-circle', tone: 'success' };
    }
    if (
      haystack.includes('approve') ||
      haystack.includes('accept') ||
      haystack.includes('confirm')
    ) {
      return { badge: 'Approved', icon: 'check-circle', tone: 'success' };
    }
    if (haystack.includes('reject') || haystack.includes('decline') || haystack.includes('deny')) {
      return { badge: 'Rejected', icon: 'x-circle', tone: 'danger' };
    }
    if (haystack.includes('submit')) {
      return { badge: 'Submitted', icon: 'send', tone: 'info' };
    }
    if (
      haystack.includes('update') ||
      haystack.includes('modify') ||
      haystack.includes('edit') ||
      haystack.includes('change')
    ) {
      return { badge: 'Updated', icon: 'pencil', tone: 'info' };
    }
    if (
      haystack.includes('assign') ||
      haystack.includes('owner') ||
      haystack.includes('assignee')
    ) {
      return { badge: 'Assigned', icon: 'person-check', tone: 'info' };
    }
    if (haystack.includes('checklist')) {
      return { badge: 'Checklist', icon: 'list-check', tone: 'info' };
    }
    if (haystack.includes('status') || haystack.includes('stage')) {
      return { badge: 'Status', icon: 'flag', tone: 'warning' };
    }
    if (haystack.includes('upload') || haystack.includes('attach')) {
      return { badge: 'Uploaded', icon: 'cloud-arrow-up', tone: 'info' };
    }
    if (haystack.includes('download')) {
      return { badge: 'Downloaded', icon: 'cloud-arrow-down', tone: 'info' };
    }
    if (haystack.includes('export')) {
      return { badge: 'Exported', icon: 'box-arrow-up-right', tone: 'info' };
    }
    if (haystack.includes('import')) {
      return { badge: 'Imported', icon: 'box-arrow-in-down', tone: 'info' };
    }
    if (haystack.includes('share')) {
      return { badge: 'Shared', icon: 'share', tone: 'info' };
    }
    if (haystack.includes('archive')) {
      return { badge: 'Archived', icon: 'archive', tone: 'muted' };
    }
    if (haystack.includes('restore') || haystack.includes('reopen')) {
      return { badge: 'Restored', icon: 'arrow-clockwise', tone: 'info' };
    }
    if (haystack.includes('login') || haystack.includes('sign in') || haystack.includes('signin')) {
      return { badge: 'Login', icon: 'box-arrow-in-right', tone: 'muted' };
    }
    if (
      haystack.includes('logout') ||
      haystack.includes('sign out') ||
      haystack.includes('signout')
    ) {
      return { badge: 'Logout', icon: 'box-arrow-right', tone: 'muted' };
    }
    if (
      haystack.includes('system') ||
      haystack.includes('auto') ||
      haystack.includes('background')
    ) {
      return { badge: 'System', icon: 'cpu', tone: 'muted' };
    }
    if (haystack.includes('comment') || haystack.includes('note')) {
      return { badge: 'Note', icon: 'chat-right-text', tone: 'info' };
    }
    const label = this.toSentenceCase(actionRaw ?? '');
    return {
      badge: label && label.length <= 14 ? label : undefined,
      icon: 'activity',
      tone: label ? 'info' : 'muted'
    };
  }

  resolveAuditKind(actionRaw: string | null, message: string | null): Activity['kind'] {
    const haystack = `${actionRaw ?? ''} ${message ?? ''}`.toLowerCase();
    if (haystack.includes('delete') || haystack.includes('remove')) return 'deleted';
    if (haystack.includes('create') || haystack.includes('add') || haystack.includes('new'))
      return 'created';
    if (haystack.includes('approve') || haystack.includes('accept') || haystack.includes('confirm'))
      return 'approved';
    if (haystack.includes('reject') || haystack.includes('decline') || haystack.includes('deny'))
      return 'rejected';
    if (haystack.includes('submit')) return 'submitted';
    if (
      haystack.includes('update') ||
      haystack.includes('modify') ||
      haystack.includes('edit') ||
      haystack.includes('change')
    )
      return 'updated';
    if (haystack.includes('assign') || haystack.includes('owner') || haystack.includes('assignee'))
      return 'assigned';
    if (haystack.includes('checklist')) return 'checklist';
    if (haystack.includes('status') || haystack.includes('stage')) return 'status';
    if (haystack.includes('upload') || haystack.includes('attach')) return 'uploaded';
    if (haystack.includes('download')) return 'downloaded';
    if (haystack.includes('export')) return 'exported';
    if (haystack.includes('import')) return 'imported';
    if (haystack.includes('share')) return 'shared';
    if (haystack.includes('archive')) return 'archived';
    if (haystack.includes('restore') || haystack.includes('reopen')) return 'restored';
    if (haystack.includes('login') || haystack.includes('sign in') || haystack.includes('signin'))
      return 'login';
    if (
      haystack.includes('logout') ||
      haystack.includes('sign out') ||
      haystack.includes('signout')
    )
      return 'logout';
    if (haystack.includes('system') || haystack.includes('auto') || haystack.includes('background'))
      return 'system';
    if (haystack.includes('comment') || haystack.includes('note')) return 'note';
    return 'other';
  }

  toSentenceCase(value: string): string {
    const text = value.trim();
    if (!text) return '';
    const human = this.humanizeLabel(text);
    const lower = human.toLowerCase();
    const replacements: Record<string, string> = {
      modified: 'Updated',
      modification: 'Updated'
    };
    return replacements[lower] ?? human;
  }

  normalizeEntityLabel(value: string): string {
    const text = value.trim();
    if (!text) return 'Project';
    const lower = text.toLowerCase();
    if (lower === 'tenderprojects' || lower === 'tenderproject' || lower === 'projects')
      return 'Project';
    const human = this.humanizeLabel(text);
    return human || text;
  }

  humanizeLabel(value: string): string {
    const cleaned = value
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  isIdField(value: string): boolean {
    const tokens = value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return tokens.includes('id') || tokens.includes('uuid');
  }

  buildAuditText(item: AuditTrail, row: TenderRow): string {
    const message = this.normalizeLabel(item.message ?? item.description ?? item.details);
    const action = this.normalizeLabel(item.actionType ?? item.action);
    const actor = this.normalizeLabel(
      item.userName ?? item.user ?? item.performedBy ?? item.createdBy
    );
    const entityName = this.normalizeLabel(item.entityName) ?? 'Project';
    const entityId = this.resolveAuditEntityId(item);

    let text = message || '';
    if (!text) {
      const target = entityId ? `${entityName} #${entityId}` : entityName;
      text = action ? `${action} ${target}` : `Updated ${target}`;
    }
    if (actor) text = `${text} by ${actor}`;
    if (!text && row?.title) text = row.title;
    return text;
  }

  dedupeAudit(items: AuditTrail[]): AuditTrail[] {
    const seen = new Set<string>();
    const output: AuditTrail[] = [];
    for (const item of items) {
      const id = this.parseId(this.auditValue(item, 'id'));
      const time = this.parseAuditDate(item)?.toISOString() ?? '';
      const msg =
        this.normalizeLabel(
          item.message ?? item.description ?? item.details ?? item.actionType ?? item.action
        ) ?? '';
      const key = id ? `id:${id}` : `k:${time}:${msg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return output;
  }

  groupActivities(items: Activity[]): Activity[] {
    if (!items?.length) return [];
    const output: Activity[] = [];
    // Keep only a very small dedupe window to hide immediate echo duplicates
    // (for example pending local entry + server echo) without collapsing real history.
    const windowMs = 15 * 1000;
    for (const item of items) {
      const last = output[output.length - 1];
      if (
        last &&
        last.signature &&
        item.signature &&
        last.signature === item.signature &&
        last.at &&
        item.at
      ) {
        const diff = Math.abs(last.at - item.at);
        if (diff <= windowMs) {
          last.count = (last.count ?? 1) + 1;
          continue;
        }
      }
      output.push({ ...item });
    }
    return output;
  }

  getAuditEntityNames(): string[] {
    return [
      'Projects',
      'Project',
      'TenderProjects',
      'TenderProject',
      'CheckList',
      'TenderActivityComment'
    ];
  }
}
