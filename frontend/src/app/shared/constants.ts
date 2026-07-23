/**
 * ملف الثوابت المشتركة في التطبيق
 * يحتوي على Enums, Constants, و Status Mappings
 */

/**
 * حالات المشاريع (Project Status)
 */
export enum ProjectStatus {
  New = 'New',
  UnderStudy = 'Under Study',
  Pricing = 'Pricing',
  Submitted = 'Submitted',
  Won = 'Won',
  Lost = 'Lost',
  OnHold = 'On Hold',
  InProgress = 'In Progress'
}

/**
 * خريطة الحالات مع الأنماط CSS
 */
export const STATUS_CLASS_MAP: Record<string, { cls: string; txt: string }> = {
  New: { cls: 'st-new', txt: 'New' },
  'Under Study': { cls: 'st-study', txt: 'Under Study' },
  Pricing: { cls: 'st-pricing', txt: 'Pricing' },
  Submitted: { cls: 'st-submitted', txt: 'Submitted' },
  Won: { cls: 'st-won', txt: 'Won' },
  Lost: { cls: 'st-lost', txt: 'Lost' },
  'On Hold': { cls: 'st-hold', txt: 'On Hold' },
  'In Progress': { cls: 'st-pricing', txt: 'In Progress' }
};

/**
 * أنواع DC (Document Control)
 */
export enum DCType {
  IR = 'IR',
  MIR = 'MIR',
  PO = 'PO',
  RFQ = 'RFQ'
}

/**
 * DC Types with Arabic labels
 */
export const DC_TYPES = [
  { value: DCType.IR, labelEn: 'Inspection Request', labelAr: 'طلب معاينة' },
  { value: DCType.MIR, labelEn: 'Material Inspection Report', labelAr: 'تقرير فحص مواد' },
  { value: DCType.PO, labelEn: 'Purchase Order', labelAr: 'أمر شراء' },
  { value: DCType.RFQ, labelEn: 'Request for Quotation', labelAr: 'طلب عرض سعر' }
] as const;

/**
 * أحجام صفحات الجداول (Pagination)
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const;

/**
 * الحجم الافتراضي للصفحة
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * مهلة طلبات HTTP (بالميلي ثانية)
 */
export const HTTP_REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * عدد المحاولات التلقائية للطلبات الفاشلة
 */
export const HTTP_MAX_RETRIES = 2;

/**
 * مفاتيح التخزين المحلي
 */
export const STORAGE_KEYS = {
  AUTH_TOKENS: 'engineers-salary-reference_auth_tokens',
  BROADCAST: 'engineers-salary-reference.broadcast',
  THEME: 'engineers-salary-reference_theme',
  AREA: 'engineers-salary-reference_area',
  AUTH_USER: 'engineers-salary-reference_auth_user'
} as const;

/**
 * الثيمات المتاحة
 */
export enum Theme {
  Light = 'light',
  Dark = 'dark',
  Auto = 'auto'
}

/**
 * المناطق (Areas) المتاحة في النظام
 */
export enum Area {
  InHand = 'in-hand',
  Tender = 'tender',
  Reports = 'reports'
}

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to server. Please check your internet connection',
  UNAUTHORIZED: 'Invalid email or password',
  FORBIDDEN: 'You do not have permission to access this resource',
  NOT_FOUND: 'The requested resource was not found',
  SERVER_ERROR: 'A server error occurred. Please try again later',
  TIMEOUT: 'Request timed out. Please try again',
  VALIDATION_ERROR: 'Please check the validity of the entered data'
} as const;

/**
 * التحقق من صحة البريد الإلكتروني
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * التحقق من صحة رقم الهاتف (السعودية)
 */
export const PHONE_REGEX_SA = /^(009665|9665|\+9665|05|5)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;

/**
 * تنسيق التاريخ الافتراضي
 */
export const DATE_FORMAT = 'dd/MM/yyyy';

/**
 * تنسيق التاريخ والوقت
 */
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

/**
 * العملة الافتراضية
 */
export const DEFAULT_CURRENCY = 'SAR';

/**
 * اللغات المدعومة
 */
export enum Language {
  Arabic = 'ar',
  English = 'en'
}
