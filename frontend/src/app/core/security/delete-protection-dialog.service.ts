import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { runtimeConfig } from '../runtime-config';

export type DeleteProtectionDialogRequest = Readonly<{
  title: string;
  subtitle: string;
  message: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  requiredMessage: string;
  invalidMessage: string;
}>;

export type DeleteProtectionConfig = Readonly<{
  enabled: boolean;
  headerName: string;
  promptMessage: string;
}>;

@Injectable({ providedIn: 'root' })
export class DeleteProtectionDialogService {
  readonly activeRequest = signal<DeleteProtectionDialogRequest | null>(null);

  private readonly deleteCodeHeader = 'X-Delete-Code';
  private readonly deletePromptMessage =
    'This action permanently deletes data. Enter the authorized delete code to continue.';
  private forceEnabledForCurrentSession = false;
  private authorizedCode: string | null = null;
  private authorizedUsesRemaining = 0;
  private resolver: ((value: string | null) => void) | null = null;

  requestCode(request: DeleteProtectionDialogRequest): Promise<string | null> {
    this.finish(null);

    return new Promise(resolve => {
      this.resolver = resolve;
      this.activeRequest.set(request);
    });
  }

  submit(code: string): void {
    this.finish(code);
  }

  cancel(): void {
    this.finish(null);
  }

  resolveConfig(): DeleteProtectionConfig {
    const runtimeDeleteProtection = runtimeConfig().deleteProtection;
    const envDeleteProtection = environment.security?.deleteProtection;
    const enabled =
      this.forceEnabledForCurrentSession ||
      (typeof runtimeDeleteProtection?.enabled === 'boolean'
        ? runtimeDeleteProtection.enabled
        : !!envDeleteProtection?.enabled);
    const headerName = String(
      runtimeDeleteProtection?.headerName ??
        envDeleteProtection?.headerName ??
        this.deleteCodeHeader
    ).trim();
    const promptMessage = String(
      runtimeDeleteProtection?.promptMessage ??
        envDeleteProtection?.promptMessage ??
        this.deletePromptMessage
    ).trim();

    return {
      enabled,
      headerName: headerName || this.deleteCodeHeader,
      promptMessage: promptMessage || this.deletePromptMessage
    };
  }

  isEnabled(): boolean {
    return this.resolveConfig().enabled;
  }

  forceEnableForSession(): void {
    this.forceEnabledForCurrentSession = true;
  }

  isCodeAccepted(code: string): boolean {
    const trimmed = code.trim();
    if (!this.isEnabled()) {
      return true;
    }
    return trimmed.length > 0;
  }

  authorizeNextDelete(code: string, uses = 1): void {
    const trimmed = code.trim();
    if (!trimmed) {
      this.clearAuthorizedCode();
      return;
    }

    this.authorizedCode = trimmed;
    this.authorizedUsesRemaining = Math.max(uses, 1);
  }

  consumeAuthorizedCode(): string | null {
    if (!this.authorizedCode || this.authorizedUsesRemaining <= 0) {
      this.clearAuthorizedCode();
      return null;
    }

    const code = this.authorizedCode;
    this.authorizedUsesRemaining -= 1;
    if (this.authorizedUsesRemaining <= 0) {
      this.clearAuthorizedCode();
    }
    return code;
  }

  clearAuthorizedCode(): void {
    this.authorizedCode = null;
    this.authorizedUsesRemaining = 0;
  }

  private finish(value: string | null): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.activeRequest.set(null);
    resolve?.(value);
  }
}
