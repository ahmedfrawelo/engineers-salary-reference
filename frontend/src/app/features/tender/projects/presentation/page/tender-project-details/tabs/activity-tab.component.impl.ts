import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import {
  ACTIVITY_TAB_FILTERS,
  type Activity,
  type ActivityKind,
  type ActivityNotePayload,
  type MentionUser
} from './activity-tab.models';
export type { Activity, ActivityNotePayload, MentionUser } from './activity-tab.models';

@Component({
  selector: 'activity-tab',
  standalone: true,
  imports: [CommonModule, DragDropModule, AppIconDirective],
  templateUrl: './activity-tab.component.html',
  styleUrls: ['./activity-tab.component.scss']
})
export class ActivityTabComponent implements OnChanges {
  private readonly INITIAL_VISIBLE_ITEMS = 24;
  private readonly LOAD_MORE_ITEMS = 24;
  @Input() activities: Activity[] = [];
  @Input() loading = false;
  @Input() allowComment = true;
  @Input() mentionUsers: Array<MentionUser | string> = [];

  @Input() height: number | string = 'auto';
  @Input() showHeader = true;
  @Input() framed = true;

  @Output() addNote = new EventEmitter<ActivityNotePayload>();
  @Output() composerFocus = new EventEmitter<void>();

  private sanitizer = inject(DomSanitizer);
  heightStyle = 'auto';
  groupedActivities: Array<{ key: string; label: string; items: Activity[] }> = [];
  filterCounts: Record<string, number> = {};
  activeFilter: 'all' | ActivityKind = 'all';
  visibleFilters: Array<{ id: 'all' | ActivityKind; label: string }> = [];
  searchTerm = '';
  density: 'cozy' | 'compact' = 'compact';
  summary: {
    title: string;
    actor?: string;
    time?: string;
    fullTitle?: string;
    fullTime?: string;
  } | null = null;
  commentText = '';
  mentionOpen = false;
  mentionIndex = 0;
  mentionQuery = '';
  mentionFiltered: MentionUser[] = [];
  mentionSelected: MentionUser[] = [];
  readonly loadingPlaceholders = [0, 1, 2];
  visibleItemLimit = this.INITIAL_VISIBLE_ITEMS;
  filteredItemCount = 0;
  private mentionRange: { start: number; end: number } | null = null;
  private mentionPool: MentionUser[] = [];
  readonly filters: Array<{ id: 'all' | ActivityKind; label: string }> = ACTIVITY_TAB_FILTERS;
  private expanded = new Set<string>();
  private processed: Activity[] = [];
  private readonly dayFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  ngOnChanges(_: SimpleChanges) {
    this.resetVisibleItems();
    this.heightStyle =
      typeof this.height === 'number'
        ? `${this.height}px`
        : this.height?.toString().trim() || 'auto';
    this.refreshView();
    this.mentionPool = this.buildMentionPool();
    this.closeMention();
    this.mentionSelected = [];
  }

  emitNote(input: HTMLInputElement) {
    const body = (input.value ?? '').trim();
    if (!body && !this.mentionSelected.length) return;
    const mentionPrefix = this.mentionSelected.map(m => `@${this.mentionHandle(m)}`).join(' ');
    const combined = [mentionPrefix, body].filter(Boolean).join(' ').trim();
    const extracted = this.extractMentions(combined);
    const merged = this.mergeMentions(this.mentionSelected, extracted);
    this.addNote.emit({ text: combined, mentions: merged.users, handles: merged.handles });
    input.value = '';
    this.commentText = '';
    this.mentionSelected = [];
    this.closeMention();
  }

  onCommentInput(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    this.commentText = input.value ?? '';
    this.updateMentionState(input);
  }

  onCommentKeydown(event: KeyboardEvent, input: HTMLInputElement) {
    if (this.mentionOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.mentionIndex = (this.mentionIndex + 1) % this.mentionFiltered.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.mentionIndex =
          (this.mentionIndex - 1 + this.mentionFiltered.length) % this.mentionFiltered.length;
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const user = this.mentionFiltered[this.mentionIndex];
        if (user) this.selectMention(user, input);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMention();
        return;
      }
    }

