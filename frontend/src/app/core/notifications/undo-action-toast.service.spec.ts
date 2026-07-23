import { describe, expect, it, vi } from 'vitest';

import { ToastService } from './toast.service';
import { UndoActionToastService } from './undo-action-toast.service';

describe('UndoActionToastService', () => {
  it('shows a success action toast for create and emits the completion toast on undo', () => {
    const toast = new ToastService();
    const service = new UndoActionToastService(toast);
    const onUndo = vi.fn();

    const id = service.created('Company created.', onUndo, {
      completionMessage: 'Company creation undone.'
    });

    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0]).toEqual(
      expect.objectContaining({
        id,
        type: 'success',
        title: 'Created',
        message: 'Company created.',
        actionLabel: 'Undo',
        showProgress: true
      })
    );

    toast.triggerAction(id);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0]).toEqual(
      expect.objectContaining({
        type: 'info',
        message: 'Company creation undone.'
      })
    );
  });

  it('passes onExpire through to the underlying toast action', () => {
    const toast = new ToastService();
    const service = new UndoActionToastService(toast);
    const onExpire = vi.fn();

    const id = service.updated('Changes saved.', vi.fn(), { onExpire, duration: 1000 });

    toast.remove(id, 'expire');

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('uses the updated default title for update undo toasts and allows overrides', () => {
    const toast = new ToastService();
    const service = new UndoActionToastService(toast);

    service.updated('Profile settings were saved.', vi.fn());

    expect(toast.toasts()[0]).toEqual(
      expect.objectContaining({
        type: 'success',
        title: 'Changes saved',
        message: 'Profile settings were saved.'
      })
    );

    toast.clear();

    service.deleted('Task deleted.', vi.fn(), { title: 'Task removed' });

    expect(toast.toasts()[0]).toEqual(
      expect.objectContaining({
        type: 'danger',
        title: 'Task removed',
        message: 'Task deleted.'
      })
    );
  });

  it('uses a 7000ms default duration for undo update toasts', () => {
    const toast = new ToastService();
    const service = new UndoActionToastService(toast);

    service.updated('Profile settings were saved.', vi.fn());

    expect(toast.toasts()[0]).toEqual(
      expect.objectContaining({
        duration: 7000
      })
    );
  });
});
