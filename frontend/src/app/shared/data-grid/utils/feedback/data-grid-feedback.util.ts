export const GRID_FEEDBACK_MESSAGES = {
  unableToCopySelectionInsights: 'Unable to copy selection insights. Please try again.',
  invalidValue: 'Invalid value',
  selectRowsToExport: 'Please select rows to export.',
  noFilteredDataToExport: 'No filtered data to export.',
  noActiveFiltersToSave: 'No active filters to save.',
  enterPresetName: 'Please enter a preset name.',
  selectRowsToDelete: 'Please select rows to delete.',
  selectRowsToEdit: 'Please select rows to edit.',
  unableToCopyAuditEntry: 'Unable to copy audit entry.',
  unableToGenerateShareableLink: 'Unable to generate a shareable link.',
  failedToPasteData: 'Failed to paste data. Please check the clipboard format.',
  failedToCopyColumnData: 'Failed to copy column data.',
  noVisibleDataToExport: 'No visible data to export.',
  stateKeyRequiredToSaveSnapshots: 'State key is required to save snapshots.',
  excelExportFailed: 'Error exporting to Excel. Please try again.',
  csvExportFailed: 'Error exporting to CSV. Please try again.',
  pdfExportFailed: 'Error exporting to PDF. Please try again.',
  selectionEditUnavailable: 'No edit action is available for this selection.',
  selectionDeleteUnavailable: 'No delete action is configured for this grid.',
  deletedRowsRestored: 'Deleted rows restored.',
  deleteSingleRow: 'Delete this row?',
  deleteSingleColumn: 'Delete this column?',
  keepAtLeastOneColumn: 'At least one column must remain in the grid.'
} as const;

export type GridFeedbackTone = 'info' | 'warning' | 'danger';

export interface GridAlertOptions {
  tone?: GridFeedbackTone;
}

export interface GridConfirmOptions {
  actionLabel?: string;
  tone?: GridFeedbackTone;
  onConfirm: () => void;
}

export interface GridActionOptions {
  actionLabel?: string;
  duration?: number;
  onAction: () => void;
  onExpire?: () => void;
  title?: string;
  tone?: GridFeedbackTone;
}

interface GridFeedbackHandlers {
  action?: (message: string, options: GridActionOptions) => void;
  alert?: (message: string, options?: GridAlertOptions) => void;
  confirm?: (message: string, options: GridConfirmOptions) => void;
}

let gridFeedbackHandlers: GridFeedbackHandlers = {};

export function registerGridFeedbackHandlers(handlers: GridFeedbackHandlers): () => void {
  gridFeedbackHandlers = handlers;

  return () => {
    if (gridFeedbackHandlers === handlers) {
      gridFeedbackHandlers = {};
    }
  };
}

export function inferGridFeedbackTone(message: string): GridFeedbackTone {
  const normalized = message.trim().toLowerCase();
  if (
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('unable')
  ) {
    return 'danger';
  }

  if (
    normalized.startsWith('please ') ||
    normalized.includes('invalid') ||
    normalized.includes('required') ||
    normalized.includes('overwrite')
  ) {
    return 'warning';
  }

  return 'info';
}

export function showGridAlert(message: string, options?: GridAlertOptions): void {
  if (gridFeedbackHandlers.alert) {
    gridFeedbackHandlers.alert(message, options);
  } else if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[DataGrid feedback] Missing alert handler for message: ${message}`);
  }
}

export function requestGridConfirm(message: string, options: GridConfirmOptions): void {
  if (gridFeedbackHandlers.confirm) {
    gridFeedbackHandlers.confirm(message, options);
  } else if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[DataGrid feedback] Missing confirm handler for message: ${message}`);
  }
}

export function showGridAction(message: string, options: GridActionOptions): void {
  if (gridFeedbackHandlers.action) {
    gridFeedbackHandlers.action(message, options);
  } else if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[DataGrid feedback] Missing action handler for message: ${message}`);
  }
}

export function getValidationFeedbackMessage(validation: boolean | string): string {
  return typeof validation === 'string' ? validation : GRID_FEEDBACK_MESSAGES.invalidValue;
}

export function getOverwritePresetConfirmMessage(name: string): string {
  return `Preset "${name}" already exists. Overwrite?`;
}

export function getDeleteSelectedRowsConfirmMessage(count: number): string {
  return `Are you sure you want to delete ${count} selected row(s)?`;
}

export function getDeletedRowsFeedbackMessage(count: number): string {
  return `${count.toLocaleString('en-US')} row${count === 1 ? '' : 's'} deleted.`;
}