    if (event.key === 'Backspace' && !input.value && this.mentionSelected.length) {
      event.preventDefault();
      this.mentionSelected = this.mentionSelected.slice(0, -1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.emitNote(input);
    }
  }

  selectMention(user: MentionUser, input: HTMLInputElement) {
    if (!this.mentionRange) return;
    const handle = this.mentionHandle(user);
    const value = input.value ?? '';
    const before = value.slice(0, this.mentionRange.start);
    const after = value.slice(this.mentionRange.end);
    const next = `${before}${after}`.replace(/\s{2,}/g, ' ');
    this.commentText = next.trimStart();
    input.value = this.commentText;
    const caret = before.length;
    input.setSelectionRange(caret, caret);
    this.addMention(user);
    this.closeMention();
    input.focus();
  }

  removeMention(index: number, event?: Event) {
    event?.stopPropagation();
    if (index < 0 || index >= this.mentionSelected.length) return;
    const next = [...this.mentionSelected];
    next.splice(index, 1);
    this.mentionSelected = next;
  }

  onMentionDrop(event: CdkDragDrop<MentionUser[]>) {
    if (!event || event.previousIndex === event.currentIndex) {
      return;
    }
    const list = [...this.mentionSelected];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.mentionSelected = list;
  }

  private addMention(user: MentionUser) {
    const key = this.mentionKey(user);
    if (!key) return;
    if (this.mentionSelected.some(item => this.mentionKey(item) === key)) return;
    this.mentionSelected = [...this.mentionSelected, user];
  }

  private mentionKey(user: MentionUser): string {
    return (user.id ?? user.email ?? user.handle ?? user.name ?? '')
      .toString()
      .trim()
      .toLowerCase();
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.searchTerm = input?.value ?? '';
    this.resetVisibleItems();
    this.refreshView();
  }

  clearSearch() {
    if (!this.searchTerm) return;
    this.searchTerm = '';
    this.resetVisibleItems();
    this.refreshView();
  }

  setFilter(id: 'all' | ActivityKind) {
    if (this.activeFilter === id) return;
    this.activeFilter = id;
    this.resetVisibleItems();
    this.refreshView();
  }

  setDensity(mode: 'cozy' | 'compact') {
    this.density = mode;
  }

  toggleDetail(item: Activity, event?: Event) {
    event?.stopPropagation();
    const key = this.activityKey(item);
    if (this.expanded.has(key)) {
      this.expanded.delete(key);
      return;
    }
    this.expanded.add(key);
  }

  isExpanded(item: Activity): boolean {
    return this.expanded.has(this.activityKey(item));
  }

  trackByActivity(_: number, item: Activity) {
    return item.key ?? item.signature ?? item.at ?? item.when ?? item.title ?? item.text;
  }

  get canShowMoreActivities(): boolean {
    return this.filteredItemCount > this.visibleItemLimit;
  }

  get remainingActivityCount(): number {
    return Math.max(0, this.filteredItemCount - this.visibleItemLimit);
  }

  showMoreActivities(): void {
    if (!this.canShowMoreActivities) {
      return;
    }
    this.visibleItemLimit += this.LOAD_MORE_ITEMS;
    this.refreshView();
  }

  private activityKey(item: Activity): string {
    return item.key ?? item.signature ?? `${item.at ?? ''}:${item.title ?? item.text ?? ''}`;
  }

  private refreshView() {
    this.processed = this.decorateActivities(this.activities || []);
    const searched = this.applySearch(this.processed);
    this.filterCounts = this.countKinds(searched);
    this.updateVisibleFilters();
    const filtered = this.applyFilter(searched);
    this.filteredItemCount = filtered.length;
    this.groupedActivities = this.limitGroupedActivities(this.groupActivities(filtered));
    this.summary = this.buildSummary(searched);
  }

