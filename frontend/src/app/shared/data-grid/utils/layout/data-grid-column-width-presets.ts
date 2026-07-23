const UNIFIED_DATA_GRID_COLUMN_WIDTHS = {
  primaryTitle: {
    width: 420,
    minWidth: 260,
    maxWidth: 720
  },
  wideText: {
    width: 220,
    minWidth: 160,
    maxWidth: 360
  },
  mediumText: {
    width: 170,
    minWidth: 140,
    maxWidth: 280
  },
  pillText: {
    width: 160,
    minWidth: 140,
    maxWidth: 240
  },
  compactText: {
    width: 150,
    minWidth: 130,
    maxWidth: 220
  },
  shortText: {
    width: 140,
    minWidth: 120,
    maxWidth: 200
  },
  currency: {
    width: 130,
    minWidth: 120,
    maxWidth: 180
  },
  narrowText: {
    width: 120,
    minWidth: 100,
    maxWidth: 160
  }
} as const;

export type UnifiedDataGridColumnWidthKey = keyof typeof UNIFIED_DATA_GRID_COLUMN_WIDTHS;

export function getUnifiedDataGridColumnWidth(key: UnifiedDataGridColumnWidthKey) {
  return {
    ...UNIFIED_DATA_GRID_COLUMN_WIDTHS[key],
    resizable: true
  };
}
