import { Injectable } from '@angular/core';
import { signal, WritableSignal } from '@angular/core';

/**
 * Handles keyboard interactions for the data grid, including navigation,
 * selection shortcuts, and edit-mode entry points.
 */

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface KeyboardNavigationConfig {
  enableArrowKeys?: boolean;
  enableEnterEdit?: boolean;
  enableEscapeCancel?: boolean;
  enableSpaceSelect?: boolean;
  enableCtrlA?: boolean;
  enableHomeEnd?: boolean;
  enablePageUpDown?: boolean;
}

export type NavigationAction =
  | { type: 'move'; position: CellPosition }
  | { type: 'edit'; position: CellPosition }
  | { type: 'cancel' }
  | { type: 'select'; position: CellPosition }
  | { type: 'selectAll' }
  | { type: 'none' };

@Injectable({ providedIn: 'root' })
export class KeyboardNavigationService {
  private readonly defaultConfig: Required<KeyboardNavigationConfig> = {
    enableArrowKeys: true,
    enableEnterEdit: true,
    enableEscapeCancel: true,
    enableSpaceSelect: true,
    enableCtrlA: true,
    enableHomeEnd: true,
    enablePageUpDown: true
  };

  /**
   * Handle a keyboard event and return the resulting navigation action.
   */
  handleKeydown(
    event: KeyboardEvent,
    activeCell: CellPosition | null,
    totalRows: number,
    totalColumns: number,
    config: KeyboardNavigationConfig = {}
  ): NavigationAction {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Arrow keys - Move cell focus
    if (mergedConfig.enableArrowKeys && this.isArrowKey(event.key)) {
      if (!activeCell) {
        return { type: 'move', position: { rowIndex: 0, columnIndex: 0 } };
      }

      const newPosition = this.calculateNewPosition(
        activeCell,
        event.key,
        totalRows,
        totalColumns,
        event.shiftKey,
        event.ctrlKey || event.metaKey
      );

      if (newPosition) {
        event.preventDefault();
        return { type: 'move', position: newPosition };
      }
    }

    // Enter - Start editing
    if (mergedConfig.enableEnterEdit && event.key === 'Enter' && !event.shiftKey) {
      if (activeCell) {
        event.preventDefault();
        return { type: 'edit', position: activeCell };
      }
    }

    // Escape - Cancel editing
    if (mergedConfig.enableEscapeCancel && event.key === 'Escape') {
      event.preventDefault();
      return { type: 'cancel' };
    }

    // Space - Toggle row selection
    if (mergedConfig.enableSpaceSelect && event.key === ' ' && activeCell) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        return { type: 'select', position: activeCell };
      }
    }

    // Ctrl+A - Select all
    if (mergedConfig.enableCtrlA && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      return { type: 'selectAll' };
    }

    // Home/End - Jump to first/last column
    if (mergedConfig.enableHomeEnd && activeCell) {
      if (event.key === 'Home') {
        event.preventDefault();
        return {
          type: 'move',
          position: { ...activeCell, columnIndex: 0 }
        };
      }
      if (event.key === 'End') {
        event.preventDefault();
        return {
          type: 'move',
          position: { ...activeCell, columnIndex: totalColumns - 1 }
        };
      }
    }

    // Page Up/Down - Jump rows
    if (mergedConfig.enablePageUpDown && activeCell) {
      if (event.key === 'PageUp') {
        event.preventDefault();
        return {
          type: 'move',
          position: { ...activeCell, rowIndex: Math.max(0, activeCell.rowIndex - 10) }
        };
      }
      if (event.key === 'PageDown') {
        event.preventDefault();
        return {
          type: 'move',
          position: { ...activeCell, rowIndex: Math.min(totalRows - 1, activeCell.rowIndex + 10) }
        };
      }
    }

    return { type: 'none' };
  }

  /**
   * Calculate the next cell position for an arrow-key navigation event.
   */
  private calculateNewPosition(
    current: CellPosition,
    key: string,
    totalRows: number,
    totalColumns: number,
    shiftKey: boolean,
    ctrlKey: boolean
  ): CellPosition | null {
    let newRow = current.rowIndex;
    let newCol = current.columnIndex;

    switch (key) {
      case 'ArrowUp':
        newRow = ctrlKey ? 0 : Math.max(0, current.rowIndex - 1);
        break;

      case 'ArrowDown':
        newRow = ctrlKey ? totalRows - 1 : Math.min(totalRows - 1, current.rowIndex + 1);
        break;

      case 'ArrowLeft':
        newCol = ctrlKey ? 0 : Math.max(0, current.columnIndex - 1);
        break;

      case 'ArrowRight':
        newCol = ctrlKey ? totalColumns - 1 : Math.min(totalColumns - 1, current.columnIndex + 1);
        break;

      default:
        return null;
    }

    // Check if position actually changed
    if (newRow === current.rowIndex && newCol === current.columnIndex) {
      return null;
    }

    return { rowIndex: newRow, columnIndex: newCol };
  }

  /**
   * Check whether the pressed key is an arrow key.
   */
  private isArrowKey(key: string): boolean {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  }

  /**
   * Return a human-readable keyboard shortcut description.
   */
  getShortcutDescription(key: string): string {
    const shortcuts: Record<string, string> = {
      ArrowUp: 'Move up',
      ArrowDown: 'Move down',
      ArrowLeft: 'Move left',
      ArrowRight: 'Move right',
      Enter: 'Edit cell',
      Escape: 'Cancel edit',
      Space: 'Select row (Ctrl+Space)',
      'Ctrl+A': 'Select all',
      Home: 'Jump to first column',
      End: 'Jump to last column',
      PageUp: 'Jump up 10 rows',
      PageDown: 'Jump down 10 rows',
      'Ctrl+ArrowUp': 'Jump to first row',
      'Ctrl+ArrowDown': 'Jump to last row',
      'Ctrl+ArrowLeft': 'Jump to first column',
      'Ctrl+ArrowRight': 'Jump to last column'
    };

    return shortcuts[key] || 'Unknown shortcut';
  }

  /**
   * Return all supported keyboard shortcuts.
   */
  getAllShortcuts(): Array<{ keys: string; description: string; category: string }> {
    return [
      { keys: '↑ ↓ ← →', description: 'Navigate cells', category: 'Navigation' },
      { keys: 'Ctrl + ↑ ↓ ← →', description: 'Jump to edge', category: 'Navigation' },
      { keys: 'Home', description: 'First column', category: 'Navigation' },
      { keys: 'End', description: 'Last column', category: 'Navigation' },
      { keys: 'Page Up/Down', description: 'Jump 10 rows', category: 'Navigation' },
      { keys: 'Enter', description: 'Edit cell', category: 'Editing' },
      { keys: 'Escape', description: 'Cancel edit', category: 'Editing' },
      { keys: 'Ctrl + Space', description: 'Toggle row selection', category: 'Selection' },
      { keys: 'Ctrl + A', description: 'Select all', category: 'Selection' },
      { keys: 'Tab', description: 'Next cell', category: 'Navigation' },
      { keys: 'Shift + Tab', description: 'Previous cell', category: 'Navigation' }
    ];
  }
}
