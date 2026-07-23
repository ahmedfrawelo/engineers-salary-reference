import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';

import {
  OverlayModule,
  ConnectedPosition,
  ConnectedOverlayPositionChange,
  CdkOverlayOrigin
} from '@angular/cdk/overlay';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

type CalendarDay = {
  date: Date;
  iso: string;
  label: number;
  current: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
};

type DateInputDisplayFormat = 'long' | 'iso' | 'dmy';

@Component({
  selector: 'date-input',
  standalone: true,
  imports: [OverlayModule, AppIconDirective],
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateInputComponent implements OnChanges, OnDestroy {
  @Input() value: string | null | undefined = '';
  @Input() disabled = false;
  @Input() min?: string;
  @Input() max?: string;
  @Input() placeholder = 'YYYY-MM-DD';
  @Input() allowClear = true;
  @Input() showToday = true;
  @Input() displayFormat: DateInputDisplayFormat = 'long';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('triggerOrigin', { read: CdkOverlayOrigin }) triggerOrigin?: CdkOverlayOrigin;
  @ViewChild('yearsScroller') yearsScroller?: ElementRef<HTMLDivElement>;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  open = false;
  dropUp = false;
  overlayWidth = 260;
  viewYear = 0;
  viewMonth = 0;
  viewMode: 'days' | 'monthYear' = 'days';
  private readonly yearRangeSpan = 400;
  days: CalendarDay[] = [];
  readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
  ];
  selectedIso = '';
  private readonly displayFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  });
  private readonly monthShortFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
  readonly monthLabels = Array.from({ length: 12 }, (_, i) =>
    this.monthShortFormatter.format(new Date(2020, i, 1)).toUpperCase()
  );
  private openDomListenersAttached = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.handleDocumentInteraction(event);
  private readonly documentClickHandler = (event: MouseEvent) =>
    this.handleDocumentInteraction(event);
  private readonly documentEscapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.close();
    }
  };

  ngOnChanges(_: SimpleChanges) {
    if (this.disabled && this.open) {
      this.close();
    }
    this.syncFromValue();
  }

  private handleDocumentInteraction(event: Event) {
    if (!this.open) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const insideHost = this.host.nativeElement.contains(target);
    const insideOverlay = !!target.closest('.date-input-overlay');
    if (!insideHost && !insideOverlay) {
      this.close();
    }
  }

  toggle(event?: Event) {
    if (this.disabled) return;
    this.open ? this.close() : this.openPanel();
  }

  openPanel() {
    if (this.disabled) return;
    this.refreshOverlayWidth();
    this.open = true;
    this.attachOpenDomListeners();
    this.viewMode = 'days';
    if (!this.viewYear) this.setViewFromSelectedOrToday();
    this.buildDays();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.detachOpenDomListeners();
    this.cdr.markForCheck();
  }

  onPositionChange(ev: ConnectedOverlayPositionChange) {
    this.dropUp = ev.connectionPair.overlayY === 'bottom';
  }

  setViewMode(mode: 'days' | 'monthYear') {
    this.viewMode = mode;
    if (mode === 'monthYear') {
      setTimeout(() => this.scrollYearIntoView(), 0);
    }
  }

  toggleViewMode() {
    this.setViewMode(this.viewMode === 'days' ? 'monthYear' : 'days');
  }

  prevMonth() {
    if (this.viewMode === 'days') this.shiftMonth(-1);
  }
  nextMonth() {
    if (this.viewMode === 'days') this.shiftMonth(1);
  }

  selectDay(day: CalendarDay) {
    if (day.disabled) return;
    this.applyValue(day.iso, day.date);
  }

  selectMonth(monthIndex: number) {
    if (this.isMonthDisabled(monthIndex)) return;
    this.viewMonth = monthIndex;
    this.buildDays();
  }

  selectYear(year: number) {
    if (this.isYearDisabled(year)) return;
    this.viewYear = year;
    this.buildDays();
    this.scrollYearIntoView();
  }

  selectToday() {
    if (!this.showToday) return;
    const today = new Date();
    if (this.isOutOfRange(today)) return;
    const iso = this.toIso(today);
    this.applyValue(iso, today);
  }

  clear() {
    if (!this.allowClear) return;
    this.value = '';
    this.selectedIso = '';
    this.valueChange.emit('');
    this.buildDays();
    this.close();
  }

  get displayValue(): string {
    const iso = this.normalizeDate(this.value);
    if (!iso) return '';
    if (this.displayFormat === 'iso') return iso;
    if (this.displayFormat === 'dmy') {
      const [year, month, day] = iso.split('-');
      return `${day}-${month}-${year}`;
    }
    const date = this.parseDate(iso);
    if (!date) return iso;
    return this.displayFormatter.format(date);
  }

  get monthLabel(): string {
    return this.monthFormatter.format(new Date(this.viewYear, this.viewMonth, 1));
  }

  get yearOptions(): number[] {
    const { minYear, maxYear } = this.getYearRange();
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
  }

  isMonthSelected(monthIndex: number): boolean {
    const selected = this.parseDate(this.selectedIso);
    if (selected) {
      return selected.getFullYear() === this.viewYear && selected.getMonth() === monthIndex;
    }
    return this.viewMonth === monthIndex;
  }

  isMonthToday(monthIndex: number): boolean {
    const today = new Date();
    return today.getFullYear() === this.viewYear && today.getMonth() === monthIndex;
  }

  isMonthDisabled(monthIndex: number): boolean {
    const min = this.parseDate(this.min);
    const max = this.parseDate(this.max);
    if (min && this.viewYear === min.getFullYear() && monthIndex < min.getMonth()) return true;
    if (max && this.viewYear === max.getFullYear() && monthIndex > max.getMonth()) return true;
    return false;
  }

  isYearSelected(year: number): boolean {
    const selected = this.parseDate(this.selectedIso);
    if (selected) return selected.getFullYear() === year;
    return this.viewYear === year;
  }

  isYearToday(year: number): boolean {
    return new Date().getFullYear() === year;
  }

  isYearDisabled(year: number): boolean {
    const min = this.parseDate(this.min);
    const max = this.parseDate(this.max);
    if (min && year < min.getFullYear()) return true;
    if (max && year > max.getFullYear()) return true;
    return false;
  }

  trackDay(_: number, day: CalendarDay) {
    return day.iso;
  }
  trackYear(_: number, year: number) {
    return year;
  }
  trackMonth(_: number, label: string) {
    return label;
  }

  ngOnDestroy(): void {
    this.detachOpenDomListeners();
  }

  private applyValue(iso: string, date: Date) {
    this.value = iso;
    this.selectedIso = iso;
    this.setViewFromDate(date);
    this.valueChange.emit(iso);
    this.buildDays();
    this.close();
  }

  private shiftMonth(delta: number) {
    const next = new Date(this.viewYear, this.viewMonth + delta, 1);
    this.viewYear = next.getFullYear();
    this.viewMonth = next.getMonth();
    this.buildDays();
  }

  private syncFromValue() {
    this.selectedIso = this.normalizeDate(this.value);
    this.setViewFromSelectedOrToday();
    this.buildDays();
  }

  private setViewFromSelectedOrToday() {
    const base = this.parseDate(this.selectedIso) ?? new Date();
    this.viewYear = base.getFullYear();
    this.viewMonth = base.getMonth();
  }

  private setViewFromDate(date: Date) {
    this.viewYear = date.getFullYear();
    this.viewMonth = date.getMonth();
  }

  private getYearRange(): { minYear: number; maxYear: number } {
    const minYearRaw = this.parseDate(this.min)?.getFullYear();
    const maxYearRaw = this.parseDate(this.max)?.getFullYear();
    if (minYearRaw != null && maxYearRaw != null) {
      const minYear = Math.min(minYearRaw, maxYearRaw);
      const maxYear = Math.max(minYearRaw, maxYearRaw);
      return { minYear, maxYear };
    }

    const baseYear = (this.parseDate(this.selectedIso) ?? new Date()).getFullYear();
    const span = this.yearRangeSpan;
    if (minYearRaw != null) {
      return { minYear: minYearRaw, maxYear: minYearRaw + span };
    }
    if (maxYearRaw != null) {
      return { minYear: maxYearRaw - span, maxYear: maxYearRaw };
    }
    const half = Math.floor(span / 2);
    return { minYear: baseYear - half, maxYear: baseYear + half };
  }

  private scrollYearIntoView() {
    const scroller = this.yearsScroller?.nativeElement;
    if (!scroller) return;
    const selected = scroller.querySelector<HTMLElement>('.roller-item.selected');
    if (!selected) return;
    const nextTop =
      selected.offsetTop -
      Math.round(scroller.clientHeight / 2) +
      Math.round(selected.clientHeight / 2);
    scroller.scrollTop = Math.max(0, nextTop);
  }

  private buildDays() {
    if (!this.viewYear && !this.viewMonth) return;
    const first = new Date(this.viewYear, this.viewMonth, 1);
    const startWeekday = first.getDay();
    const start = new Date(this.viewYear, this.viewMonth, 1 - startWeekday);
    const minNum = this.toNumOrNull(this.min);
    const maxNum = this.toNumOrNull(this.max);
    const todayIso = this.toIso(new Date());
    const selectedIso = this.selectedIso;

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const iso = this.toIso(date);
      const current = date.getMonth() === this.viewMonth;
      const selected = !!selectedIso && iso === selectedIso;
      const today = iso === todayIso;
      const num = this.toNum(date);
      const disabled = (minNum !== null && num < minNum) || (maxNum !== null && num > maxNum);
      days.push({
        date,
        iso,
        label: date.getDate(),
        current,
        today,
        selected,
        disabled
      });
    }
    this.days = days;
  }

  private isOutOfRange(date: Date): boolean {
    const minNum = this.toNumOrNull(this.min);
    const maxNum = this.toNumOrNull(this.max);
    const num = this.toNum(date);
    if (minNum !== null && num < minNum) return true;
    if (maxNum !== null && num > maxNum) return true;
    return false;
  }

  private toNum(date: Date): number {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

  private toNumOrNull(value: string | null | undefined): number | null {
    const parsed = this.parseDate(value);
    return parsed ? this.toNum(parsed) : null;
  }

  private normalizeDate(value: string | null | undefined): string {
    if (!value) return '';
    const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  private parseDate(value: string | null | undefined): Date | null {
    const iso = this.normalizeDate(value);
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(v => Number(v));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private attachOpenDomListeners(): void {
    if (this.openDomListenersAttached || typeof document === 'undefined') return;
    this.openDomListenersAttached = true;
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.documentEscapeHandler);
  }

  private detachOpenDomListeners(): void {
    if (!this.openDomListenersAttached || typeof document === 'undefined') return;
    this.openDomListenersAttached = false;
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.removeEventListener('click', this.documentClickHandler);
    document.removeEventListener('keydown', this.documentEscapeHandler);
  }

  private refreshOverlayWidth(): void {
    this.overlayWidth = this.triggerOrigin?.elementRef.nativeElement.offsetWidth || 260;
  }
}
