import { HttpErrorResponse } from '@angular/common/http';
import { HTTP_STATUS } from '../constants';

/**
 * Utility class for centralized HTTP error handling and status checks.
 *
 * @description
 * Provides methods to transform HttpErrorResponse into user-friendly messages
 * and categorize error types based on HTTP status codes.
 */
export class HttpErrorUtil {
  /**
   * Translates an HttpErrorResponse into a localized, user-friendly message.
   * @param error - The raw HTTP error response from the backend.
   * @returns A string representing the error in Arabic.
   */
  static getErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case HTTP_STATUS.NETWORK_ERROR:
        return 'لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت.';
      case HTTP_STATUS.BAD_REQUEST:
        return error.error?.message || 'طلب غير صحيح. تحقق من البيانات المدخلة.';
      case HTTP_STATUS.UNAUTHORIZED:
        return 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.';
      case HTTP_STATUS.FORBIDDEN:
        return 'ليس لديك صلاحية للوصول إلى هذا المورد.';
      case HTTP_STATUS.NOT_FOUND:
        return 'المورد المطلوب غير موجود.';
      case HTTP_STATUS.METHOD_NOT_ALLOWED:
        return 'العملية غير مسموحة.';
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        return 'خطأ في الخادم. يرجى المحاولة لاحقاً.';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.';
      default:
        return error.error?.message || `حدث خطأ غير متوقع (${error.status})`;
    }
  }

  /**
   * Determines if the error is a connectivity/network issue.
   * @param error - The HTTP error to check.
   */
  static isNetworkError(error: HttpErrorResponse): boolean {
    return error.status === HTTP_STATUS.NETWORK_ERROR;
  }

  /**
   * Determines if the error is related to authentication or unauthorized access.
   * @param error - The HTTP error to check.
   */
  static isAuthError(error: HttpErrorResponse): boolean {
    return error.status === HTTP_STATUS.UNAUTHORIZED || error.status === HTTP_STATUS.FORBIDDEN;
  }

  /**
   * Determines if the error is a client-side error (4xx range).
   * @param error - The HTTP error to check.
   */
  static isClientError(error: HttpErrorResponse): boolean {
    return error.status >= 400 && error.status < 500;
  }

  /**
   * Determines if the error is a server-side error (5xx range).
   * @param error - The HTTP error to check.
   */
  static isServerError(error: HttpErrorResponse): boolean {
    return error.status >= 500 && error.status < 600;
  }
}
