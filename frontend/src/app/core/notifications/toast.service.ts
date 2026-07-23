import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'danger';
export type ToastTheme = 'auto' | 'light' | 'dark';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
export type ToastCloseButtonPosition = 'top-left' | 'top-right';
type ToastRemovalReason = 'dismiss' | 'expire' | 'action';

export interface ToastViewportConfig {
  closeButtonPosition: ToastCloseButtonPosition;
  closeOnEscape: boolean;
  position: ToastPosition;
  showCloseButton: boolean;
  showProgress: boolean;
  showTimestamp: boolean;
  theme: ToastTheme;
}

export interface ToastActionConfig {
  label: string;
  onClick: () => void;
}

export interface ToastShowOptions {
  action?: ToastActionConfig;
  closeButtonPosition?: ToastCloseButtonPosition;
  closeOnEscape?: boolean;
  coalesce?: boolean;
  description?: string;
  dismissOnClick?: boolean;
  dismissible?: boolean;
  duration?: number;
  onExpire?: () => void;
  showCloseButton?: boolean;
  showProgress?: boolean;
  showTimestamp?: boolean;
  title?: string;
}

const DEFAULT_TOAST_VIEWPORT_CONFIG: ToastViewportConfig = {
  closeButtonPosition: 'top-right',
  closeOnEscape: true,
  position: 'top-right',
  showCloseButton: true,
  showProgress: true,
  showTimestamp: true,
  theme: 'auto'
};

interface ToastRuntimeMeta {
  createdAt: number;
  signature: string;
  normalizedMessage: string;
  operationKey: string | null;
  generic: boolean;
  specificity: number;
}

export interface Toast {
  id: string;
  type: ToastType;
  createdAt: number;
  title?: string;
  message: string;
  duration?: number;
  actionLabel?: string;
  showProgress?: boolean;
  showTimestamp?: boolean;
  dismissible?: boolean;
  dismissOnClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  closeButtonPosition?: ToastCloseButtonPosition;
  onAction?: (() => void) | null;
  onExpire?: (() => void) | null;
}

