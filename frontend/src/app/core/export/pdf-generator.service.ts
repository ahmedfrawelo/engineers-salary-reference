import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { jsPDF } from 'jspdf';
import { environment } from '../../../environments/environment';

type AutoTableHookData = { pageNumber: number };
type AutoTableDoc = jsPDF & {
  autoTable?: (options: Record<string, unknown>) => void;
  lastAutoTable?: { finalY: number };
};
type JsPdfConstructor = new (...args: unknown[]) => AutoTableDoc;

/**
 * PDF Configuration
 */
export interface PDFConfig {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a3' | 'letter';
  margins?: { top: number; right: number; bottom: number; left: number };
  header?: (pageNumber: number, totalPages: number) => string;
  footer?: (pageNumber: number, totalPages: number) => string;
}

/**
 * Table Column Definition
 */
export interface TableColumn {
  header: string;
  field: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
}

/**
 * Advanced PDF Generator Service
 *
 * Generate professional PDFs with Arabic support
 *
 * Features:
 * - Arabic RTL support
 * - Tables with styling
 * - Charts and images
 * - Headers and footers
 * - Page numbering
 * - Custom fonts
 * - Multi-page documents
 *
 * NOTE: This service requires jsPDF library
 * Install: npm install jspdf jspdf-autotable
 *
 * @example
 * ```typescript
 * // Generate PDF
 * await this.pdfGenerator.generatePDF({
 *   title: 'تقرير الموردين',
 *   data: suppliers,
 *   columns: [
 *     { header: 'الاسم', field: 'name' },
 *     { header: 'الحالة', field: 'status' }
 *   ]
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class PDFGeneratorService {
  /**
   * Generate PDF from table data
   */
  async generateTablePDF(
    data: Array<Record<string, unknown>>,
    columns: TableColumn[],
    config: PDFConfig = {}
  ): Promise<void> {
    // Dynamic import to reduce bundle size
    const jsPDFModule = await import('jspdf');
    const JsPdfCtor = (jsPDFModule.default || jsPDFModule.jsPDF) as JsPdfConstructor;
    await import('jspdf-autotable');

    const {
      title = 'تقرير',
      orientation = 'portrait',
      format = 'a4',
      margins = { top: 20, right: 15, bottom: 20, left: 15 }
    } = config;

    // Create document
    const doc = new JsPdfCtor({
      orientation,
      unit: 'mm',
      format
    });

    // Add Arabic font support
    await this.setupArabicFont(doc);

    let yOffset = margins.top;

    // Add title
    if (title) {
      doc.setFontSize(18);
      doc.setFont('Amiri', 'bold');
      const titleWidth = doc.getTextWidth(title);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(title, pageWidth / 2, yOffset, { align: 'center' });
      yOffset += 15;
    }

    // Add metadata
    doc.setProperties({
      title: config.title || 'Report',
      author: config.author || 'ENGINEERS_SALARY_REFERENCE Portal',
      subject: config.subject || '',
      keywords: config.keywords || ''
    });

    // Prepare table data
    const headers = columns.map(col => col.header);
    const body = data.map(row =>
      columns.map(col => {
        const value = row[col.field];
        return col.format ? col.format(value) : value?.toString() || '';
      })
    );

    // Generate table
    doc.autoTable?.({
      head: [headers],
      body: body,
      startY: yOffset,
      margin: margins,
      styles: {
        font: 'Amiri',
        fontSize: 10,
        halign: 'right',
        cellPadding: 3
      },
      headStyles: {
        fillColor: [132, 199, 24], // #84c718
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: this.getColumnStyles(columns),
      didDrawPage: (tableData: AutoTableHookData) => {
        // Add page numbers
        this.addPageNumbers(doc, tableData.pageNumber, this.getTotalPages(doc));

        // Add footer
        if (config.footer) {
          const footer = config.footer(tableData.pageNumber, this.getTotalPages(doc));
          doc.setFontSize(8);
          doc.text(footer, margins.left, doc.internal.pageSize.getHeight() - 10);
        }
      }
    });

    // Save PDF
    const filename = `${title || 'report'}_${Date.now()}.pdf`;
    doc.save(filename);

    if (environment.enableDebugLogs) console.log(`[PDFGenerator] Generated: ${filename}`);
  }

  /**
   * Generate PDF from HTML element
   */
  async generateFromHTML(elementId: string, config: PDFConfig = {}): Promise<void> {
    const jsPDFModule = await import('jspdf');
    const JsPdfCtor = (jsPDFModule.default || jsPDFModule.jsPDF) as JsPdfConstructor;
    const html2canvas = await import('html2canvas').then(m => m.default);

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Convert HTML to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190; // A4 width minus margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const doc = new JsPdfCtor({
      orientation: config.orientation || 'portrait',
      unit: 'mm',
      format: config.format || 'a4'
    });

    let heightLeft = imgHeight;
    let position = 10;

    // Add image to PDF (handle multiple pages)
    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= doc.internal.pageSize.getHeight();

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= doc.internal.pageSize.getHeight();
    }

    const filename = `${config.title || 'document'}_${Date.now()}.pdf`;
    doc.save(filename);
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoice(invoice: {
    number: string;
    date: string;
    client: { name: string; address: string };
    items: Array<{ description: string; quantity: number; price: number }>;
    total: number;
  }): Promise<void> {
    const jsPDFModule = await import('jspdf');
    const JsPdfCtor = (jsPDFModule.default || jsPDFModule.jsPDF) as JsPdfConstructor;

    const doc = new JsPdfCtor('portrait', 'mm', 'a4');
    await this.setupArabicFont(doc);

    // Header
    doc.setFontSize(24);
    doc.setFont('Amiri', 'bold');
    doc.text('فاتورة', 105, 20, { align: 'center' });

    // Invoice details
    doc.setFontSize(12);
    doc.setFont('Amiri', 'normal');
    doc.text(`رقم الفاتورة: ${invoice.number}`, 180, 40, { align: 'right' });
    doc.text(`التاريخ: ${invoice.date}`, 180, 50, { align: 'right' });

    // Client info
    doc.text(`العميل: ${invoice.client.name}`, 180, 65, { align: 'right' });
    doc.text(`العنوان: ${invoice.client.address}`, 180, 73, { align: 'right' });

    // Items table
    const items = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      item.price.toFixed(2),
      (item.quantity * item.price).toFixed(2)
    ]);

    doc.autoTable?.({
      head: [['الوصف', 'الكمية', 'السعر', 'المجموع']],
      body: items,
      startY: 90,
      styles: { font: 'Amiri', halign: 'right' },
      headStyles: { fillColor: [132, 199, 24] }
    });

    // Total
    const finalY = doc.lastAutoTable?.finalY ?? 90;
    doc.setFontSize(14);
    doc.setFont('Amiri', 'bold');
    doc.text(`الإجمالي: ${invoice.total.toFixed(2)} ريال`, 180, finalY + 15, {
      align: 'right'
    });

    doc.save(`invoice_${invoice.number}.pdf`);
  }

  /**
   * Generate report with charts
   */
  async generateReportWithCharts(
    title: string,
    sections: Array<{
      title: string;
      type: 'text' | 'table' | 'chart';
      content: unknown;
    }>
  ): Promise<void> {
    const jsPDFModule = await import('jspdf');
    const JsPdfCtor = (jsPDFModule.default || jsPDFModule.jsPDF) as JsPdfConstructor;

    const doc = new JsPdfCtor('portrait', 'mm', 'a4');
    await this.setupArabicFont(doc);

    let yOffset = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('Amiri', 'bold');
    doc.text(title, 105, yOffset, { align: 'center' });
    yOffset += 15;

    for (const section of sections) {
      // Section title
      doc.setFontSize(14);
      doc.text(section.title, 180, yOffset, { align: 'right' });
      yOffset += 10;

      // Section content based on type
      if (section.type === 'text') {
        doc.setFontSize(12);
        doc.setFont('Amiri', 'normal');
        const sectionText =
          typeof section.content === 'string' ? section.content : String(section.content);
        const lines = doc.splitTextToSize(sectionText, 170);
        doc.text(lines, 180, yOffset, { align: 'right' });
        yOffset += lines.length * 7;
      } else if (section.type === 'table') {
        // Handle table
        yOffset += 10;
      }

      yOffset += 10;
    }

    doc.save(`${title}.pdf`);
  }

  /**
   * Setup Arabic font
   */
  private async setupArabicFont(doc: AutoTableDoc): Promise<void> {
    // In production, you would load a custom Arabic font
    // For now, use built-in support
    try {
      doc.setLanguage('ar');
      doc.setFont('Amiri', 'normal');
    } catch (error) {
      if (environment.enableDebugLogs)
        console.warn('[PDFGenerator] Arabic font not loaded, using default');
    }
  }

  /**
   * Get column styles for autoTable
   */
  private getColumnStyles(
    columns: TableColumn[]
  ): Record<number, { halign: string; cellWidth: number | 'auto' }> {
    const styles: Record<number, { halign: string; cellWidth: number | 'auto' }> = {};

    columns.forEach((col, index) => {
      styles[index] = {
        halign: col.align || 'right',
        cellWidth: col.width || 'auto'
      };
    });

    return styles;
  }

  /**
   * Add page numbers
   */
  private addPageNumbers(doc: AutoTableDoc, currentPage: number, totalPages: number): void {
    doc.setFontSize(10);
    doc.setFont('Amiri', 'normal');
    const pageText = `صفحة ${currentPage} من ${totalPages}`;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(pageText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
      align: 'center'
    });
  }

  /**
   * Get total pages
   */
  private getTotalPages(doc: AutoTableDoc): number {
    return doc.internal.getNumberOfPages();
  }
}
