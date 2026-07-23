import { Injectable } from '@angular/core';

import { ToastService, type ToastType } from './toast.service';

export interface UndoActionToastOptions {
  actionLabel?: string;
  completionMessage?: string;
  completionType?: ToastType;
  completionDuration?: number;
  duration?: number;
  onExpire?: () => void;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class UndoActionToastService {
  private readonly defaultDuration = 7000;
  private readonly defaultCompletionDuration = 2000;

  constructor(private readonly toast: ToastService) {}

  created(message: string, onUndo: () => void, options: UndoActionToastOptions = {}): string {
    return this.present('success', message, onUndo, {
      title: 'Created',
      completionMessage: 'Creation undone.',
      ...options
    });
  }

  updated(message: string, onUndo: () => void, options: UndoActionToastOptions = {}): string {
    return this.present('success', message, onUndo, {
      title: 'Changes saved',
      completionMessage: 'Changes reverted.',
      ...options
    });
  }

  deleted(message: string, onUndo: () => void, options: UndoActionToastOptions = {}): string {
    return this.present('danger', message, onUndo, {
      title: 'Deleted',
      completionMessage: 'Restored.',
      ...options
    });
  }

  private present(
    type: ToastType,
    message: string,
    onUndo: () => void,
    options: UndoActionToastOptions
  ): string {
    return this.toast.action(
      type,
      message,
      options.actionLabel ?? 'Undo',
      () => {
        onUndo();
        if (options.completionMessage) {
          this.showCompletionToast(
            options.completionType ?? 'info',
            options.completionMessage,
            options.completionDuration
          );
        }
      },
      options.duration ?? this.defaultDuration,
      options.onExpire,
      {
        title: options.title
      }
    );
  }

  private showCompletionToast(type: ToastType, message: string, duration?: number): void {
    const ttl = duration ?? this.defaultCompletionDuration;

    switch (type) {
      case 'success':
        this.toast.success(message, ttl);
        break;
      case 'error':
        this.toast.error(message, ttl);
        break;
      case 'warning':
        this.toast.warning(message, ttl);
        break;
      case 'danger':
        this.toast.danger(message, ttl);
        break;
      default:
        this.toast.info(message, ttl);
        break;
    }
  }
}
