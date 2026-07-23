import type { jsPDF } from 'jspdf';

export type XlsxCell = { t?: string; v?: unknown; s?: Record<string, unknown> };
export type XlsxWorksheet = Record<string, unknown> & {
  '!merges'?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  '!cols'?: Array<{ wch: number }>;
};
export type XlsxWorkbook = {
  Props?: {
    Title?: string;
    Subject?: string;
    Author?: string;
    CreatedDate?: Date;
  };
};
export type XlsxModuleLike = {
  utils: {
    aoa_to_sheet: (rows: unknown[][]) => XlsxWorksheet;
    encode_cell: (coords: { r: number; c: number }) => string;
    book_new: () => XlsxWorkbook;
    book_append_sheet: (workbook: XlsxWorkbook, worksheet: XlsxWorksheet, name: string) => void;
  };
  writeFile: (workbook: XlsxWorkbook, filename: string) => void;
};
export type PdfDocumentLike = jsPDF & {
  processArabic?: (text: string) => string;
  setLanguage?: (lang: string) => void;
};
export type JsPdfConstructor = new (options: {
  orientation: 'portrait' | 'landscape';
  unit: 'mm';
  format: 'a4';
}) => PdfDocumentLike;
export type AutoTableRenderer = (doc: PdfDocumentLike, options: Record<string, unknown>) => void;
export type AutoTableHookData = { pageNumber?: number };

export type PdfPalette = {
  brand: [number, number, number];
  text: [number, number, number];
  muted: [number, number, number];
  line: [number, number, number];
  zebra: [number, number, number];
};

export type PdfHeaderLayout = {
  barHeight: number;
  titleY: number;
  subtitleY: number;
  metaY: number;
  dividerY: number;
  tableStartY: number;
};

export type PdfHeaderContext = {
  layout: PdfHeaderLayout;
  title: string;
  subtitle?: string;
  appName: string;
  footerText: string;
  leftMeta: string;
  rightMetaLines: string[];
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export const containsArabic = (text: string): boolean =>
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

export const toPdfText = (doc: PdfDocumentLike, value: unknown, processArabic: boolean): string => {
  const text = String(value ?? '');
  if (processArabic && text && containsArabic(text) && typeof doc.processArabic === 'function') {
    return doc.processArabic(text);
  }
  return text;
};

export const resolveAutoTablePageNumber = (data: unknown): number => {
  if (!data || typeof data !== 'object') {
    return 1;
  }
  const pageNumber = (data as AutoTableHookData).pageNumber;
  return typeof pageNumber === 'number' && Number.isFinite(pageNumber) ? pageNumber : 1;
};

export const resolveAssetUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (typeof document === 'undefined') {
    return path;
  }

  try {
    return new URL(path, document.baseURI || window.location.origin + '/').toString();
  } catch {
    return path;
  }
};

export const buildExportFileName = (
  baseName: string,
  extension: string,
  generatedAt: Date
): string => {
  const cleanBase = (baseName?.trim() || 'export').replace(/\.(pdf|xlsx|xls|csv)$/i, '');
  const safeBase = cleanBase
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const cleanExt = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${safeBase || 'export'}_${formatTimestamp(generatedAt)}.${cleanExt}`;
};

export const formatTimestamp = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
};

export const humanizeLabel = (value: string): string => {
  const cleaned = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Export';
  }
  return cleaned.replace(/\b\w/g, match => match.toUpperCase());
};

export const getPdfHeaderLayout = (
  hasSubtitle: boolean,
  metaLineCount: number
): PdfHeaderLayout => {
  const barHeight = 14;
  const titleY = barHeight + 10;
  const subtitleY = hasSubtitle ? titleY + 6 : titleY;
  const metaY = hasSubtitle ? subtitleY + 6 : titleY + 6;
  const lineHeight = 4;
  const dividerY = metaY + Math.max(0, metaLineCount - 1) * lineHeight + 3;
  const tableStartY = dividerY + 5;

  return { barHeight, titleY, subtitleY, metaY, dividerY, tableStartY };
};

export const buildPdfHeaderContext = (
  doc: PdfDocumentLike,
  meta: {
    title: string;
    subtitle?: string;
    appName: string;
    footerText: string;
    scopeLabel?: string;
    generatedAt: Date;
    rowCount: number;
    columnCount: number;
  },
  processArabic: boolean
): PdfHeaderContext => {
  const pageSize = doc.internal.pageSize;
  const pageWidth = pageSize.getWidth ? pageSize.getWidth() : pageSize.width;
  const rightColumnWidth = pageWidth / 2;
  const leftMeta = `Generated: ${meta.generatedAt.toLocaleString('en-US')}`;
  const rightParts = [`Rows: ${meta.rowCount}`, `Columns: ${meta.columnCount}`];
  if (meta.scopeLabel) {
    rightParts.push(`Scope: ${meta.scopeLabel}`);
  }
  const rightMeta = rightParts.join(' | ');
  const rightText = toPdfText(doc, rightMeta, processArabic);
  const rightMetaLines = doc.splitTextToSize(rightText, rightColumnWidth) as string[];
  const layout = getPdfHeaderLayout(!!meta.subtitle, Math.max(1, rightMetaLines.length));

  return {
    layout,
    title: meta.title,
    subtitle: meta.subtitle,
    appName: meta.appName,
    footerText: meta.footerText,
    leftMeta,
    rightMetaLines
  };
};

export const drawPdfHeader = (
  doc: PdfDocumentLike,
  context: PdfHeaderContext,
  palette: PdfPalette,
  fontName: string,
  processArabic: boolean
): void => {
  const { layout } = context;
  const pageSize = doc.internal.pageSize;
  const pageWidth = pageSize.getWidth ? pageSize.getWidth() : pageSize.width;

  doc.setFillColor(...palette.brand);
  doc.rect(0, 0, pageWidth, layout.barHeight, 'F');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(toPdfText(doc, context.appName, processArabic), pageWidth - 12, 9, {
    align: 'right'
  });

  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...palette.text);
  doc.text(toPdfText(doc, context.title, processArabic), 12, layout.titleY);

  if (context.subtitle) {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...palette.muted);
    doc.text(toPdfText(doc, context.subtitle, processArabic), 12, layout.subtitleY);
  }

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...palette.muted);
  doc.text(toPdfText(doc, context.leftMeta, processArabic), 12, layout.metaY);
  doc.text(context.rightMetaLines, pageWidth - 12, layout.metaY, { align: 'right' });

  doc.setDrawColor(...palette.line);
  doc.setLineWidth(0.3);
  doc.line(10, layout.dividerY, pageWidth - 10, layout.dividerY);
};

export const drawPdfFooter = (
  doc: PdfDocumentLike,
  context: PdfHeaderContext,
  palette: PdfPalette,
  fontName: string,
  processArabic: boolean,
  pageNumber: number
): void => {
  const pageCount = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
  const pageSize = doc.internal.pageSize;
  const pageHeight = pageSize.height || pageSize.getHeight();
  const pageWidth = pageSize.width || pageSize.getWidth();

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...palette.muted);
  doc.text(
    toPdfText(doc, `Page ${pageNumber} of ${pageCount}`, processArabic),
    10,
    pageHeight - 10
  );
  doc.text(toPdfText(doc, context.footerText, processArabic), pageWidth - 10, pageHeight - 10, {
    align: 'right'
  });
};
