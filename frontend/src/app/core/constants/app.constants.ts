/**
 * HTTP Status Code Constants
 * Use these instead of magic numbers for better code readability
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  NETWORK_ERROR: 0
} as const;

/**
 * Timing Constants (in milliseconds)
 */
export const TIMING = {
  NOTIFICATION_DURATION: 5000,
  SUCCESS_NOTIFICATION: 3000,
  WARNING_NOTIFICATION: 4000,
  ERROR_NOTIFICATION: 5000,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_TIME: 300,
  THROTTLE_TIME: 1000
} as const;

/**
 * UI Constants
 */
export const UI = {
  MAX_CACHE_ENTRIES: 50,
  DEFAULT_PAGE_SIZE: 25,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  TOAST_Z_INDEX: 10000
} as const;

/**
 * Validation Constants
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_EMAIL_LENGTH: 255,
  MAX_NAME_LENGTH: 100
} as const;
