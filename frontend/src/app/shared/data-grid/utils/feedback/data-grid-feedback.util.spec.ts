import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDeleteSelectedRowsConfirmMessage,
  getOverwritePresetConfirmMessage,
  GRID_FEEDBACK_MESSAGES,
  inferGridFeedbackTone,
  registerGridFeedbackHandlers,
  requestGridConfirm,
  showGridAlert
} from './data-grid-feedback.util';

describe('data-grid-feedback.util', () => {
  beforeEach(() => {
    registerGridFeedbackHandlers({});
  });

  afterEach(() => {
    registerGridFeedbackHandlers({});
  });

  it('does not fall back to browser alerts when no handler is registered', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToExport);

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does not fall back to browser confirms when no handler is registered', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onConfirm = vi.fn();

    requestGridConfirm(GRID_FEEDBACK_MESSAGES.deleteSingleRow, { onConfirm });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('delegates alerts and confirms to registered handlers when provided', () => {
    const alertHandler = vi.fn();
    const confirmHandler = vi.fn();
    const onConfirm = vi.fn();
    registerGridFeedbackHandlers({
      alert: alertHandler,
      confirm: confirmHandler
    });

    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToDelete);
    requestGridConfirm(GRID_FEEDBACK_MESSAGES.deleteSingleRow, {
      actionLabel: 'Delete',
      tone: 'danger',
      onConfirm
    });

    expect(alertHandler).toHaveBeenCalledWith('Please select rows to delete.', undefined);
    expect(confirmHandler).toHaveBeenCalledWith('Delete this row?', {
      actionLabel: 'Delete',
      tone: 'danger',
      onConfirm
    });
  });

  it('infers a tone from the feedback message semantics', () => {
    expect(inferGridFeedbackTone(GRID_FEEDBACK_MESSAGES.selectRowsToDelete)).toBe('warning');
    expect(inferGridFeedbackTone(GRID_FEEDBACK_MESSAGES.failedToPasteData)).toBe('danger');
    expect(inferGridFeedbackTone('Rows exported successfully.')).toBe('info');
  });

  it('builds semantic confirm messages', () => {
    expect(getOverwritePresetConfirmMessage('Main')).toBe(
      'Preset "Main" already exists. Overwrite?'
    );
    expect(getDeleteSelectedRowsConfirmMessage(3)).toBe(
      'Are you sure you want to delete 3 selected row(s)?'
    );
  });
});
