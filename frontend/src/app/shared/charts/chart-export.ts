type DownloadKind = 'png' | 'svg';

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadChart(svg: SVGSVGElement, name: string, kind: DownloadKind, scale = 2) {
  if (kind === 'svg') {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    if (!source.includes('xmlns=')) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${name}.svg`);
    return;
  }

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);
  if (!source.includes('xmlns=')) {
    source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  const img = new Image();
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, rect.width || svg.viewBox.baseVal.width || 1);
  const height = Math.max(1, rect.height || svg.viewBox.baseVal.height || 1);

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${name}.png`);
    });
  };
  img.src = svgUrl;
}

type CsvValue = string | number | boolean | null | undefined;

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(name: string, headers: string[], rows: CsvValue[][]): void {
  const lines: string[] = [];
  if (headers.length) {
    lines.push(headers.map(csvEscape).join(','));
  }
  rows.forEach(row => {
    lines.push(row.map(csvEscape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${name}.csv`);
}

function buildRowsFromObjects(items: Array<Record<string, unknown>>): {
  headers: string[];
  rows: CsvValue[][];
} {
  const headers: string[] = [];
  const headerSet = new Set<string>();
  items.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headers.push(key);
      }
    });
  });
  const rows = items.map(item => headers.map(header => normalizeCsvValue(item[header])));
  return { headers, rows };
}

function normalizeCsvValue(value: unknown): CsvValue {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value as CsvValue;
}

function flattenTree(
  node: Record<string, unknown>,
  parent: string | null,
  depth: number,
  rows: Record<string, unknown>[]
) {
  const id = String(node['id'] ?? node['label'] ?? '');
  rows.push({
    id,
    label: node['label'] ?? '',
    value: node['value'] ?? '',
    parent: parent ?? '',
    depth
  });
  const children = Array.isArray(node['children'])
    ? (node['children'] as Record<string, unknown>[])
    : [];
  children.forEach(child => flattenTree(child, id, depth + 1, rows));
}

export function downloadCsvSmart(name: string, payload: unknown): void {
  if (payload === null || payload === undefined) return;

  if (Array.isArray(payload)) {
    if (!payload.length) return;
    const first = payload[0];
    if (first === null || typeof first !== 'object') {
      const rows = payload.map((value, index) => [index, value as CsvValue]);
      downloadCsv(name, ['index', 'value'], rows);
      return;
    }
    const { headers, rows } = buildRowsFromObjects(payload as Array<Record<string, unknown>>);
    downloadCsv(name, headers, rows);
    return;
  }

  if (typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data['labels']) && Array.isArray(data['series'])) {
      const labels = data['labels'] as Array<string | number>;
      const series = data['series'] as Array<Record<string, unknown>>;
      const rows: CsvValue[][] = [];
      series.forEach(serie => {
        const seriesLabel = String(serie['label'] ?? 'Series');
        const values = Array.isArray(serie['values']) ? (serie['values'] as Array<CsvValue>) : [];
        labels.forEach((label, idx) => {
          rows.push([label, seriesLabel, values[idx] ?? 0]);
        });
      });
      downloadCsv(name, ['label', 'series', 'value'], rows);
      return;
    }
    if (Array.isArray(data['nodes']) && Array.isArray(data['links'])) {
      downloadCsvSmart(`${name}-nodes`, data['nodes']);
      downloadCsvSmart(`${name}-links`, data['links']);
      return;
    }
    if (Array.isArray(data['sets']) && Array.isArray(data['intersections'])) {
      downloadCsvSmart(`${name}-sets`, data['sets']);
      downloadCsvSmart(`${name}-intersections`, data['intersections']);
      return;
    }
    if (Array.isArray(data['lanes'])) {
      const rows: Record<string, unknown>[] = [];
      (data['lanes'] as Array<Record<string, unknown>>).forEach(lane => {
        const laneLabel = lane['label'] ?? '';
        const items = Array.isArray(lane['items'])
          ? (lane['items'] as Array<Record<string, unknown>>)
          : [];
        items.forEach(item => {
          rows.push({
            lane: laneLabel,
            label: item['label'] ?? '',
            start: item['start'] ?? '',
            end: item['end'] ?? ''
          });
        });
      });
      if (rows.length) {
        const built = buildRowsFromObjects(rows);
        downloadCsv(name, built.headers, built.rows);
      }
      return;
    }
    if (data['children']) {
      const rows: Record<string, unknown>[] = [];
      flattenTree(data, null, 0, rows);
      const built = buildRowsFromObjects(rows);
      downloadCsv(name, built.headers, built.rows);
      return;
    }
    if (Array.isArray(data['data'])) {
      downloadCsvSmart(name, data['data']);
      return;
    }
    downloadCsvSmart(name, [data]);
  }
}

export function inferCsvPayload(component: Record<string, unknown>): unknown {
  if (Array.isArray(component['data'])) return component['data'];
  if (Array.isArray(component['values'])) return component['values'];
  if (Array.isArray(component['labels']) && Array.isArray(component['series'])) {
    return { labels: component['labels'], series: component['series'] };
  }
  if (Array.isArray(component['axes']) && Array.isArray(component['series'])) {
    return { labels: component['axes'], series: component['series'] };
  }
  if (Array.isArray(component['nodes']) && Array.isArray(component['links'])) {
    return { nodes: component['nodes'], links: component['links'] };
  }
  if (Array.isArray(component['lanes'])) {
    return { lanes: component['lanes'] };
  }
  if (Array.isArray(component['sets']) && Array.isArray(component['intersections'])) {
    return { sets: component['sets'], intersections: component['intersections'] };
  }
  if (Array.isArray(component['sets']) && Array.isArray(component['data'])) {
    return { sets: component['sets'], data: component['data'] };
  }
  if (component['root']) return component['root'];
  if (component['data']) return component['data'];
  if (component['value'] !== undefined) return component;
  return null;
}
