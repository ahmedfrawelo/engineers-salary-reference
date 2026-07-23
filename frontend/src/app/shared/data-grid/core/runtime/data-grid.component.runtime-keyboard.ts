type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
export function onDocumentClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  ctx.handleGlobalDismiss(event);
}
export function onKeyDownHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  // ? Handle spreadsheet mode keyboard shortcuts first
  if (ctx.isSpreadsheetMode()) {
    ctx.handleSpreadsheetKeydown(event);
  }
  if (event.key === 'Escape') {
    ctx.closeFilterMenu();
    ctx.closeContextMenu();
    ctx.closeActionLauncher();
    return;
  }
  // Ctrl+? or Ctrl+/ to toggle shortcuts panel
  if ((event.ctrlKey || event.metaKey) && (event.key === '?' || event.key === '/')) {
    event.preventDefault();
    ctx.toggleKeyboardShortcuts();
    return;
  }
  if (isNativeEditableTarget(event)) {
    return;
  }
  if (!ctx.keyboardNavigationEnabled) return;
  const active = ctx.activeCell();
  if (!active) return;
  const editing = ctx.editingCell();
  if (editing) {
    // In edit mode, only handle Escape and Enter
    if (event.key === 'Escape') {
      event.preventDefault();
      ctx.cancelEdit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      const row = ctx.processedData()[active.rowIndex];
      const column = ctx.visibleColumns()[active.columnIndex];
      ctx.saveEdit(row, column, input.value);
      return;
    }
    return;
  }

  const isPlainPrintableKey =
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey;
  if (isPlainPrintableKey) {
    event.preventDefault();
    if (typeof ctx.beginTypingIntoActiveCell === 'function') {
      ctx.beginTypingIntoActiveCell(event.key);
    } else {
      ctx.startEditFromKeyboard();
    }
    return;
  }

  // Navigation keys
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      ctx.navigateCell('up');
      break;
    case 'ArrowDown':
      event.preventDefault();
      ctx.navigateCell('down');
      break;
    case 'ArrowLeft':
      event.preventDefault();
      ctx.navigateCell('left');
      break;
    case 'ArrowRight':
      event.preventDefault();
      ctx.navigateCell('right');
      break;
    case 'Tab':
      event.preventDefault();
      ctx.navigateCell(event.shiftKey ? 'left' : 'right');
      break;
    case 'Enter':
      event.preventDefault();
      ctx.startEditFromKeyboard();
      break;
    case ' ':
      event.preventDefault();
      ctx.toggleRowSelectionFromKeyboard();
      break;
    case 'Home':
      event.preventDefault();
      ctx.navigateToEdge('start');
      break;
    case 'End':
      event.preventDefault();
      ctx.navigateToEdge('end');
      break;
    case 'a':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (ctx.config.selectable) {
          ctx.toggleSelectAll();
        }
      }
      break;
    case 'c':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        ctx.copySelectedCells();
      }
      break;
  }
}

function isNativeEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return false;
  }

  return !!target.closest(
    'input,textarea,select,[contenteditable="true"],search-select,.ss-inline-input,.ss-search'
  );
}
export function navigateCellHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [direction] = args;
  const active = ctx.activeCell();
  if (!active) return;
  const rows = ctx.processedData();
  const cols = ctx.visibleColumns();
  let { rowIndex, columnIndex } = active;
  switch (direction) {
    case 'up':
      rowIndex = Math.max(0, rowIndex - 1);
      break;
    case 'down':
      rowIndex = Math.min(rows.length - 1, rowIndex + 1);
      break;
    case 'left':
      columnIndex = Math.max(0, columnIndex - 1);
      break;
    case 'right':
      columnIndex = Math.min(cols.length - 1, columnIndex + 1);
      break;
  }
  ctx.activeCell.set({ rowIndex, columnIndex });
  ctx.scrollToActiveCell();
}
export function navigateToEdgeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [edge] = args;
  const active = ctx.activeCell();
  if (!active) return;
  const cols = ctx.visibleColumns();
  ctx.activeCell.set({
    rowIndex: active.rowIndex,
    columnIndex: edge === 'start' ? 0 : cols.length - 1
  });
  ctx.scrollToActiveCell();
}
export function startEditFromKeyboardHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const active = ctx.activeCell();
  if (!active) return;
  const column = ctx.visibleColumns()[active.columnIndex];
  if (column.editable && ctx.config.editMode !== 'none') {
    ctx.startEdit(active.rowIndex, column);
  }
}
export function toggleRowSelectionFromKeyboardHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const active = ctx.activeCell();
  if (!active || !ctx.config.selectable) return;
  const row = ctx.processedData()[active.rowIndex];
  ctx.toggleRowSelection(row);
}
