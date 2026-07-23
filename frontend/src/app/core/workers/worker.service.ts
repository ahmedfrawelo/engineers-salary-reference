import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Web Worker Service
 *
 * Manages Web Workers for heavy computations
 *
 * @example
 * ```typescript
 * this.workerService.execute('CALCULATE_SUM', numbers).subscribe(result => {
 *   console.log('Sum:', result);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class WorkerService {
  private worker?: Worker;
  private messageHandlers = new Map<string, Subject<LooseValue>>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.initWorker();
    }
  }

  /**
   * Execute task in Web Worker
   */
  execute<T = LooseValue>(type: string, payload?: LooseValue): Observable<T> {
    if (!this.worker) {
      throw new Error('Web Workers not supported in this browser');
    }

    const subject = new Subject<T>();
    this.messageHandlers.set(type, subject);

    this.worker.postMessage({ type, payload });

    return subject.asObservable();
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
  }

  private initWorker(): void {
    this.worker = new Worker(new URL('./data-processor.worker', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = ({ data }) => {
      const { type, result, error } = data;

      if (error) {
        console.error('[Worker] Error:', error);
        return;
      }

      // Find corresponding handler
      const resultType = type.replace('_RESULT', '');
      const handler = this.messageHandlers.get(resultType);

      if (handler) {
        handler.next(result);
        handler.complete();
        this.messageHandlers.delete(resultType);
      }
    };

    this.worker.onerror = error => {
      console.error('[Worker] Error:', error);
    };
  }

  ngOnDestroy(): void {
    this.terminate();
  }
}
