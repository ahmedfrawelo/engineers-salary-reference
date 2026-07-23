import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Component, NgModule } from '@angular/core';
import * as AngularCore from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkFixedSizeVirtualScroll, ScrollingModule } from '@angular/cdk/scrolling';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { DataGridComponent } from './data-grid.component';
import { GridCalculateFooterComponent } from '../components';
import { GridChangeEvent, GridColumn, GridConfig } from '../models';
import { DataGridModule } from '../module/data-grid.module';
import { DataGridService } from '../services';

type TestRow = {
  id: number;
  name: string;
  age: number;
};

const resolveComponentResources = (
  AngularCore as unknown as {
    '\u0275resolveComponentResources': (
      resolver: (url: string) => Promise<string>
    ) => Promise<void>;
  }
)['\u0275resolveComponentResources'];

const DATA_GRID_RESOURCE_ROOT = resolve(process.cwd(), 'src/app/shared/data-grid');
const DATA_GRID_RESOURCE_PATHS = new Map<string, string>([
  ['./data-grid.component.html', 'component/data-grid.component.html'],
  ['./data-grid.component.scss', 'component/data-grid.component.scss'],
  ['./column-menu.component.html', 'components/menus/column-menu.component.html'],
  ['./column-menu.component.scss', 'components/menus/column-menu.component.scss'],
  [
    './grid-calculate-footer.component.html',
    'components/footer/grid-calculate-footer.component.html'
  ],
  [
    './grid-calculate-footer.component.scss',
    'components/footer/grid-calculate-footer.component.scss'
  ],
  [
    './grid-selection-action-bar.component.html',
    'components/selection/grid-selection-action-bar.component.html'
  ],
  [
    './grid-selection-action-bar.component.scss',
    'components/selection/grid-selection-action-bar.component.scss'
  ]
]);

async function resolveDataGridResources(): Promise<void> {
  await resolveComponentResources((url: string) => {
    const resourcePath = DATA_GRID_RESOURCE_PATHS.get(url);
    if (!resourcePath) {
      throw new Error(`Unhandled DataGrid test resource: ${url}`);
    }
    return readFile(resolve(DATA_GRID_RESOURCE_ROOT, resourcePath), 'utf8');
  });
}