type ToastCreateOptions = Partial<Toast> & {
  coalesce?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  public readonly toasts = this._toasts.asReadonly();
  private readonly _viewportConfig = signal<ToastViewportConfig>({
    ...DEFAULT_TOAST_VIEWPORT_CONFIG
  });
  readonly viewportConfig = this._viewportConfig.asReadonly();
  private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly runtimeMeta = new Map<string, ToastRuntimeMeta>();

  private readonly defaultDuration = 4000;
  private readonly coalesceWindowMs = 1500;
  private readonly maxVisibleToasts = 5;

  success(messageOrTitle: string, durationOrOptions?: number | ToastShowOptions): string {
    return this.showVariant('success', messageOrTitle, durationOrOptions);
  }

  error(messageOrTitle: string, durationOrOptions?: number | ToastShowOptions): string {
    return this.showVariant('error', messageOrTitle, durationOrOptions);
  }

  warning(messageOrTitle: string, durationOrOptions?: number | ToastShowOptions): string {
    return this.showVariant('warning', messageOrTitle, durationOrOptions);
  }

  danger(messageOrTitle: string, durationOrOptions?: number | ToastShowOptions): string {
    return this.showVariant('danger', messageOrTitle, durationOrOptions);
  }

  info(messageOrTitle: string, durationOrOptions?: number | ToastShowOptions): string {
    return this.showVariant('info', messageOrTitle, durationOrOptions);
  }

  configureViewport(config: Partial<ToastViewportConfig>): void {
    this._viewportConfig.update(current => ({
      ...current,
      ...Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))
    }));
  }

  resetViewportConfig(): void {
    this._viewportConfig.set({ ...DEFAULT_TOAST_VIEWPORT_CONFIG });
  }

  action(
    type: ToastType,
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration = this.defaultDuration,
    onExpire?: () => void,
    options: Pick<
      Toast,
      | 'title'
      | 'showProgress'
      | 'showTimestamp'
      | 'showCloseButton'
      | 'closeOnEscape'
      | 'closeButtonPosition'
    > & { coalesce?: boolean } = {}
  ): string {
    const resolvedTitle = options.title?.trim() || this.resolveActionTitle(type, actionLabel);

    return this.show(type, message, duration, {
      title: resolvedTitle,
      actionLabel,
      onAction,
      onExpire,
      showProgress: options.showProgress ?? true,
      showTimestamp: options.showTimestamp,
      showCloseButton: options.showCloseButton,
      closeOnEscape: options.closeOnEscape,
      closeButtonPosition: options.closeButtonPosition,
      coalesce: options.coalesce,
      dismissible: true,
      dismissOnClick: false
    });
  }

  private showVariant(
    type: ToastType,
    messageOrTitle: string,
    durationOrOptions?: number | ToastShowOptions
  ): string {
    if (typeof durationOrOptions === 'number' || durationOrOptions === undefined) {
      return this.show(type, messageOrTitle, durationOrOptions);
    }

    const options = durationOrOptions;
    const hasDescription = options.description != null;
    const message = hasDescription ? (options.description ?? '') : messageOrTitle;
    const title = hasDescription ? messageOrTitle : options.title;
    const hasAction =
      !!options.action?.label?.trim() && typeof options.action.onClick === 'function';

    return this.show(type, message, options.duration, {
      title,
      actionLabel: hasAction ? options.action?.label.trim() : undefined,
      onAction: hasAction ? options.action?.onClick : null,
      onExpire: options.onExpire,
      showProgress: options.showProgress,
      showTimestamp: options.showTimestamp,
      dismissible: options.dismissible,
      dismissOnClick: options.dismissOnClick ?? (hasAction ? false : undefined),
      closeOnEscape: options.closeOnEscape,
      showCloseButton: options.showCloseButton,
      closeButtonPosition: options.closeButtonPosition,
      coalesce: options.coalesce
    });
  }

  private show(
    type: ToastType,
    message: string,
    duration?: number,
    options: ToastCreateOptions = {}
  ): string {
    const createdAt = Date.now();
    const resolvedTitle = options.title?.trim() || undefined;
    const resolvedMessage = message.trim();
    const duplicateBodyCopy =
      !!resolvedTitle && this.normalizeText(resolvedTitle) === this.normalizeText(resolvedMessage);
    const toast: Toast = {
      id: this.generateId(),
      type,
      createdAt,
      title: resolvedTitle,
      message: duplicateBodyCopy ? '' : resolvedMessage,
      duration: duration !== undefined ? duration : this.defaultDuration,
      actionLabel: options.actionLabel,
      showProgress: options.showProgress,
      showTimestamp: options.showTimestamp,
      dismissible: options.dismissible ?? true,
      dismissOnClick: options.dismissOnClick ?? true,
      closeOnEscape: options.closeOnEscape,
      showCloseButton: options.showCloseButton,
      closeButtonPosition: options.closeButtonPosition,
      onAction: options.onAction ?? null,
      onExpire: options.onExpire ?? null
    };

    const meta = this.buildRuntimeMeta(toast);
    if (options.coalesce !== false) {
      const duplicate = this.findDuplicateToast(meta);
      if (duplicate) {
        this.refresh(duplicate.id, toast.duration);
        return duplicate.id;
      }

      const visibleErrorDuplicate = this.findVisibleErrorDuplicate(toast, meta);
      if (visibleErrorDuplicate) {
        this.refresh(visibleErrorDuplicate.id, toast.duration);
        return visibleErrorDuplicate.id;
      }

      const visibleSessionDuplicate = this.findVisibleSessionDuplicate(toast, meta);
      if (visibleSessionDuplicate) {
        this.refresh(visibleSessionDuplicate.id, toast.duration);
        return visibleSessionDuplicate.id;
      }

      const visibleConflict = this.resolveVisibleConflict(toast, meta);
      if (visibleConflict?.strategy === 'reuse') {
        this.refresh(visibleConflict.toast.id, toast.duration);
        return visibleConflict.toast.id;
      }

      if (visibleConflict?.strategy === 'replace') {
        this.remove(visibleConflict.toast.id);
      }

      const conflict = this.resolveConflict(toast, meta);
      if (conflict?.strategy === 'reuse') {
        this.refresh(conflict.toast.id, toast.duration);
        return conflict.toast.id;
      }

      if (conflict?.strategy === 'replace') {
        this.remove(conflict.toast.id);
      }

      this.removeVisibleGenericErrorsForSessionToast(toast, meta);
    }

    this.enforceVisibleLimit();
    this._toasts.update(toasts => [...toasts, toast]);
    this.runtimeMeta.set(toast.id, meta);

    this.scheduleRemoval(toast.id, toast.duration);

    return toast.id;
  }

  triggerAction(id: string): void {
    const toast = this._toasts().find(t => t.id === id);
    if (!toast?.onAction) {
      return;
    }

    const action = toast.onAction;
    this.remove(id, 'action');
    action();
  }

  remove(id: string, reason: ToastRemovalReason = 'dismiss'): void {
    const toast = this._toasts().find(t => t.id === id);
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }
    this.runtimeMeta.delete(id);

    this._toasts.update(toasts => toasts.filter(t => t.id !== id));

    if (reason === 'expire') {
      toast?.onExpire?.();
    }
  }

  clear(): void {
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeouts.clear();
    this.runtimeMeta.clear();
    this._toasts.set([]);
  }

  private refresh(id: string, duration?: number): void {
    const existing = this._toasts().find(toast => toast.id === id);
    if (!existing) {
      return;
    }

    const nextDuration = duration !== undefined ? duration : existing.duration;
    if (nextDuration !== existing.duration) {
      this._toasts.update(toasts =>
        toasts.map(toast => (toast.id === id ? { ...toast, duration: nextDuration } : toast))
      );
    }

    this.scheduleRemoval(id, nextDuration);
  }

  private scheduleRemoval(id: string, duration?: number): void {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    if (!duration || duration <= 0) {
      return;
    }

    const nextTimeoutId = setTimeout(() => this.remove(id, 'expire'), duration);
    this.timeouts.set(id, nextTimeoutId);
  }

  private buildRuntimeMeta(toast: Toast): ToastRuntimeMeta {
    const normalizedTitle = this.normalizeText(toast.title);
    const normalizedMessage = this.normalizeText(toast.message);
    const normalizedAction = this.normalizeText(toast.actionLabel);

    return {
      createdAt: Date.now(),
      signature: [toast.type, normalizedTitle, normalizedMessage, normalizedAction].join('|'),
      normalizedMessage,
      operationKey: this.extractOperationKey(normalizedMessage),
      generic: this.isGenericToast(toast.type, normalizedMessage),
      specificity: this.computeSpecificity(normalizedMessage, normalizedTitle)
    };
  }

  private findDuplicateToast(meta: ToastRuntimeMeta): Toast | null {
    const now = Date.now();
    for (const toast of this._toasts()) {
      const existingMeta = this.runtimeMeta.get(toast.id);
      if (!existingMeta) {
        continue;
      }

      if (existingMeta.signature !== meta.signature) {
        continue;
      }

      if (now - existingMeta.createdAt > this.coalesceWindowMs) {
        continue;
      }

      return toast;
    }

    return null;
  }

  private findVisibleErrorDuplicate(toast: Toast, meta: ToastRuntimeMeta): Toast | null {
    if (!this.isErrorFamily(toast.type) || toast.actionLabel) {
      return null;
    }

    for (const candidate of this._toasts()) {
      if (!this.isErrorFamily(candidate.type) || candidate.actionLabel) {
        continue;
      }

      const candidateMeta = this.runtimeMeta.get(candidate.id);
      if (!candidateMeta) {
        continue;
      }

      if (candidateMeta.signature === meta.signature) {
        return candidate;
      }
    }

    return null;
  }

  private findVisibleSessionDuplicate(toast: Toast, meta: ToastRuntimeMeta): Toast | null {
    if (!this.isSessionTerminationToast(toast, meta) || toast.actionLabel) {
      return null;
    }

    for (const candidate of this._toasts()) {
      if (candidate.actionLabel) {
        continue;
      }

      const candidateMeta = this.runtimeMeta.get(candidate.id);
      if (!candidateMeta) {
        continue;
      }

      if (this.isSessionTerminationToast(candidate, candidateMeta)) {
        return candidate;
      }
    }

    return null;
  }

  private removeVisibleGenericErrorsForSessionToast(toast: Toast, meta: ToastRuntimeMeta): void {
    if (!this.isSessionTerminationToast(toast, meta)) {
      return;
    }

    const genericErrorIds = this._toasts()
      .filter(candidate => {
        const candidateMeta = this.runtimeMeta.get(candidate.id);
        return (
          !!candidateMeta &&
          this.isErrorFamily(candidate.type) &&
          !candidate.actionLabel &&
          candidateMeta.generic
        );
      })
      .map(candidate => candidate.id);

    for (const id of genericErrorIds) {
      this.remove(id);
    }
  }

  private resolveConflict(
    toast: Toast,
    meta: ToastRuntimeMeta
  ): { strategy: 'reuse' | 'replace'; toast: Toast } | null {
    if (!this.isErrorFamily(toast.type) || toast.actionLabel) {
      return null;
    }

    const now = Date.now();
    const recentErrors = this._toasts()
      .filter(candidate => this.isErrorFamily(candidate.type) && !candidate.actionLabel)
      .map(candidate => ({
        toast: candidate,
        meta: this.runtimeMeta.get(candidate.id)
      }))
      .filter(
        (
          candidate
        ): candidate is {
          toast: Toast;
          meta: ToastRuntimeMeta;
        } => !!candidate.meta && now - candidate.meta.createdAt <= this.coalesceWindowMs
      );

    const specificExisting = recentErrors.find(candidate => !candidate.meta.generic);
    const genericExisting = recentErrors.find(candidate => candidate.meta.generic);

    if (meta.generic && specificExisting) {
      return { strategy: 'reuse', toast: specificExisting.toast };
    }

    if (meta.generic && genericExisting) {
      if (meta.specificity > genericExisting.meta.specificity) {
        return { strategy: 'replace', toast: genericExisting.toast };
      }

      return { strategy: 'reuse', toast: genericExisting.toast };
    }

    if (!meta.generic && genericExisting) {
      return { strategy: 'replace', toast: genericExisting.toast };
    }

    const sameOperation = recentErrors.find(candidate => {
      if (!meta.operationKey || !candidate.meta.operationKey) {
        return false;
      }
      return meta.operationKey === candidate.meta.operationKey;
    });

    if (!sameOperation) {
      return null;
    }

    if (meta.specificity > sameOperation.meta.specificity) {
      return { strategy: 'replace', toast: sameOperation.toast };
    }

    return { strategy: 'reuse', toast: sameOperation.toast };
  }

  private resolveVisibleConflict(
    toast: Toast,
    meta: ToastRuntimeMeta
  ): { strategy: 'reuse' | 'replace'; toast: Toast } | null {
    if (!this.isErrorFamily(toast.type) || toast.actionLabel) {
      return null;
    }

    const visibleErrors = this._toasts()
      .filter(candidate => this.isErrorFamily(candidate.type) && !candidate.actionLabel)
      .map(candidate => ({
        toast: candidate,
        meta: this.runtimeMeta.get(candidate.id)
      }))
      .filter(
        (
          candidate
        ): candidate is {
          toast: Toast;
          meta: ToastRuntimeMeta;
        } => !!candidate.meta
      );

    const visibleSpecific = visibleErrors.find(candidate => !candidate.meta.generic);
    const visibleGeneric = visibleErrors.find(candidate => candidate.meta.generic);

    if (meta.generic && visibleSpecific) {
      return { strategy: 'reuse', toast: visibleSpecific.toast };
    }

    if (!meta.generic && visibleGeneric) {
      return { strategy: 'replace', toast: visibleGeneric.toast };
    }

    return null;
  }

  private isErrorFamily(type: ToastType): boolean {
    return type === 'error' || type === 'danger';
  }

  private isSessionTerminationToast(toast: Toast, meta: ToastRuntimeMeta): boolean {
    const normalizedTitle = this.normalizeText(toast.title);
    const combined = `${normalizedTitle} ${meta.normalizedMessage}`.trim();

    return (
      combined.includes('session expired') ||
      combined.includes('session has expired') ||
      combined.includes('session was ended') ||
      combined.includes('please sign in again') ||
      combined.includes('please login again')
    );
  }

  private normalizeText(value?: string): string {
    return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  }

  private isGenericToast(type: ToastType, normalizedMessage: string): boolean {
    if (!this.isErrorFamily(type)) {
      return false;
    }

    return (
      normalizedMessage === 'server error. please try again later' ||
      normalizedMessage === 'server error. please try again later.' ||
      normalizedMessage === 'failed to save. please try again.' ||
      normalizedMessage === 'failed to delete. please try again.' ||
      normalizedMessage === 'an unexpected error occurred' ||
      normalizedMessage === 'please check your connection and try again' ||
      normalizedMessage.startsWith('unable to connect to server.')
    );
  }

  private extractOperationKey(normalizedMessage: string): string | null {
    if (normalizedMessage.startsWith('failed to save')) return 'save';
    if (normalizedMessage.startsWith('failed to delete')) return 'delete';
    if (normalizedMessage.startsWith('failed to update')) return 'update';
    if (normalizedMessage.startsWith('failed to load')) return 'load';
    if (normalizedMessage.startsWith('unable to connect')) return 'connect';
    if (normalizedMessage.startsWith('server error')) return 'server';
    return null;
  }

  private computeSpecificity(normalizedMessage: string, normalizedTitle: string): number {
    let score = normalizedMessage.length + normalizedTitle.length;
    if (normalizedMessage.includes(':')) {
      score += 12;
    }
    if (!this.isGenericToast('error', normalizedMessage)) {
      score += 40;
    }
    return score;
  }

  private enforceVisibleLimit(): void {
    while (this._toasts().length >= this.maxVisibleToasts) {
      const candidate = this.pickToastForEviction();
      if (!candidate) {
        return;
      }

      this.remove(candidate.id);
    }
  }

  private pickToastForEviction(): Toast | null {
    const toasts = this._toasts();
    if (toasts.length === 0) {
      return null;
    }

    const passiveCandidate = toasts.find(
      toast => !toast.actionLabel && toast.dismissible !== false && !this.isErrorFamily(toast.type)
    );
    if (passiveCandidate) {
      return passiveCandidate;
    }

    const nonActionCandidate = toasts.find(
      toast => !toast.actionLabel && toast.dismissible !== false
    );
    if (nonActionCandidate) {
      return nonActionCandidate;
    }

    return toasts[0] ?? null;
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private resolveActionTitle(type: ToastType, actionLabel: string): string | undefined {
    const normalizedLabel = actionLabel.trim().toLowerCase();

    if (!normalizedLabel) {
      return undefined;
    }

    if (normalizedLabel === 'undo') {
      return type === 'danger' || type === 'error' ? 'Deleted' : 'Updated';
    }

    if (normalizedLabel === 'delete') {
      return 'Confirm delete';
    }

    if (normalizedLabel === 'confirm' || normalizedLabel === 'cancel') {
      return 'Confirm action';
    }

    if (normalizedLabel === 'review') {
      return 'Review required';
    }

    if (normalizedLabel === 'open') {
      return 'Notification';
    }

    if (normalizedLabel === 'reload' || normalizedLabel === 'إعادة التحميل') {
      return 'Update available';
    }

    return undefined;
  }
}
