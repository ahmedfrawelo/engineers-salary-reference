import { renderAppIconHtml } from '@shared/icons/programmatic-app-icon';
import { reportGridError } from '../../utils';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
export function scrollToActiveCellHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  // Scroll to active cell if needed
  setTimeout(() => {
    const active = ctx.activeCell();
    if (!active) return;
    const viewport = ctx.gridViewport?.nativeElement;
    if (!viewport) return;
    const table = viewport.querySelector('table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const targetRow = tbody.rows.item(active.rowIndex);
    if (!targetRow) return;
    const targetCell = targetRow.cells.item(
      active.columnIndex + (ctx.config.selectable ? 1 : 0)
    ) as HTMLElement | null;
    if (!targetCell) return;
    // Check if cell is in viewport
    const cellRect = targetCell.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    if (cellRect.top < viewportRect.top || cellRect.bottom > viewportRect.bottom) {
      targetCell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (cellRect.left < viewportRect.left || cellRect.right > viewportRect.right) {
      targetCell.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    }
  }, 0);
}
export async function copySelectedCellsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const selected = ctx.selectedRows();
  if (selected.length > 0) {
    // Copy selected rows
    await ctx.copyRows(selected);
  } else {
    // Copy active cell
    const active = ctx.activeCell();
    if (!active) return;
    const row = ctx.processedData()[active.rowIndex];
    const column = ctx.visibleColumns()[active.columnIndex];
    const value = ctx.getCellValue(row, column);
    // Copy single cell value
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(String(value || ''));
        ctx.showCopyFeedback('Cell copied!');
      } catch (err) {
        reportGridError('Failed to copy:', err);
      }
    }
  }
}
export async function copyRowsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [rows] = args;
  const columns = ctx.visibleColumns();
  const textFormat = ctx.generateTextFormat(rows, columns);
  try {
    // Write to clipboard with multiple formats
    if (navigator.clipboard && (navigator.clipboard as LooseValue).write) {
      const clipboardItems = [
        new ClipboardItem({
          'text/plain': new Blob([textFormat], { type: 'text/plain' }),
          'text/html': new Blob([textFormat], { type: 'text/html' })
        })
      ];
      await (navigator.clipboard as LooseValue).write(clipboardItems);
    } else {
      // Fallback: just copy as text
      await navigator.clipboard.writeText(textFormat);
    }
    ctx.showCopyFeedback(`${rows.length} row${rows.length > 1 ? 's' : ''} copied!`);
  } catch (err) {
    reportGridError('Failed to copy rows:', err);
    // Fallback to simple text copy
    try {
      await navigator.clipboard.writeText(textFormat);
      ctx.showCopyFeedback('Copied as text');
    } catch (e) {
      reportGridError('Clipboard fallback failed:', e);
    }
  }
}
export async function copySelectedRowsAsJsonHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const selected = ctx.selectedRows();
  if (!selected.length) {
    return;
  }

  const columns = ctx.visibleColumns();
  const payload: LooseValue[] = [];
  for (const row of selected) {
    const entry: LooseValue = {};
    for (const col of columns) {
      entry[ctx.getColumnField(col)] = ctx.getCellTitle(row, col);
    }
    payload.push(entry);
  }
  const text = JSON.stringify(payload, null, 2);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      ctx.copyTextFallback(text);
    }
    ctx.showCopyFeedback(`${selected.length} row${selected.length > 1 ? 's' : ''} copied as JSON!`);
  } catch (err) {
    reportGridError('Failed to copy selection as JSON:', err);
    try {
      ctx.copyTextFallback(text);
      ctx.showCopyFeedback('Copied as JSON');
    } catch (fallbackError) {
      reportGridError('JSON clipboard fallback failed:', fallbackError);
    }
  }
}
export function generateTextFormatHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows, columns] = args;
  const lines: string[] = [];
  const headerCells: string[] = [];

  for (const column of columns) {
    headerCells.push(String(column.header ?? ''));
  }
  lines.push(headerCells.join('\t'));

  for (const row of rows) {
    const cells: string[] = [];
    for (const column of columns) {
      const value = ctx.getCellValue(row, column);
      cells.push(String(value || ''));
    }
    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}
export function generateTSVFormatHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows, columns] = args;
  // Same as text format but can be enriched with HTML for Excel
  return ctx.generateTextFormat(rows, columns);
}
export function generateJSONFormatHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows, columns] = args;
  const data: LooseValue[] = [];
  for (const row of rows) {
    const obj: LooseValue = {};
    for (const col of columns) {
      obj[col.field as string] = ctx.getCellValue(row, col);
    }
    data.push(obj);
  }
  return JSON.stringify(data, null, 2);
}
export function showCopyFeedbackHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [message] = args;
  void ctx;
  void renderAppIconHtml;
  return message;
}
export function onCellClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, columnIndex] = args;
  ctx.activeCell.set({ rowIndex, columnIndex });
}
export function isActiveCellHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, columnIndex] = args;
  const active = ctx.activeCell();
  return active?.rowIndex === rowIndex && active?.columnIndex === columnIndex;
}