describe('DataGridComponent', () => {
  let component: DataGridComponent<TestRow>;
  let fixture: ComponentFixture<DataGridComponent<TestRow>>;
  let service: DataGridService;
  let canvasSpy: ReturnType<typeof vi.spyOn> | null = null;

  const columns: GridColumn<TestRow>[] = [
    { field: 'id', header: 'ID', sortable: true, filterable: true },
    { field: 'name', header: 'Name', sortable: true, filterable: true },
    { field: 'age', header: 'Age', type: 'number', sortable: true, filterable: true }
  ];

  const rows: TestRow[] = [
    { id: 1, name: 'Ahmed', age: 30 },
    { id: 2, name: 'Sara', age: 25 },
    { id: 3, name: 'Mona', age: 35 }
  ];

  const config: GridConfig = {
    pagination: true,
    pageSize: 10,
    selectable: true,
    selectMode: 'multiple',
    showFilter: true,
    exportable: true
  };

  function getHostElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function getViewportElement(): HTMLElement {
    const viewport = component.gridViewport?.nativeElement ?? null;
    expect(viewport).toBeTruthy();
    return viewport as HTMLElement;
  }

  function resetHostGridState(): HTMLElement {
    const host = getHostElement();
    host.classList.remove('dg-scrolling-v', 'dg-fast-scroll-x');
    return host;
  }

  beforeAll(() => {
    if (typeof HTMLCanvasElement !== 'undefined') {
      const proto = HTMLCanvasElement.prototype as HTMLCanvasElement;
      if (proto && typeof proto.getContext === 'function') {
        canvasSpy = vi.spyOn(proto, 'getContext').mockReturnValue(null);
      }
    }
  });

  afterAll(() => {
    canvasSpy?.mockRestore();
    canvasSpy = null;
  });

  beforeEach(async () => {
    await resolveDataGridResources();

    await TestBed.configureTestingModule({
      imports: [DataGridModule]
    }).compileComponents();

    fixture = TestBed.createComponent(DataGridComponent<TestRow>);
    component = fixture.componentInstance;
    service = fixture.componentRef.injector.get(DataGridService);

    component.columns = columns;
    component.data = rows;
    component.config = config;

    fixture.detectChanges();
    resetHostGridState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits change event on sort', () => {
    const emitSpy = vi.spyOn(component.onChange, 'emit');

    component.onSort(columns[2], new MouseEvent('click'));

    expect(emitSpy).toHaveBeenCalled();
    const event = emitSpy.mock.calls.at(-1)?.[0] as GridChangeEvent;
    expect(event.type).toBe('sort');
  });

  it('emits change event on filter', () => {
    const emitSpy = vi.spyOn(component.onChange, 'emit');

    component.onFilter(columns[1], 'Ahmed');

    expect(emitSpy).toHaveBeenCalled();
    const event = emitSpy.mock.calls.at(-1)?.[0] as GridChangeEvent;
    expect(event.type).toBe('filter');
  });

  it('reapplies active filters when a middle row changes', async () => {
    const internalComponent = component as unknown as {
      filterStates: {
        set: (
          value: Array<{
            field: string;
            operator: string;
            value: string;
            joinWithPrev?: 'and' | 'or';
          }>
        ) => void;
      };
      invalidateFilteredSortedCache: () => void;
      processedData: () => TestRow[];
    };

    internalComponent.filterStates.set([
      {
        field: 'name',
        operator: 'contains',
        value: 'sa',
        joinWithPrev: 'and'
      }
    ]);
    internalComponent.invalidateFilteredSortedCache();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const initialRows = internalComponent.processedData();
    expect(initialRows.map(row => row.name)).toEqual(['Sara']);

    fixture.componentRef.setInput('data', [rows[0], { ...rows[1], name: 'Laila' }, rows[2]]);
    await fixture.whenStable();
    fixture.detectChanges();

    const nextRows = internalComponent.processedData();
    expect(nextRows).toEqual([]);
  });

  it('clears cached cell values after a search-select handler mutates the row', () => {
    const searchColumn: GridColumn<TestRow> = {
      field: 'name',
      header: 'Name',
      cellType: 'search-select',
      searchSelect: {
        options: [{ label: 'Updated', value: 'updated' }],
        valueChange: (_value, row) => {
          row.name = 'Updated';
          row.age = 42;
        }
      }
    };
    const internalComponent = component as unknown as {
      cellValueCache: Map<string, unknown>;
      spreadsheetFormulaCache: Map<string, unknown>;
      columnRangeCache: Map<string, unknown>;
      columnStatsCache: Map<string, unknown>;
    };

    internalComponent.cellValueCache.set('1:age', 'stale');
    internalComponent.spreadsheetFormulaCache.set('formula', 'stale');
    internalComponent.columnRangeCache.set('name', { min: 1, max: 2 });
    internalComponent.columnStatsCache.set('name', { mean: 1, std: 0 });

    component.onSearchSelectValueChange(rows[0], searchColumn, { label: 'Updated' });

    expect(rows[0].name).toBe('Updated');
    expect(rows[0].age).toBe(42);
    expect(internalComponent.cellValueCache.size).toBe(0);
    expect(internalComponent.spreadsheetFormulaCache.size).toBe(0);
    expect(internalComponent.columnRangeCache.has('name')).toBe(false);
    expect(internalComponent.columnStatsCache.has('name')).toBe(false);
  });

  it('clears cached cell values after a search-select inline text commit', () => {
    const searchColumn: GridColumn<TestRow> = {
      field: 'name',
      header: 'Name',
      cellType: 'search-select',
      searchSelect: {
        options: [],
        inlineTextCommit: (value, row) => {
          row.name = value;
          row.age = 51;
        }
      }
    };
    const internalComponent = component as unknown as {
      cellValueCache: Map<string, unknown>;
      spreadsheetFormulaCache: Map<string, unknown>;
      columnRangeCache: Map<string, unknown>;
      columnStatsCache: Map<string, unknown>;
    };

    internalComponent.cellValueCache.set('1:name', 'stale');
    internalComponent.spreadsheetFormulaCache.set('formula', 'stale');
    internalComponent.columnRangeCache.set('name', { min: 1, max: 2 });
    internalComponent.columnStatsCache.set('name', { mean: 1, std: 0 });

    component.onSearchSelectInlineTextCommit(rows[0], searchColumn, 'Inline updated');

    expect(rows[0].name).toBe('Inline updated');
    expect(rows[0].age).toBe(51);
    expect(internalComponent.cellValueCache.size).toBe(0);
    expect(internalComponent.spreadsheetFormulaCache.size).toBe(0);
    expect(internalComponent.columnRangeCache.has('name')).toBe(false);
    expect(internalComponent.columnStatsCache.has('name')).toBe(false);
  });

  it('emits a normal edit when a search-select inline text commit has no custom handler', () => {
    const searchColumn: GridColumn<TestRow> = {
      field: 'name',
      header: 'Name',
      cellType: 'search-select',
      searchSelect: {
        options: []
      }
    };
    const editSpy = vi.spyOn(component.onCellEdit, 'emit');

    component.onSearchSelectInlineTextCommit(rows[0], searchColumn, 'Direct edit');

    expect(rows[0].name).toBe('Direct edit');
    expect(editSpy).toHaveBeenCalledWith({
      row: rows[0],
      field: 'name',
      value: 'Direct edit'
    });
  });

  it('refreshes rendered cell caches on demand', () => {
    const internalComponent = component as unknown as {
      cellValueCache: Map<string, unknown>;
      invalidateFilteredSortedCache: () => void;
    };
    const invalidateSpy = vi.spyOn(internalComponent, 'invalidateFilteredSortedCache');

    internalComponent.cellValueCache.set('1:name', 'stale');

    component.refreshRenderedCells();

    expect(internalComponent.cellValueCache.size).toBe(0);
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits selection change when toggling row selection', () => {
    const selectionSpy = vi.spyOn(component.onSelectionChange, 'emit');

    component.toggleRowSelection(rows[0]);

    expect(selectionSpy).toHaveBeenCalled();
    const selectedRows = selectionSpy.mock.calls.at(-1)?.[0] as TestRow[];
    expect(selectedRows.length).toBe(1);
    expect(selectedRows[0].id).toBe(1);
  });

  it('shows the selection edit action for selectable grids and respects explicit overrides', () => {
    expect(component.shouldShowSelectionBarEditAction()).toBe(true);

    const subscription = component.selectionBarEditRequested.subscribe(() => undefined);

    expect(component.shouldShowSelectionBarEditAction()).toBe(true);

    component.selectionBarShowEditAction = false;
    expect(component.shouldShowSelectionBarEditAction()).toBe(false);

    component.selectionBarShowEditAction = true;
    expect(component.shouldShowSelectionBarEditAction()).toBe(true);

    component.selectionBarShowEditAction = undefined;
    component.config = { ...config, selectable: false };
    expect(component.shouldShowSelectionBarEditAction()).toBe(false);

    subscription.unsubscribe();
  });

  it('keeps the selection edit action tied to grid selectability', () => {
    component.config = { ...config, selectable: false };
    expect(component.shouldShowSelectionBarEditAction()).toBe(false);

    component.columns = [{ ...columns[1], editable: true }];
    expect(component.shouldShowSelectionBarEditAction()).toBe(false);

    component.columns = columns;
    component.config = { ...config };
    expect(component.shouldShowSelectionBarEditAction()).toBe(true);

    component.config = {
      ...config,
      rowActions: [{ icon: 'pencil', label: 'Edit', action: () => undefined }]
    };
    component.replaceSelection([rows[0]], { emitChange: false });
    expect(component.shouldShowSelectionBarEditAction()).toBe(true);
  });

  it('shows the selection delete action for selectable grids and respects explicit overrides', () => {
    component.config = { ...config, remoteData: true };
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(true);

    const customSubscription = component.selectionBarDeleteRequested.subscribe(() => undefined);
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(true);

    component.selectionBarShowDeleteAction = false;
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(false);

    component.selectionBarShowDeleteAction = undefined;
    customSubscription.unsubscribe();
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(true);

    const batchSubscription = component.onBatchDelete.subscribe(() => undefined);
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(true);

    batchSubscription.unsubscribe();

    component.config = { ...config, remoteData: false };
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(true);

    component.config = { ...config, selectable: false };
    expect(component.shouldShowSelectionBarDeleteAction()).toBe(false);
  });

  it('emits page change event', () => {
    const emitSpy = vi.spyOn(component.onChange, 'emit');

    component.onPageChange(2);

    expect(emitSpy).toHaveBeenCalled();
    const event = emitSpy.mock.calls.at(-1)?.[0] as GridChangeEvent;
    expect(event.type).toBe('page');
  });

  it('does not emit cell actions for plain body-cell clicks', () => {
    const emitSpy = vi.spyOn(component.onCellAction, 'emit');

    component.handleCellClick(rows[0], columns[1], new MouseEvent('click'));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('keeps the row number visible after clicking an editable body cell', async () => {
    component.columns = [
      { field: 'id', header: 'ID', sortable: true, filterable: true },
      { field: 'name', header: 'Name', sortable: true, filterable: true, editable: true },
      { field: 'age', header: 'Age', type: 'number', sortable: true, filterable: true }
    ];
    component.config = {
      ...config,
      pagination: false,
      singleClickEdit: true
    };
    fixture.detectChanges();

    const host = getHostElement();
    const selectionIndex = host.querySelector(
      '.data-grid-table tbody tr.data-row td.selection-cell .selection-row-index'
    ) as HTMLElement | null;
    const editableCell = host.querySelector(
      '.data-grid-table tbody tr.data-row td:nth-child(3)'
    ) as HTMLTableCellElement | null;

    expect(selectionIndex?.textContent?.trim()).toBe('1');
    expect(editableCell).toBeTruthy();

    editableCell!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nextSelectionIndex = host.querySelector(
      '.data-grid-table tbody tr.data-row td.selection-cell .selection-row-index'
    ) as HTMLElement | null;

    expect(nextSelectionIndex?.textContent?.trim()).toBe('1');
  });

  it('commits an active cell edit when the editor loses focus', async () => {
    component.columns = [
      { field: 'id', header: 'ID', sortable: true, filterable: true },
      { field: 'name', header: 'Name', sortable: true, filterable: true, editable: true },
      { field: 'age', header: 'Age', type: 'number', sortable: true, filterable: true }
    ];
    component.config = {
      ...config,
      pagination: false,
      singleClickEdit: true
    };
    const editSpy = vi.spyOn(component.onCellEdit, 'emit');
    fixture.detectChanges();

    const host = getHostElement();
    const editableCell = host.querySelector(
      '.data-grid-table tbody tr.data-row td:nth-child(3)'
    ) as HTMLTableCellElement | null;
    expect(editableCell).toBeTruthy();

    editableCell!.click();
    fixture.detectChanges();

    const input = editableCell!.querySelector('.cell-editor-input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    input!.value = 'Updated name';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editSpy).toHaveBeenCalledWith({
      row: expect.objectContaining({ id: 1, name: 'Updated name' }),
      field: 'name',
      value: 'Updated name'
    });
  });

  it('exports csv through DataGridService', async () => {
    const csvSpy = vi.spyOn(service, 'exportToCSV').mockImplementation(() => undefined);

    await component.exportData('csv');

    expect(csvSpy).toHaveBeenCalled();
  });

  it('disables row and cell hover bindings by default', () => {
    resetHostGridState();
    component.config = { ...config };
    fixture.detectChanges();

    expect(component.shouldBindHeaderHoverState()).toBe(false);
    expect(component.shouldBindCellHoverEvents()).toBe(false);
    expect(component.shouldBindRowHoverState()).toBe(false);
  });

  it('publishes the unified default layout attribute automatically', () => {
    resetHostGridState();

    expect(getHostElement().getAttribute('data-grid-layout-preset')).toBe('default');
  });

  it('disables generic hover bindings when config.hover is false', () => {
    resetHostGridState();

    component.config = { ...config, hover: false };
    fixture.detectChanges();

    expect(component.shouldBindHeaderHoverState()).toBe(false);
    expect(component.shouldBindCellHoverEvents()).toBe(false);
    expect(component.shouldBindRowHoverState()).toBe(false);
  });

  it('clears hover-only visual state when hover is disabled', () => {
    resetHostGridState();

    const internalComponent = component as unknown as {
      activeTooltip: { set: (value: unknown) => void; (): unknown };
      hoveredRowIndex: { set: (value: number | null) => void; (): number | null };
      hoveredColumnField: { set: (value: string | null) => void; (): string | null };
      hoveredLinkEl: HTMLElement | null;
    };

    const hoveredLink = document.createElement('a');
    hoveredLink.style.setProperty('color', 'rgb(255 0 0)');
    hoveredLink.style.setProperty('-webkit-text-fill-color', 'rgb(255 0 0)');

    internalComponent.activeTooltip.set({ content: 'Name', x: 10, y: 10 });
    internalComponent.hoveredRowIndex.set(1);
    internalComponent.hoveredColumnField.set('name');
    internalComponent.hoveredLinkEl = hoveredLink;

    component.config = { ...config, hover: false };
    fixture.detectChanges();

    expect(internalComponent.activeTooltip()).toBeNull();
    expect(internalComponent.hoveredRowIndex()).toBeNull();
    expect(internalComponent.hoveredColumnField()).toBeNull();
    expect(internalComponent.hoveredLinkEl).toBeNull();
    expect(hoveredLink.style.getPropertyValue('color')).toBe('');
    expect(hoveredLink.style.getPropertyValue('-webkit-text-fill-color')).toBe('');
  });

  it('skips scroll hover suppression for unified default grids', () => {
    const host = resetHostGridState();
    const viewport = getViewportElement();

    component.config = { ...config };
    fixture.detectChanges();
    viewport.scrollLeft = 48;

    component.onGridContainerScroll({ target: viewport, type: 'scroll' } as unknown as Event);

    expect(host.classList.contains('dg-scrolling-v')).toBe(false);
    expect(host.classList.contains('dg-fast-scroll-x')).toBe(false);
  });

  it('uses the detached fixed-header path by default for unified grids', () => {
    resetHostGridState();
    const viewport = getViewportElement();

    component.config = {
      ...config
    };
    fixture.detectChanges();
    viewport.scrollLeft = 72;

    const host = getHostElement();
    const fixedHeader = host.querySelector('.fixed-table-header');
    const scrollableHeaderEnd = host.querySelector('.table-scroll .header-end-probe');

    expect(fixedHeader).toBeTruthy();
    expect(scrollableHeaderEnd).toBeNull();
  });

  it('uses the compact selection column width for default-grid grids', () => {
    component.config = { ...config };
    fixture.detectChanges();

    const internalComponent = component as unknown as { getSelectionColumnWidth(): number };

    expect(internalComponent.getSelectionColumnWidth()).toBe(44);
  });

  it('pins the selection column by default for unified grids', () => {
    component.config = { ...config };
    fixture.detectChanges();

    const host = getHostElement();
    const headerSelectionCell = host.querySelector('.header-table th.selection-cell');
    const bodySelectionCell = host.querySelector(
      '.data-grid-table tbody tr.data-row td.selection-cell'
    );

    expect(headerSelectionCell?.classList.contains('pinned-left')).toBe(true);
    expect(bodySelectionCell?.classList.contains('pinned-left')).toBe(true);
    expect(host.style.getPropertyValue('--dg-pinned-left-width').trim()).toBe('44px');
  });

  it('renders grouped rows while keeping the grouped column visible after grouping from the header menu flow', () => {
    const internalComponent = component as unknown as {
      displayRows: () => Array<{ kind: string; field?: string }>;
      visibleColumns: () => GridColumn<TestRow>[];
      groupedBlocks: () => Array<{ id: string }>;
      toggleGroupById: (id: string) => void;
    };

    component.groupByColumn(columns[1]);
    fixture.detectChanges();

    const firstBlockId = internalComponent.groupedBlocks()[0]?.id;
    if (firstBlockId) {
      internalComponent.toggleGroupById(firstBlockId);
      fixture.detectChanges();
    }

    const displayRows = internalComponent.displayRows();
    const visibleFields = internalComponent.visibleColumns().map(column => column.field);
    const groupRows = getHostElement().querySelectorAll('tr.group-row');
    const groupedContainers = getHostElement().querySelectorAll(
      'tr.group-body-wrapper .data-grid-table.subgroup tbody.grouped-display-body'
    );

    expect(displayRows.some(row => row.kind === 'group')).toBe(true);
    expect(displayRows[0]?.kind).toBe('group');
    expect(displayRows[0]?.field).toBe('name');
    expect(visibleFields).toContain('name');
    expect(groupRows.length).toBeGreaterThan(0);
    expect(groupedContainers.length).toBeGreaterThan(0);
  });

  it('uses remote group counts when grouped remote data includes server summaries', () => {
    const internalComponent = component as unknown as {
      groupedBlocks: () => Array<{ id: string; count: number }>;
    };

    component.config = { ...config, remoteData: true };
    component.remoteGroups = [{ field: 'name', key: 'Ahmed', value: 'Ahmed', count: 42 }];
    component.groupByColumn(columns[1]);
    component.data = [...rows];
    fixture.detectChanges();

    const block = internalComponent.groupedBlocks().find(group => group.id === 'name:Ahmed');

    expect(block?.count).toBe(42);

    component.remoteGroups = [{ field: 'name', key: 'Ahmed', value: 'Ahmed', count: 7 }];
    fixture.detectChanges();

    const updatedBlock = internalComponent.groupedBlocks().find(group => group.id === 'name:Ahmed');
    expect(updatedBlock?.count).toBe(7);
  });

  it('auto-virtualizes large single-column grouped grids even when page config disables virtual scroll', () => {
    const largeRows = Array.from({ length: 181 }, (_, index) => ({
      id: index + 1,
      name: index % 2 === 0 ? 'Group A' : 'Group B',
      age: 20 + (index % 40)
    }));
    const internalComponent = component as unknown as {
      shouldUseVirtualScroll: () => boolean;
    };

    component.data = largeRows;
    component.config = { ...config, virtualScroll: false, pageSize: 500 };
    component.groupByColumn(columns[1]);
    fixture.detectChanges();

    const host = getHostElement();

    expect(internalComponent.shouldUseVirtualScroll()).toBe(true);
    expect(host.querySelector('.grid-container')?.classList.contains('virtual-scroll')).toBe(true);
    expect(host.querySelector('.virtual-scroll-viewport')).toBeTruthy();
  });

  it('renders an empty grouped container state when a group filter removes all rows', () => {
    const internalComponent = component as unknown as {
      groupedBlocks: () => Array<{ id: string; rows: TestRow[] }>;
      toggleGroupById: (id: string) => void;
      setGroupFilterTerm: (id: string, value: string) => void;
    };

    component.groupByColumn(columns[1]);
    fixture.detectChanges();

    const firstBlockId = internalComponent.groupedBlocks()[0]?.id;
    expect(firstBlockId).toBeTruthy();

    internalComponent.toggleGroupById(firstBlockId!);
    fixture.detectChanges();

    internalComponent.setGroupFilterTerm(firstBlockId!, '__no_match__');
    fixture.detectChanges();

    const firstFilteredBlock = internalComponent.groupedBlocks()[0];
    expect(firstFilteredBlock?.rows.length).toBe(0);
  });

  it('renders the aggregate footer as a fixed footer band outside the body scroller', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(DataGridComponent<TestRow>);
    component = fixture.componentInstance;
    service = fixture.componentRef.injector.get(DataGridService);

    component.columns = columns;
    component.data = rows;
    component.config = config;

    component.aggregateFooter = {
      enabled: true,
      scope: 'filtered',
      results: {},
      currentOperation: column => (column.field === 'age' ? 'sum' : null)
    };

    fixture.detectChanges();

    resetHostGridState();
    component.config = {
      ...config
    };
    fixture.detectChanges();

    const host = getHostElement();
    const headerTable = host.querySelector('.header-table') as HTMLTableElement | null;
    const headerCols = Array.from(
      host.querySelectorAll('.header-table colgroup > col')
    ) as HTMLTableColElement[];
    let totalWidth = 0;
    headerCols.forEach((col, index) => {
      const width = index === 0 ? 44 : 160;
      col.style.width = `${width}px`;
      totalWidth += width;
    });
    if (headerTable && totalWidth > 0) {
      headerTable.style.width = `${totalWidth}px`;
      headerTable.style.minWidth = `${totalWidth}px`;
    }

    await fixture.whenStable();
    let calculateFooter: HTMLElement | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
      fixture.detectChanges();
      calculateFooter = getHostElement().querySelector(
        '.grid-footer-stack grid-calculate-footer .grid-calculate-footer__row'
      ) as HTMLElement | null;
      if (calculateFooter) {
        break;
      }
    }

    expect(calculateFooter).toBeTruthy();
    expect(getHostElement().querySelector('.table-scroll grid-calculate-footer')).toBeNull();
    expect(
      getHostElement().querySelector('.virtual-scroll-viewport grid-calculate-footer')
    ).toBeNull();
  });

  it('renders the calculate footer for internal aggregates even when pagination is disabled', async () => {
    resetHostGridState();
    fixture.componentRef.setInput(
      'columns',
      columns.map(column => (column.field === 'age' ? { ...column, aggregate: 'sum' as const } : column))
    );
    fixture.componentRef.setInput('config', {
      ...config,
      pagination: false
    });
    fixture.detectChanges();

    await fixture.whenStable();
    let calculateFooter: HTMLElement | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
      fixture.detectChanges();
      calculateFooter = getHostElement().querySelector(
        '.grid-footer-stack grid-calculate-footer .grid-calculate-footer__row'
      ) as HTMLElement | null;
      if (calculateFooter) {
        break;
      }
    }

    expect(calculateFooter).toBeTruthy();
    expect(getHostElement().querySelector('.grid-footer-stack .grid-pagination-footer')).toBeNull();
  });

  it('does not show a fake page count while remote pagination is loading', () => {
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('config', {
      ...config,
      remoteData: true,
      remoteCurrentPage: 1,
      remoteTotalRecords: 0
    });
    fixture.detectChanges();

    const pageIndicator = getHostElement().querySelector('.page-indicator');
    const nextButton = Array.from(getHostElement().querySelectorAll('.pagination-btn')).find(button =>
      button.textContent?.includes('Next')
    ) as HTMLButtonElement | undefined;

    expect(pageIndicator?.textContent?.trim()).toBe('Loading...');
    expect(pageIndicator?.textContent).not.toContain('Page 1 of 1');
    expect(nextButton?.disabled).toBe(true);
  });

  it('reserves the aggregate footer band before async aggregate inputs render', () => {
    fixture.componentRef.setInput('data', rows);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('config', {
      ...config,
      reserveAggregateFooterBand: true
    });
    fixture.detectChanges();

    const footerStack = getHostElement().querySelector('.grid-footer-stack');

    expect(footerStack).toBeTruthy();
    expect(footerStack?.classList.contains('has-aggregate-band')).toBe(true);
    expect(getHostElement().querySelector('grid-calculate-footer')).toBeNull();
  });

  it('does not render the native append row while the grid is loading', () => {
    const internalComponent = component as unknown as {
      displayRows: () => Array<{ kind: string; data?: Record<string, unknown> }>;
    };

    component.data = [];
    component.loading = true;
    component.columns = columns.map(column => ({ ...column, editable: true }));
    component.config = {
      ...config,
      appendRow: true
    };
    fixture.detectChanges();

    expect(
      internalComponent.displayRows().some(row => !!row.data?.['__appendRow'])
    ).toBe(false);

    component.loading = false;
    fixture.detectChanges();

    expect(
      internalComponent.displayRows().some(row => !!row.data?.['__appendRow'])
    ).toBe(true);
  });

  it('passes grid loading state to the internal calculate footer', async () => {
    component.data = rows;
    component.columns = columns.map(column =>
      column.field === 'age' ? { ...column, aggregate: 'sum' as const } : column
    );
    component.loading = true;
    component.config = {
      ...config
    };
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    const footer = fixture.debugElement.query(By.directive(GridCalculateFooterComponent))
      ?.componentInstance as GridCalculateFooterComponent<TestRow> | undefined;

    expect(footer?.config?.loading).toBe(true);
    expect(footer?.config?.loadingPrimaryText).toBe('...');
  });

  it('keeps the calculate footer hidden when pages disable it explicitly', () => {
    fixture.componentRef.setInput('aggregateFooter', {
      enabled: false,
      scope: 'filtered',
      results: {}
    });
    fixture.componentRef.setInput('config', {
      ...config,
      pagination: false
    });
    fixture.detectChanges();

    expect(getHostElement().querySelector('.grid-footer-stack')).toBeNull();
    expect(getHostElement().querySelector('grid-calculate-footer')).toBeNull();
  });

  it('keeps the calculate footer hidden until an internal aggregate is selected', () => {
    fixture.componentRef.setInput('config', {
      ...config,
      pagination: false
    });
    fixture.detectChanges();

    expect(getHostElement().querySelector('.grid-footer-stack')).toBeNull();
    expect(getHostElement().querySelector('grid-calculate-footer')).toBeNull();
  });

  it('handles calculate footer operations internally when no external config is provided', () => {
    const internalComponent = component as unknown as {
      effectiveAggregateFooter: () => { scope: string } | null;
      handleAggregateFooterChange: (event: {
        type: 'scope' | 'operation';
        scope?: 'page' | 'filtered' | 'all';
        column?: GridColumn<TestRow>;
        operation?: GridColumn<TestRow>['aggregate'] | null;
      }) => void;
      columns: GridColumn<TestRow>[];
    };

    internalComponent.handleAggregateFooterChange({
      type: 'operation',
      column: columns[2],
      operation: 'sum'
    });
    fixture.detectChanges();

    expect(internalComponent.columns.find(column => column.field === 'age')?.aggregate).toBe('sum');

    internalComponent.handleAggregateFooterChange({
      type: 'scope',
      scope: 'page'
    });
    fixture.detectChanges();

    expect(internalComponent.effectiveAggregateFooter()?.scope).toBe('page');
  });

  it('renders a detached fixed header above the body scroller by default', () => {
    component.config = {
      ...config,
      enableQuickFilter: true,
      rowActions: [{ icon: 'pencil', label: 'Edit', action: () => undefined }]
    };

    fixture.detectChanges();

    const host = getHostElement();
    const bodyTable = host.querySelector(
      '.table-scroll .data-grid-table'
    ) as HTMLTableElement | null;
    const fixedHeaderTable = host.querySelector(
      '.fixed-table-header .header-table'
    ) as HTMLTableElement | null;
    const nativeHeader = bodyTable?.querySelector('thead') as HTMLTableSectionElement | null;

    expect(bodyTable).toBeTruthy();
    expect(fixedHeaderTable).toBeTruthy();
    expect(nativeHeader).toBeTruthy();
    expect(bodyTable?.querySelectorAll('col').length).toBeGreaterThan(0);
    expect(fixedHeaderTable?.querySelectorAll('.header-row th').length).toBeGreaterThan(0);
  });

  it('projects header-end content only into the fixed header instance', async () => {
    @Component({
      // eslint-disable-next-line @angular-eslint/prefer-standalone
      standalone: false,
      template: `
        <engineers-salary-reference-data-grid [columns]="columns" [data]="data" [config]="config">
          <button grid-header-end class="header-end-probe">Probe</button>
        </engineers-salary-reference-data-grid>
      `
    })
    class HostComponent {
      columns = columns;
      data = rows;
      config: GridConfig = {
        ...config,
        rowActions: [{ icon: 'pencil', label: 'Edit', action: () => undefined }]
      };
    }

    @NgModule({
      declarations: [HostComponent],
      imports: [DataGridModule]
    })
    class HostTestModule {}

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostTestModule]
    }).compileComponents();

    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();

    const hostElement = hostFixture.nativeElement as HTMLElement;
    const probes = hostElement.querySelectorAll('.header-end-probe');

    expect(probes.length).toBe(1);
    expect(hostElement.querySelector('.fixed-table-header .header-end-probe')).toBeTruthy();
    expect(hostElement.querySelector('.table-scroll .header-end-probe')).toBeNull();
  });

  it('publishes the default-grid row-height variable from explicit config', () => {
    component.config = { ...config, rowHeight: 34 };
    fixture.detectChanges();

    const internalComponent = component as unknown as {
      gridRowHeightCssVar: string | null;
    };

    expect(internalComponent.gridRowHeightCssVar).toBe('34px');
  });

  it('uses the default-grid default body row height for virtual calculations when rowHeight is not explicit', () => {
    component.config = { ...config, virtualScroll: true };
    fixture.detectChanges();

    const internalComponent = component as unknown as {
      virtualRowHeight: number;
      gridRowHeightCssVar: string | null;
    };

    expect(internalComponent.gridRowHeightCssVar).toBe('28px');
    expect(internalComponent.virtualRowHeight).toBe(28);
  });

  it('keeps virtual calculations aligned with an explicit default-grid rowHeight', () => {
    component.config = {
      ...config,
      virtualScroll: true,
      rowHeight: 34
    };
    fixture.detectChanges();

    const internalComponent = component as unknown as {
      virtualRowHeight: number;
      gridRowHeightCssVar: string | null;
    };

    expect(internalComponent.gridRowHeightCssVar).toBe('34px');
    expect(internalComponent.virtualRowHeight).toBe(34);
  });

  it('honors the configured virtual row buffer instead of rendering the fixed legacy buffer', async () => {
    @Component({
      // eslint-disable-next-line @angular-eslint/prefer-standalone
      standalone: false,
      template: `<engineers-salary-reference-data-grid [columns]="columns" [data]="data" [config]="config" />`
    })
    class VirtualHostComponent {
      columns = columns;
      data = Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        name: `Engineer ${index + 1}`,
        age: 20 + (index % 40)
      }));
      config: GridConfig = {
        ...config,
        virtualScroll: true,
        virtualScrollBuffer: 4,
        rowHeight: 28
      };
    }

    @NgModule({
      declarations: [VirtualHostComponent],
      imports: [DataGridModule]
    })
    class VirtualHostTestModule {}

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VirtualHostTestModule]
    }).compileComponents();

    const hostFixture = TestBed.createComponent(VirtualHostComponent);
    hostFixture.detectChanges();
    const viewport = hostFixture.debugElement
      .query(By.css('.virtual-scroll-viewport'))
      .injector.get(CdkFixedSizeVirtualScroll);

    expect(viewport.minBufferPx).toBe(112);
    expect(viewport.maxBufferPx).toBe(224);
  });

  it('keeps row identity stable across remote refreshes when business-id tracking is enabled', () => {
    component.config = { ...config, trackRowsByBusinessId: true };
    const refreshedRowA: TestRow = { id: 77, name: 'Engineer', age: 30 };
    const refreshedRowB: TestRow = { id: 77, name: 'Engineer', age: 31 };

    const firstIdentity = component.trackByDataRow(0, refreshedRowA);
    const refreshedIdentity = component.trackByDataRow(0, refreshedRowB);

    expect(firstIdentity).toBe('id:77');
    expect(refreshedIdentity).toBe(firstIdentity);
  });
});
