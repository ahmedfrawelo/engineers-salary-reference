import { environment } from '../../../../../environments/environment';

const isDebugEnabled = environment.enableDebugLogs === true;

export function reportGridError(message: string, ...details: unknown[]): void {
  console.error(message, ...details);
}

export function debugGridWarn(message: string, ...details: unknown[]): void {
  if (isDebugEnabled) {
    console.warn(message, ...details);
  }
}

export function debugGridLog(message: string, ...details: unknown[]): void {
  if (isDebugEnabled) {
    console.log(message, ...details);
  }
}

export function debugGridTable(tabularData: unknown): void {
  if (isDebugEnabled) {
    console.table(tabularData as never);
  }
}

export function debugGridGroup(label: string): void {
  if (isDebugEnabled) {
    console.group(label);
  }
}

export function debugGridGroupEnd(): void {
  if (isDebugEnabled) {
    console.groupEnd();
  }
}