  private applyFilter(items: Activity[]): Activity[] {
    if (this.activeFilter === 'all') return items;
    return items.filter(item => (item.kind ?? 'other') === this.activeFilter);
  }

  private applySearch(items: Activity[]): Activity[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item => this.searchHaystack(item).includes(term));
  }

  private countKinds(items: Activity[]): Record<string, number> {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      const kind = item.kind ?? 'other';
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return counts;
  }

  private updateVisibleFilters() {
    this.visibleFilters = this.filters.filter(filter => {
      if (filter.id === 'all') return true;
      if (this.activeFilter === filter.id) return true;
      return Boolean(this.filterCounts[filter.id]);
    });
  }

  private decorateActivities(items: Activity[]): Activity[] {
    return items.map((item, index) => {
      const detail = item.detail?.trim();
      let detailShort: string | undefined;
      let detailLong: string | undefined;
      if (detail && detail.length > 140) {
        const trimmed = detail.slice(0, 140);
        const lastSpace = trimmed.lastIndexOf(' ');
        const short = (lastSpace > 60 ? trimmed.slice(0, lastSpace) : trimmed).trim();
        detailShort = `${short}...`;
        detailLong = detail;
      }
      return {
        ...item,
        kind: item.kind ?? 'other',
        detailShort: item.detailShort ?? detailShort,
        detailLong: item.detailLong ?? detailLong,
        key:
          item.key ?? item.signature ?? `${item.at ?? ''}:${item.title ?? item.text ?? ''}:${index}`
      };
    });
  }

  private groupActivities(
    items: Activity[]
  ): Array<{ key: string; label: string; items: Activity[] }> {
    if (!items.length) return [];
    const groups: Array<{ key: string; label: string; items: Activity[] }> = [];
    const now = new Date();
    let currentKey = '';
    for (const item of items) {
      const date = item.at ? new Date(item.at) : null;
      const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'unknown';
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ key, label: date ? this.formatDayLabel(date, now) : 'Unknown', items: [] });
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }

  private limitGroupedActivities(
    groups: Array<{ key: string; label: string; items: Activity[] }>
  ): Array<{ key: string; label: string; items: Activity[] }> {
    let remaining = this.visibleItemLimit;
    if (remaining <= 0) {
      return [];
    }

    const limited: Array<{ key: string; label: string; items: Activity[] }> = [];
    for (const group of groups) {
      if (remaining <= 0) {
        break;
      }
      const items = group.items.slice(0, remaining);
      if (!items.length) {
        continue;
      }
      limited.push({ ...group, items });
      remaining -= items.length;
    }
    return limited;
  }

  private formatDayLabel(date: Date, now: Date): string {
    if (this.isSameDay(date, now)) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (this.isSameDay(date, yesterday)) return 'Yesterday';
    return this.dayFormatter.format(date);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private buildSummary(items: Activity[]): {
    title: string;
    actor?: string;
    time?: string;
    fullTitle?: string;
    fullTime?: string;
  } | null {
    if (!items.length) return null;
    const first = items[0];
    const rawTitle = first.title ?? first.text ?? 'Activity';
    const cleanedTitle = this.stripMentions(rawTitle);
    const fallbackTitle = rawTitle.includes('@') ? 'Comment' : rawTitle;
    const title = first.kind === 'note' ? 'Comment' : cleanedTitle || fallbackTitle;
    return {
      title,
      actor: first.actor ?? undefined,
      time: first.when ?? undefined,
      fullTitle: cleanedTitle || fallbackTitle || undefined,
      fullTime: first.fullTime ?? undefined
    };
  }

  private searchHaystack(item: Activity): string {
    const parts = [
      item.title,
      item.text,
      item.meta,
      item.actor,
      item.detail,
      item.detailLong,
      item.detailShort,
      item.badge,
      item.when,
      item.fullTime
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());
    return parts.join(' ');
  }

  private resetVisibleItems(): void {
    this.visibleItemLimit = this.INITIAL_VISIBLE_ITEMS;
  }

  highlight(value: string): SafeHtml {
    const raw = value ?? '';
    const term = this.searchTerm.trim();
    if (!term) return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(raw));
    const escaped = this.escapeHtml(raw);
    const result = this.applyHighlight(escaped, term);
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }

  formatRichText(value: string): SafeHtml {
    const raw = value ?? '';
    if (!raw) return this.sanitizer.bypassSecurityTrustHtml('');
    const term = this.searchTerm.trim();
    const normalized = this.normalizeMentionRuns(raw);
    const mentionRegex = /@([\p{L}\p{N}._-]{1,64})/gu;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const fragments: string[] = [];
    while ((match = mentionRegex.exec(normalized)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        fragments.push(this.formatTextFragment(normalized.slice(lastIndex, start), term, false));
      }
      const label = `@${match[1] ?? ''}`;
      fragments.push(this.formatTextFragment(label, term, true));
      lastIndex = start + match[0].length;
    }
    if (lastIndex < normalized.length) {
      fragments.push(this.formatTextFragment(normalized.slice(lastIndex), term, false));
    }
    return this.sanitizer.bypassSecurityTrustHtml(fragments.join(''));
  }

  formatDetailText(value: string, kind?: ActivityKind): SafeHtml {
    if (kind !== 'note') {
      return this.formatRichText(value);
    }
    const raw = this.stripFormatChars(value ?? '');
    if (!raw) return this.sanitizer.bypassSecurityTrustHtml('');
    const mentionRegex = /@[\p{L}\p{N}._-]{1,64}/gu;
    const mentions = raw.match(mentionRegex) ?? [];
    if (mentions.length < 2) {
      return this.formatRichText(raw);
    }
    const term = this.searchTerm.trim();
    const mentionHtml = mentions
      .map(m => this.formatTextFragment(m, term, true))
      .join('<span class=\"mention-sep\">,</span>');
    const rest = raw
      .replace(mentionRegex, '')
      .replace(/^[\s,،.;:•·\-–—.]+/u, '')
      .trim();
    const bodyHtml = rest ? this.formatTextFragment(rest, term, false) : '';
    const html = `<span class=\"mention-line\">${mentionHtml}</span>${bodyHtml ? `<span class=\"mention-body\">${bodyHtml}</span>` : ''}`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private formatTextFragment(value: string, term: string, isMention: boolean): string {
    const escaped = this.escapeHtml(value);
    const highlighted = term ? this.applyHighlight(escaped, term) : escaped;
    if (!isMention) return highlighted;
    return `<span class=\"mention-pill\">${highlighted}</span>`;
  }

  private applyHighlight(escaped: string, term: string): string {
    if (!term) return escaped;
    const regex = new RegExp(this.escapeRegExp(term), 'ig');
    return escaped.replace(regex, match => `<mark class=\"hl\">${match}</mark>`);
  }

  private normalizeMentionRuns(text: string): string {
    if (!text) return '';
    const cleaned = this.stripFormatChars(text);
    const collapsedLeading = this.collapseLeadingMentions(cleaned);
    if (collapsedLeading !== cleaned) {
      return collapsedLeading;
    }
    const runRegex = /(@[\p{L}\p{N}._-]{1,64})(?:\s+@[\p{L}\p{N}._-]{1,64})+/gu;
    const normalized = cleaned.replace(runRegex, run => run.replace(/\s+@/g, ',@'));
    const collapsed = this.collapseMentionLines(normalized);
    const mentionPattern = '@[\\p{L}\\p{N}._-]{1,64}';
    const joinRegex = new RegExp(
      `(${mentionPattern})(?:[\\s,،.;:•·\\-–—.]+)(?=${mentionPattern})`,
      'gu'
    );
    let next = collapsed;
    let prev = '';
    while (next !== prev) {
      prev = next;
      next = next.replace(joinRegex, '$1,');
    }
    return next;
  }

  private collapseMentionLines(text: string): string {
    const lines = text.split(/\r\n?|\n/);
    const output: string[] = [];
    const buffer: string[] = [];
    const mentionTokenRegex = /@[\p{L}\p{N}._-]{1,64}/gu;
    const connectorLineRegex = /^\s*[,،.;:•·\-–—.]*\s*$/u;
    const stripDirMarks = (value: string) => this.stripFormatChars(value);
    for (const line of lines) {
      const cleaned = stripDirMarks(line);
      const stripped = cleaned.replace(/^[\s•·\-–—]+/u, '').trim();
      const mentions = stripped.match(mentionTokenRegex) ?? [];
      if (mentions.length) {
        const remainder = stripped.replace(mentionTokenRegex, '').trim();
        if (!remainder || connectorLineRegex.test(remainder)) {
          buffer.push(...mentions);
          continue;
        }
      } else if (!stripped || connectorLineRegex.test(stripped)) {
        if (buffer.length) {
          continue;
        }
        output.push(line);
        continue;
      }

      if (buffer.length) {
        output.push(buffer.join(','));
        buffer.length = 0;
      }
      output.push(line);
    }
    if (buffer.length) {
      output.push(buffer.join(','));
    }
    return output.join('\n');
  }

  private collapseLeadingMentions(text: string): string {
    const lines = text.split(/\r\n?|\n/);
    const mentionTokenRegex = /@[\p{L}\p{N}._-]{1,64}/gu;
    const connectorRegex = /[\s,،.;:•·\-–—.]+/gu;
    const isConnectorLine = (value: string) =>
      value.replace(connectorRegex, '').trim().length === 0;
    const mentions: string[] = [];
    let i = 0;
    for (; i < lines.length; i += 1) {
      const rawLine = this.stripFormatChars(lines[i] ?? '');
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (mentions.length) {
          continue;
        }
        if (isConnectorLine(rawLine)) {
          continue;
        }
        break;
      }
      const found = rawLine.match(mentionTokenRegex) ?? [];
      if (found.length) {
        const remainder = rawLine.replace(mentionTokenRegex, '').replace(connectorRegex, '').trim();
        if (!remainder) {
          mentions.push(...found);
          continue;
        }
      }
      if (mentions.length && isConnectorLine(rawLine)) {
        continue;
      }
      break;
    }
    if (mentions.length < 2) {
      return text;
    }
    const rest = lines.slice(i).join('\n');
    const restTrimmed = rest.replace(/^[\s,،.;:•·\-–—.]+/u, '');
    return `${mentions.join(',')}${restTrimmed ? `\n${restTrimmed}` : ''}`;
  }

  private stripFormatChars(value: string): string {
    if (!value) return '';
    return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200b]/g, '');
  }

  displayActor(actor: string): string {
    const label = actor?.trim() ?? '';
    if (!label) return '';
    if (label.includes('@')) return label.split('@')[0];
    return label;
  }

  initials(actor: string): string {
    const label = (actor ?? '').trim();
    if (!label) return '';
    const base = label.includes('@') ? label.split('@')[0] : label;
    const parts = base
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  }

  mentionHandle(user: MentionUser): string {
    const base = (user.handle ?? user.email?.split('@')[0] ?? user.name ?? '').trim();
    if (!base) return 'user';
    return base.replace(/\s+/g, '.');
  }

  private stripMentions(value: string): string {
    if (!value) return '';
    return value
      .replace(/@[^\s@]{1,64}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private extractMentions(text: string): { users: MentionUser[]; handles: string[] } {
    const handleSet = new Set<string>();
    const regex = /@([a-zA-Z0-9._-]{1,32})/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const handle = (match[1] ?? '').trim();
      if (handle) {
        handleSet.add(handle);
      }
    }
    const handles = Array.from(handleSet.values());
    if (!handles.length) {
      return { users: [], handles: [] };
    }
    const pool = this.mentionPool.length ? this.mentionPool : this.buildMentionPool();
    const map = new Map<string, MentionUser>();
    for (const user of pool) {
      const handle = this.mentionHandle(user).toLowerCase();
      if (handle) {
        map.set(handle, user);
      }
      if (user.email) {
        map.set(user.email.split('@')[0].toLowerCase(), user);
      }
      const nameKey = (user.name ?? '').trim().toLowerCase().replace(/\s+/g, '.');
      if (nameKey) {
        map.set(nameKey, user);
      }
    }
    const users: MentionUser[] = [];
    const userKeys = new Set<string>();
    for (const handle of handles) {
      const key = handle.toLowerCase();
      const found = map.get(key);
      if (found) {
        const idKey = (found.id ?? found.email ?? found.name ?? '').toString().toLowerCase();
        if (idKey && !userKeys.has(idKey)) {
          userKeys.add(idKey);
          users.push(found);
        }
        continue;
      }
      const fallbackKey = handle.toLowerCase();
      if (!userKeys.has(fallbackKey)) {
        userKeys.add(fallbackKey);
        users.push({ name: handle, handle });
      }
    }
    return { users, handles };
  }

  private mergeMentions(
    selected: MentionUser[],
    extracted: { users: MentionUser[]; handles: string[] }
  ): { users: MentionUser[]; handles: string[] } {
    const handles = new Set<string>();
    const users: MentionUser[] = [];
    const userKeys = new Set<string>();

    const pushUser = (user: MentionUser) => {
      const key = this.mentionKey(user);
      if (!key || userKeys.has(key)) return;
      userKeys.add(key);
      users.push(user);
      handles.add(this.mentionHandle(user));
    };

    selected.forEach(pushUser);
    extracted.users.forEach(pushUser);
    extracted.handles.forEach(handle => {
      if (handle) handles.add(handle);
    });

    return { users, handles: Array.from(handles.values()) };
  }

  private updateMentionState(input: HTMLInputElement) {
    const value = input.value ?? '';
    const cursor = input.selectionStart ?? value.length;
    const upto = value.slice(0, cursor);
    const match = /(^|\s)@([^\s@]{0,32})$/.exec(upto);
    if (!match) {
      this.closeMention();
      return;
    }
    const query = match[2] ?? '';
    this.mentionQuery = query;
    this.mentionRange = { start: cursor - query.length - 1, end: cursor };
    const results = this.filterMentions(query);
    this.mentionFiltered = results;
    this.mentionIndex = 0;
    this.mentionOpen = results.length > 0;
  }

  private filterMentions(query: string): MentionUser[] {
    if (!this.mentionPool.length) return [];
    const q = query.trim().toLowerCase();
    const results = this.mentionPool.filter(user => {
      const name = (user.name ?? '').toLowerCase();
      const email = (user.email ?? '').toLowerCase();
      const handle = (user.handle ?? this.mentionHandle(user)).toLowerCase();
      return !q || name.includes(q) || email.includes(q) || handle.includes(q);
    });
    return results.slice(0, 6);
  }

  private buildMentionPool(): MentionUser[] {
    if (this.mentionUsers?.length) {
      return this.mentionUsers
        .map(user => (typeof user === 'string' ? { name: user } : user))
        .filter(user => Boolean(user?.name || user?.email));
    }
    const map = new Map<string, MentionUser>();
    for (const item of this.activities || []) {
      const actor = item.actor?.trim();
      if (!actor) continue;
      const key = actor.toLowerCase();
      if (map.has(key)) continue;
      if (actor.includes('@')) {
        map.set(key, { name: actor.split('@')[0], email: actor });
      } else {
        map.set(key, { name: actor });
      }
    }
    return Array.from(map.values());
  }

  private closeMention() {
    this.mentionOpen = false;
    this.mentionFiltered = [];
    this.mentionIndex = 0;
    this.mentionQuery = '';
    this.mentionRange = null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
