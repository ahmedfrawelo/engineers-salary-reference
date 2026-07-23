import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from './toast.service';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent]
    }).compileComponents();

    toastService = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-theme');
    toastService?.resetViewportConfig();
    toastService?.clear();
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders standard toasts with a timestamp and dismisses them on body click', () => {
    vi.useFakeTimers();

    toastService.success('Saved successfully.', 3000);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toast = host.querySelector('.toast') as HTMLElement | null;
    const title = host.querySelector('.toast-title');
    const message = host.querySelector('.toast-message');

    expect(toast).not.toBeNull();
    expect(title?.textContent).toContain('Saved successfully.');
    expect(message).toBeNull();

    vi.advanceTimersByTime(760);
    fixture.detectChanges();

    expect(toast?.classList.contains('toast-body-visible')).toBe(false);

    vi.advanceTimersByTime(520);
    fixture.detectChanges();

    const timestamp = host.querySelector('.toast-timestamp');
    expect(toast?.classList.contains('toast-body-visible')).toBe(true);
    expect(timestamp?.textContent?.trim().length).toBeGreaterThan(0);

    toast?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(toastService.toasts()).toHaveLength(0);
  });

  it('renders titled action toasts with separate body text and does not dismiss on card click', () => {
    const onAction = vi.fn();

    toastService.action(
      'success',
      'Your changes have been saved and synced successfully.',
      'Undo',
      onAction,
      2500,
      undefined,
      {
        title: 'Changes saved'
      }
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toast = host.querySelector('.toast') as HTMLElement | null;
    const title = host.querySelector('.toast-title');
    const message = host.querySelector('.toast-message');
    const actionButton = host.querySelector('.toast-action');
    const closeButton = host.querySelector('.toast-close');

    expect(title?.textContent).toContain('Changes saved');
    expect(message?.textContent).toContain('Your changes have been saved and synced successfully.');
    expect(actionButton?.textContent).toContain('Undo');
    expect(closeButton).not.toBeNull();

    toast?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(toastService.toasts()).toHaveLength(1);

    actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastService.toasts()).toHaveLength(0);
  });

  it('reveals the action toast body after the initial pill-only phase', () => {
    vi.useFakeTimers();

    toastService.action(
      'success',
      'Your changes have been saved and synced successfully.',
      'Undo',
      vi.fn(),
      2500,
      undefined,
      {
        title: 'Changes saved'
      }
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toast = host.querySelector('.toast') as HTMLElement | null;
    const message = host.querySelector('.toast-message') as HTMLElement | null;

    expect(message).not.toBeNull();
    expect(toast?.classList.contains('toast-body-visible')).toBe(false);
    expect(toast?.style.getPropertyValue('--toast-body-opacity')).toBe('0');

    vi.advanceTimersByTime(760);
    fixture.detectChanges();

    expect(toast?.classList.contains('toast-body-visible')).toBe(false);
    expect(toast?.style.getPropertyValue('--toast-body-opacity')).toBe('0');

    vi.advanceTimersByTime(520);
    fixture.detectChanges();

    const updatedToast = host.querySelector('.toast') as HTMLElement | null;
    const updatedMessage = host.querySelector('.toast-message') as HTMLElement | null;

    expect(updatedToast?.classList.contains('toast-body-visible')).toBe(true);
    expect(updatedMessage).not.toBeNull();
    expect(
      Number(updatedToast?.style.getPropertyValue('--toast-body-opacity') ?? '0')
    ).toBeGreaterThan(0);
  });

  it('keeps expandable toasts in the pill frame before morph begins, then enables the expanded frame', () => {
    vi.useFakeTimers();

    toastService.success('Changes saved', {
      description: 'Your changes have been saved and synced successfully.',
      duration: 7000,
      action: {
        label: 'Undo',
        onClick: vi.fn()
      }
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const initialContent = host.querySelector('.toast-content') as HTMLElement | null;

    expect(initialContent?.classList.contains('toast-content-expanded')).toBe(false);

    vi.advanceTimersByTime(760);
    fixture.detectChanges();

    const pillFrameContent = host.querySelector('.toast-content') as HTMLElement | null;

    expect(pillFrameContent?.classList.contains('toast-content-expanded')).toBe(false);

    vi.advanceTimersByTime(140);
    fixture.detectChanges();

    const expandedContent = host.querySelector('.toast-content') as HTMLElement | null;

    expect(expandedContent?.classList.contains('toast-content-expanded')).toBe(true);
  });

  it('anchors expandable toast content to the right and uses a right-sided clip reveal', () => {
    toastService.action(
      'success',
      'Your changes have been saved and synced successfully.',
      'Undo',
      vi.fn(),
      2500,
      undefined,
      {
        title: 'Changes saved'
      }
    );
    fixture.detectChanges();

    const toast = toastService.toasts()[0];
    const component = fixture.componentInstance as unknown as {
      expansionProgress: { set: (value: Record<string, number>) => void };
      toastMeasures: {
        set: (
          value: Record<string, { pillWidth: number; bodyWidth: number; bodyHeight: number }>
        ) => void;
      };
    };

    component.toastMeasures.set({
      [toast.id]: {
        bodyHeight: 118,
        bodyWidth: 360,
        pillWidth: 106
      }
    });
    component.expansionProgress.set({
      [toast.id]: 0.25
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const content = host.querySelector('.toast-content') as HTMLElement | null;
    const layout = fixture.componentInstance.getBlobLayout(toast);

    expect(content?.classList.contains('toast-content-right')).toBe(true);
    expect(layout.width).toBeCloseTo(169.5);
    expect(layout.clipInset).toBeCloseTo(190.5);
    expect(fixture.componentInstance.getContentClipPath(toast)).toBe('inset(0 0 0 190.5px)');
  });

  it('allows explicit close on action toasts without triggering the undo callback', () => {
    const onAction = vi.fn();

    toastService.action('danger', 'Task deleted.', 'Undo', onAction, 2500);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const closeButton = host.querySelector('.toast-close');

    closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(onAction).not.toHaveBeenCalled();
    expect(toastService.toasts()).toHaveLength(0);
  });

  it('renders builder-style title, description, action button, and duration inputs', () => {
    const onUndo = vi.fn();

    toastService.success('Changes saved', {
      description: 'Your changes have been saved and synced successfully.',
      duration: 7000,
      action: {
        label: 'Undo',
        onClick: onUndo
      }
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const title = host.querySelector('.toast-title');
    const message = host.querySelector('.toast-message');
    const actionButton = host.querySelector('.toast-action');
    const progressBar = host.querySelector('.toast-progress-bar') as HTMLElement | null;

    expect(title?.textContent).toContain('Changes saved');
    expect(message?.textContent).toContain('Your changes have been saved and synced successfully.');
    expect(actionButton?.textContent).toContain('Undo');
    expect(progressBar?.style.animationDuration).toBe('7000ms');

    actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('uses a title-aware fallback pill width before the first measurement frame', () => {
    toastService.success('Changes saved', {
      description: 'Your changes have been saved and synced successfully.',
      duration: 7000,
      action: {
        label: 'Undo',
        onClick: vi.fn()
      }
    });
    fixture.detectChanges();

    const toast = toastService.toasts()[0];
    const layout = fixture.componentInstance.getBlobLayout(toast);

    expect(layout.width).toBeGreaterThan(106);
  });

  it('binds toast theme to the app light theme when the renderer theme is auto', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    await Promise.resolve();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector('.toast-container');

    expect(container?.getAttribute('data-theme')).toBe('light');
  });

  it('respects renderer toggles for timestamp, progress, close button, and position', () => {
    toastService.configureViewport({
      theme: 'light',
      position: 'top-center',
      closeButtonPosition: 'top-left',
      showTimestamp: false,
      showProgress: false,
      showCloseButton: true,
      closeOnEscape: false
    });

    toastService.action(
      'success',
      'Your changes have been saved and synced successfully.',
      'Undo',
      vi.fn(),
      2500,
      undefined,
      {
        title: 'Changes saved'
      }
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector('.toast-container');
    const closeButton = host.querySelector('.toast-close');
    const progress = host.querySelector('.toast-progress');
    const timestamp = host.querySelector('.toast-timestamp');

    expect(container?.getAttribute('data-theme')).toBe('light');
    expect(container?.getAttribute('data-position')).toBe('top-center');
    expect(closeButton?.classList.contains('toast-close-left')).toBe(true);
    expect(progress).toBeNull();
    expect(timestamp).toBeNull();

    fixture.componentInstance.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(toastService.toasts()).toHaveLength(1);
  });
});
