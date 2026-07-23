type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Data Processor Web Worker
 *
 * Offloads heavy computations to separate thread
 * Prevents UI blocking
 *
 * @example
 * ```typescript
 * const worker = new Worker(new URL('./data-processor.worker', import.meta.url));
 * worker.postMessage({ type: 'CALCULATE_SUM', data: numbers });
 * worker.onmessage = ({ data }) => console.log(data.result);
 * ```
 */

/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'CALCULATE_SUM':
      const sum = calculateSum(payload);
      postMessage({ type: 'CALCULATE_SUM_RESULT', result: sum });
      break;

    case 'PROCESS_LARGE_DATASET':
      const processed = processLargeDataset(payload);
      postMessage({ type: 'PROCESS_LARGE_DATASET_RESULT', result: processed });
      break;

    case 'FILTER_DATA':
      const filtered = filterData(payload.data, payload.filters);
      postMessage({ type: 'FILTER_DATA_RESULT', result: filtered });
      break;

    case 'SORT_DATA':
      const sorted = sortData(payload.data, payload.column, payload.direction);
      postMessage({ type: 'SORT_DATA_RESULT', result: sorted });
      break;

    case 'AGGREGATE_DATA':
      const aggregated = aggregateData(payload.data, payload.groupBy);
      postMessage({ type: 'AGGREGATE_DATA_RESULT', result: aggregated });
      break;

    case 'EXPORT_CSV':
      const csv = exportToCSV(payload);
      postMessage({ type: 'EXPORT_CSV_RESULT', result: csv });
      break;

    default:
      postMessage({ type: 'ERROR', error: `Unknown message type: ${type}` });
  }
});

// Helper functions
function calculateSum(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}

function processLargeDataset(data: LooseValue[]): LooseValue[] {
  // Simulate heavy processing
  return data.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now()
  }));
}

function filterData(data: LooseValue[], filters: Record<string, LooseValue>): LooseValue[] {
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (typeof value === 'string') {
        return item[key]?.toLowerCase().includes(value.toLowerCase());
      }
      return item[key] === value;
    });
  });
}

function sortData(data: LooseValue[], column: string, direction: 'asc' | 'desc'): LooseValue[] {
  return [...data].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    if (typeof aVal === 'string') {
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

function aggregateData(data: LooseValue[], groupBy: string): Record<string, LooseValue[]> {
  return data.reduce(
    (acc, item) => {
      const key = item[groupBy] || 'Unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, LooseValue[]>
  );
}

function exportToCSV(data: LooseValue[]): string {
  if (!data.length) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers
      .map(header => {
        const value = item[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
