import { environment } from './environments/environment';
import { ensureAngularVitestEnv } from './testing/angular-vitest-env';
import { TransformStream as NodeTransformStream } from 'node:stream/web';

environment.enableDebugLogs = false;
ensureAngularVitestEnv();

if (typeof globalThis.TransformStream === 'undefined') {
  (
    globalThis as typeof globalThis & {
      TransformStream?: typeof globalThis.TransformStream;
    }
  ).TransformStream = NodeTransformStream as unknown as typeof globalThis.TransformStream;
}

const suppressedPhrases = [
  'Could not parse CSS stylesheet',
  "Not implemented: HTMLCanvasElement's getContext",
  'Not implemented: HTMLCanvasElement.getContext',
  "HTMLCanvasElement's getContext() method: without installing the canvas npm package",
  "Not implemented: Window's focus() method"
];
const suppressedLogPhrases = ['[DataGrid]'];

const shouldSuppress = (args: unknown[]): boolean =>
  args.some(
    arg => typeof arg === 'string' && suppressedPhrases.some(phrase => arg.includes(phrase))
  );
const shouldSuppressLog = (args: unknown[]): boolean =>
  args.some(
    arg => typeof arg === 'string' && suppressedLogPhrases.some(phrase => arg.includes(phrase))
  );

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

console.log = (...args: unknown[]) => {
  if (shouldSuppressLog(args)) return;
  originalLog(...args);
};

console.error = (...args: unknown[]) => {
  if (shouldSuppress(args)) return;
  originalError(...args);
};

console.warn = (...args: unknown[]) => {
  if (shouldSuppress(args)) return;
  originalWarn(...args);
};

if (typeof HTMLCanvasElement !== 'undefined') {
  const canvas2dContextStub: Partial<CanvasRenderingContext2D> = {
    canvas: globalThis.document?.createElement?.('canvas') as HTMLCanvasElement,
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    drawImage: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text?: string) => ({ width: (text ?? '').length * 6 }) as TextMetrics,
    createLinearGradient: () =>
      ({
        addColorStop: () => {}
      }) as CanvasGradient
  };

  HTMLCanvasElement.prototype.getContext = ((contextId: string): RenderingContext | null => {
    if (contextId === '2d') {
      return canvas2dContextStub as CanvasRenderingContext2D;
    }
    return null;
  }) as HTMLCanvasElement['getContext'];
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'focus', {
    configurable: true,
    value: () => {}
  });
}

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
  const text = typeof chunk === 'string' ? chunk : (chunk?.toString?.() ?? '');
  if (text && suppressedPhrases.some(phrase => text.includes(phrase))) {
    return true;
  }
  return (originalStderrWrite as (...writeArgs: unknown[]) => boolean)(chunk, ...args);
}) as typeof process.stderr.write;
