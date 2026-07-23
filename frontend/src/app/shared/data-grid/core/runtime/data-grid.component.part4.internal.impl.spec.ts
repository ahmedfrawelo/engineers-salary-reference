import { vi } from 'vitest';
import {
  handleCellMouseEnterHelper,
  handleHeaderMouseEnterHelper,
  toggleFullScreenHelper
} from './data-grid.component.part4.internal.impl';

describe('data-grid.component.part4.internal.impl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('targets the current grid instance when toggling fullscreen', () => {
    const decoyGrid = document.createElement('div');
    decoyGrid.className = 'engineers-salary-reference-data-grid';
    const decoyRequestFullscreen = vi.fn();
    Object.assign(decoyGrid, { requestFullscreen: decoyRequestFullscreen });
    document.body.appendChild(decoyGrid);

    const host = document.createElement('div');
    const ownGrid = document.createElement('div');
    ownGrid.className = 'engineers-salary-reference-data-grid';
    const ownRequestFullscreen = vi.fn();
    Object.assign(ownGrid, { requestFullscreen: ownRequestFullscreen });
    host.appendChild(ownGrid);
    document.body.appendChild(host);

    let isFullScreen = false;
    const fullScreenSignal = (() => isFullScreen) as unknown as {
      (): boolean;
      update: (updater: (value: boolean) => boolean) => void;
    };
    fullScreenSignal.update = updater => {
      isFullScreen = updater(isFullScreen);
    };

    const ctx = {
      isFullScreen: fullScreenSignal,
      elementRef: { nativeElement: host },
      logAuditEvent: vi.fn()
    };

    toggleFullScreenHelper(ctx);

    expect(ownRequestFullscreen).toHaveBeenCalledTimes(1);
    expect(decoyRequestFullscreen).not.toHaveBeenCalled();
  });

  it('skips header hover side effects when hover is disabled', () => {
    const setHoveredColumn = vi.fn();
    const showHeaderTooltip = vi.fn();

    handleHeaderMouseEnterHelper(
      {
        config: { hover: false },
        elementRef: { nativeElement: document.createElement('div') },
        setHoveredColumn,
        getColumnField: () => 'name',
        showHeaderTooltip,
        suspendHoverUntilTs: undefined
      },
      new MouseEvent('mouseenter'),
      { field: 'name', headerTooltip: 'Name' }
    );

    expect(setHoveredColumn).not.toHaveBeenCalled();
    expect(showHeaderTooltip).not.toHaveBeenCalled();
  });

  it('skips cell hover side effects when hover is disabled', () => {
    const setHoveredColumn = vi.fn();
    const showTooltip = vi.fn();
    const syncHoverLink = vi.fn();

    handleCellMouseEnterHelper(
      {
        config: { hover: false },
        elementRef: { nativeElement: document.createElement('div') },
        setHoveredColumn,
        getColumnField: () => 'name',
        showTooltip,
        syncHoverLink,
        suspendHoverUntilTs: undefined
      },
      new MouseEvent('mouseenter'),
      { field: 'name' },
      { id: 1 },
      0
    );

    expect(setHoveredColumn).not.toHaveBeenCalled();
    expect(showTooltip).not.toHaveBeenCalled();
    expect(syncHoverLink).not.toHaveBeenCalled();
  });
});
