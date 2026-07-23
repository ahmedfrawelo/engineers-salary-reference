import type { Observable } from 'rxjs';

export type SignalCell<T> = {
  (): T;
  set(value: T): void;
};

export type ApiLike = {
  put(path: string, body: unknown): Observable<unknown>;
  post(path: string, body: unknown): Observable<unknown>;
  delete(path: string): Observable<unknown>;
};

export type ToastLike = {
  success(message: string, duration?: number): void;
  error(message: string, duration?: number): void;
  warning(message: string, duration?: number): void;
  info(message: string, duration?: number): void;
};

type UndoActionToastOptions = {
  actionLabel?: string;
  completionMessage?: string;
  completionType?: 'success' | 'error' | 'warning' | 'danger' | 'info';
  completionDuration?: number;
  duration?: number;
  onExpire?: () => void;
};

export type UndoToastLike = {
  created(message: string, onUndo: () => void, options?: UndoActionToastOptions): string;
  updated(message: string, onUndo: () => void, options?: UndoActionToastOptions): string;
  deleted(message: string, onUndo: () => void, options?: UndoActionToastOptions): string;
};

export type EditableProfile = {
  name: string;
  email: string;
  password: string;
  status: string;
  role: string;
  department?: string;
  position?: string;
  phoneNumber?: string;
};
