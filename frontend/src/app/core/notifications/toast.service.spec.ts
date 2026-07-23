import { describe, afterEach, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dedupes identical toasts instead of stacking them', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Server error. Please try again later', 3000);
    service.error('Server error. Please try again later', 3000);

    expect(service.toasts()).toHaveLength(1);
  });

  it('suppresses a generic error when a more specific one is already visible', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Failed to save: Supplier code already exists.', 3000);
    service.error('Server error. Please try again later', 3000);

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]?.message).toBe('Failed to save: Supplier code already exists.');
  });

  it('replaces a generic error with a more specific follow-up error', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Failed to save. Please try again.', 3000);
    service.error('Failed to save: Validation failed for project title.', 3000);

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]?.message).toBe(
      'Failed to save: Validation failed for project title.'
    );
  });

  it('coalesces back-to-back generic errors into a single toast', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Failed to save. Please try again.', 3000);
    service.error('Server error. Please try again later', 3000);

    expect(service.toasts()).toHaveLength(1);
  });

  it('reuses an identical visible error toast even after the short coalesce window', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Failed to update Owner "100": Owner name is required.', 6000);
    vi.advanceTimersByTime(2500);
    service.error('Failed to update Owner "100": Owner name is required.', 6000);

    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(4000);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(2001);
    expect(service.toasts()).toHaveLength(0);
  });

  it('replaces a still-visible generic error with a later specific one', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('Server error. Please try again later', 6000);
    vi.advanceTimersByTime(2500);
    service.error('Failed to update Owner "100": Owner name is required.', 6000);

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]?.message).toBe(
      'Failed to update Owner "100": Owner name is required.'
    );
  });

  it('reuses a visible session-expired toast instead of stacking repeated auth failures', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.info('Session expired. Please sign in again.', 6000);
    vi.advanceTimersByTime(2500);
    service.info('Your session has expired. Please login again.', 6000);

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]?.message).toBe('Session expired. Please sign in again.');
  });

  it('removes a generic visible error when the session-expired toast is shown', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.error('An unexpected error occurred', 7000);
    service.info('Session expired. Please sign in again.', 6000);

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]?.type).toBe('info');
    expect(service.toasts()[0]?.message).toBe('Session expired. Please sign in again.');
  });

  it('creates action toasts with timestamps, progress, and explicit close support', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    const id = service.action('success', 'Changes saved.', 'Undo', vi.fn(), 2500);
    const [toast] = service.toasts();

    expect(id).toBeTruthy();
    expect(toast).toEqual(
      expect.objectContaining({
        id,
        type: 'success',
        message: 'Changes saved.',
        actionLabel: 'Undo',
        showProgress: true,
        dismissible: true,
        dismissOnClick: false
      })
    );
    expect(typeof toast?.createdAt).toBe('number');
  });

  it('can keep identical action toasts separate when each action is record-specific', () => {
    vi.useFakeTimers();
    const service = new ToastService();
    const first = vi.fn();
    const second = vi.fn();

    service.action('danger', 'Delete this record.', 'Delete', first, 8000, undefined, {
      title: 'Delete record?',
      coalesce: false
    });
    service.action('danger', 'Delete this record.', 'Delete', second, 8000, undefined, {
      title: 'Delete record?',
      coalesce: false
    });

    expect(service.toasts()).toHaveLength(2);

    service.triggerAction(service.toasts()[1]!.id);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('assigns a fallback title to untitled undo action toasts so they can expand with body copy', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.action('danger', 'Notification deleted', 'Undo', vi.fn(), 2500);
    service.action('info', 'Notification archived', 'Undo', vi.fn(), 2500);

    expect(service.toasts()[0]).toEqual(
      expect.objectContaining({
        title: 'Deleted',
        message: 'Notification deleted'
      })
    );
    expect(service.toasts()[1]).toEqual(
      expect.objectContaining({
        title: 'Updated',
        message: 'Notification archived'
      })
    );
  });

  it('updates viewport config without losing unspecified defaults', () => {
    const service = new ToastService();

    service.configureViewport({
      theme: 'light',
      position: 'top-center',
      closeButtonPosition: 'top-left',
      showTimestamp: false
    });

    expect(service.viewportConfig()).toEqual({
      theme: 'light',
      position: 'top-center',
      closeButtonPosition: 'top-left',
      showTimestamp: false,
      showProgress: true,
      closeOnEscape: true,
      showCloseButton: true
    });
  });

  it('allows action toasts to override renderer toggles at toast level', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.action('success', 'Changes saved.', 'Undo', vi.fn(), 2500, undefined, {
      title: 'Saved',
      showProgress: false,
      showTimestamp: false,
      showCloseButton: false,
      closeOnEscape: false,
      closeButtonPosition: 'top-left'
    });

    expect(service.toasts()[0]).toEqual(
      expect.objectContaining({
        title: 'Saved',
        showProgress: false,
        showTimestamp: false,
        showCloseButton: false,
        closeOnEscape: false,
        closeButtonPosition: 'top-left'
      })
    );
  });

  it('supports builder-style title, description, action button, and display duration options', () => {
    vi.useFakeTimers();
    const service = new ToastService();
    const onUndo = vi.fn();

    service.success('Changes saved', {
      description: 'Your changes have been saved and synced successfully.',
      duration: 7000,
      action: {
        label: 'Undo',
        onClick: onUndo
      }
    });

    expect(service.toasts()[0]).toEqual(
      expect.objectContaining({
        type: 'success',
        title: 'Changes saved',
        message: 'Your changes have been saved and synced successfully.',
        duration: 7000,
        actionLabel: 'Undo',
        dismissOnClick: false
      })
    );

    const toastId = service.toasts()[0]!.id;
    service.triggerAction(toastId);

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate body text when the resolved title and message are identical', () => {
    const service = new ToastService();

    service.success('Saved', {
      description: 'Saved'
    });

    expect(service.toasts()[0]).toEqual(
      expect.objectContaining({
        title: 'Saved',
        message: ''
      })
    );
  });

  it('evicts the oldest passive toast when the visible toast limit is exceeded', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.info('Info 1', 8000);
    service.info('Info 2', 8000);
    service.info('Info 3', 8000);
    service.info('Info 4', 8000);
    service.info('Info 5', 8000);
    service.info('Info 6', 8000);

    expect(service.toasts()).toHaveLength(5);
    expect(service.toasts().map(toast => toast.message)).toEqual([
      'Info 2',
      'Info 3',
      'Info 4',
      'Info 5',
      'Info 6'
    ]);
  });

  it('keeps action toasts visible and evicts passive toasts first during toast bursts', () => {
    vi.useFakeTimers();
    const service = new ToastService();

    service.action('success', 'Saved item A.', 'Undo', vi.fn(), 8000);
    service.info('Info 1', 8000);
    service.info('Info 2', 8000);
    service.info('Info 3', 8000);
    service.info('Info 4', 8000);
    service.info('Info 5', 8000);

    expect(service.toasts()).toHaveLength(5);
    expect(service.toasts().some(toast => toast.actionLabel === 'Undo')).toBe(true);
    expect(service.toasts().map(toast => toast.message)).not.toContain('Info 1');
  });
});
