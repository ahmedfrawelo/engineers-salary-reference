import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { timer } from 'rxjs';
import { mergeMap, retryWhen } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;

export const SKIP_HTTP_RETRY = new HttpContextToken<boolean>(() => false);

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

function shouldRetry(error: LooseValue, attempt: number, config: RetryConfig): boolean {
  if (attempt >= config.maxRetries) {
    return false;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  if (error.status >= 400 && error.status < 500) {
    return config.retryableStatuses.includes(error.status);
  }
  return error.status === 0 || error.status >= 500;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const config = DEFAULT_CONFIG;
  const skipRetryUrls = ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/ws-ticket'];
  const requestUrl = req.url.toLowerCase();
  if (req.context.get(SKIP_HTTP_RETRY) || skipRetryUrls.some(url => requestUrl.includes(url))) {
    return next(req);
  }

  if (req.method !== 'GET' && !req.headers.has('X-Retry-On-Failure')) {
    return next(req);
  }

  let attempt = 0;

  return next(req).pipe(
    retryWhen(errors =>
      errors.pipe(
        mergeMap(error => {
          attempt++;
          if (!shouldRetry(error, attempt, config)) {
            throw error;
          }
          const delay = calculateDelay(attempt - 1, config);
          if (environment.enableDebugLogs)
            console.warn(
              `⚠️ [Retry] Attempt ${attempt}/${config.maxRetries} for ${req.url}. Retrying in ${delay}ms...`
            );
          return timer(delay);
        })
      )
    )
  );
};

export function markAsRetryable() {
  return { headers: { 'X-Retry-On-Failure': 'true' } };
}
