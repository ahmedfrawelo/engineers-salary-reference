import { describe, expect, it, vi } from 'vitest';
import {
  isGridCalculateFooterColumnMenuStale,
  isGridCalculateFooterActionsCell,
  normalizeGridCalculateFooterFieldKey,
  resolveGridCalculateFooterCurrentOperation,
  resolveGridCalculateFooterLayout,
  resolveGridCalculateFooterMeasuredWidth,
  resolveGridCalculateFooterRenderedWidth,
  resolveGridCalculateFooterPanelPosition,
  resolveGridCalculateFooterTableWidth
} from './grid-calculate-footer.component';

describe('resolveGridCalculateFooterPanelPosition', () => {
  it('opens below the trigger when there is not enough room above', () => {
    const position = resolveGridCalculateFooterPanelPosition(
      {
        left: 120,
        top: 36,
        bottom: 60
      },
      1280,
      720,
      {
        panelWidth: 240,
        panelHeight: 320
      }
    );

    expect(position.left).toBe(120);
    expect(position.top).toBe(68);
  });

  it('clamps the panel inside the viewport near the bottom edge', () => {
    const position = resolveGridCalculateFooterPanelPosition(
      {
        left: 1100,
        top: 700,
        bottom: 724
      },
      1280,
      720,
      {
        panelWidth: 240,
        panelHeight: 320
      }
    );

    expect(position.left).toBe(1028);
    expect(position.top).toBe(372);
  });
});

describe('resolveGridCalculateFooterMeasuredWidth', () => {
  it('prefers synchronized colgroup widths over rendered box widths', () => {
    const col = document.createElement('col');
    col.style.width = '44px';
    vi.spyOn(col, 'getBoundingClientRect').mockReturnValue({ width: 42 } as DOMRect);

    expect(resolveGridCalculateFooterMeasuredWidth(col, 40)).toBe(44);
  });
});

describe('resolveGridCalculateFooterRenderedWidth', () => {
  it('prefers the rendered cell width over inline sizing hints', () => {
    const cell = document.createElement('th');
    cell.style.width = '160px';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ width: 192 } as DOMRect);

    expect(resolveGridCalculateFooterRenderedWidth(cell, 140)).toBe(192);
  });
});

describe('resolveGridCalculateFooterLayout', () => {
  it('maps selection, data, and action widths in table order', () => {
    const layout = resolveGridCalculateFooterLayout([44, 180, 140, 120], {
      hasSelection: true,
      hasActions: true,
      columnCount: 2
    });

    expect(layout).toEqual({
      selectionWidth: 44,
      actionWidth: 120,
      columnWidths: [180, 140],
      totalWidth: 484,
      tableWidth: 484
    });
  });
});

describe('resolveGridCalculateFooterCurrentOperation', () => {
  it('prefers the config callback over mutating the grid column definition', () => {
    const column = {
      field: 'price',
      header: 'Price',
      aggregate: 'sum' as const
    };

    expect(
      resolveGridCalculateFooterCurrentOperation(column, {
        enabled: true,
        scope: 'filtered',
        currentOperation: () => 'avg'
      })
    ).toBe('avg');
  });

  it('falls back to the column aggregate when no callback is provided', () => {
    const column = {
      field: 'price',
      header: 'Price',
      aggregate: 'sum' as const
    };

    expect(
      resolveGridCalculateFooterCurrentOperation(column, {
        enabled: true,
        scope: 'filtered'
      })
    ).toBe('sum');
  });
});

describe('isGridCalculateFooterActionsCell', () => {
  it('treats both fixed-header and body actions headers as action columns', () => {
    const fixedHeaderCell = document.createElement('th');
    fixedHeaderCell.className = 'actions-cell';

    const bodyHeaderCell = document.createElement('th');
    bodyHeaderCell.className = 'row-actions-cell';

    expect(isGridCalculateFooterActionsCell(fixedHeaderCell)).toBe(true);
    expect(isGridCalculateFooterActionsCell(bodyHeaderCell)).toBe(true);
    expect(isGridCalculateFooterActionsCell(document.createElement('th'))).toBe(false);
  });
});

describe('isGridCalculateFooterColumnMenuStale', () => {
  it('keeps an open calculate menu valid across aggregate config refreshes', () => {
    expect(
      isGridCalculateFooterColumnMenuStale('projecttitle', [
        { field: 'Project_Title', header: 'Project Title' }
      ])
    ).toBe(false);
  });

  it('marks an open calculate menu stale only when the column disappears', () => {
    expect(
      isGridCalculateFooterColumnMenuStale('projecttitle', [
        { field: 'owner', header: 'Owner' }
      ])
    ).toBe(true);
  });
});

describe('normalizeGridCalculateFooterFieldKey', () => {
  it('matches the footer column key normalization used by open menus', () => {
    expect(normalizeGridCalculateFooterFieldKey(' Project_Title ')).toBe('projecttitle');
  });
});

describe('resolveGridCalculateFooterTableWidth', () => {
  it('stretches the aggregate footer to the rendered grid width when the table is wider than its columns', () => {
    expect(resolveGridCalculateFooterTableWidth(484, 640)).toBe(640);
    expect(resolveGridCalculateFooterTableWidth(484, 0)).toBe(484);
  });
});
