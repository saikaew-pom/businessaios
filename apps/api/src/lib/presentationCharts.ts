/**
 * Real chart rendering for the Presentation Builder's Step 7 blueprint output.
 *
 * Step 7's AI response includes a `chart: { type, data, highlight }` field per
 * slide, but `data`'s shape is only loosely specified in the prompt (it's AI
 * JSON, not a typed contract) — this module normalizes whatever shape shows
 * up into a single {labels, series} form before rendering, and returns null
 * rather than throwing when the shape can't be understood so callers can fall
 * back to the old text placeholder instead of crashing an export.
 */

import { ColorTheme } from './presentationPresets';

export type NormalizedChartSeries = { name: string; values: number[] };
export type NormalizedChart = { labels: string[]; series: NormalizedChartSeries[] };

const LABEL_KEYS = ['label', 'name', 'category', 'x', 'key'];
const VALUE_KEYS = ['value', 'y', 'amount', 'count', 'total'];

export function normalizeChartData(raw: any): NormalizedChart | null {
  if (!raw) return null;

  // {labels: [...], series: [{name, values|data}]}
  if (!Array.isArray(raw) && typeof raw === 'object' && Array.isArray(raw.series)) {
    const labels = Array.isArray(raw.labels) ? raw.labels.map((l: any) => String(l)) : [];
    const series = raw.series
      .map((s: any, i: number): { name: string; rawValues: number[] } => ({
        name: String(s?.name || s?.label || `Series ${i + 1}`),
        rawValues: (Array.isArray(s?.values) ? s.values : Array.isArray(s?.data) ? s.data : []).map(toNumber),
      }))
      .filter((s: { name: string; rawValues: number[] }) => s.rawValues.length > 0)
      // AI JSON commonly gives a series fewer or more values than there are
      // labels (typo'd row, truncated generation, etc). Renderers below index
      // values by label position, so an unaligned series either draws short
      // (harmless) or plots points past the chart's plot width, which get
      // silently clipped off-canvas -- align to labels.length here instead so
      // every series is always safe to index by label position.
      .map((s: { name: string; rawValues: number[] }): NormalizedChartSeries => ({ name: s.name, values: alignToLength(s.rawValues, labels.length) }));
    if (!labels.length || !series.length) return null;
    return { labels, series };
  }

  if (!Array.isArray(raw) || raw.length === 0) return null;

  // Plain array of numbers
  if (raw.every((d) => typeof d === 'number')) {
    return { labels: raw.map((_, i) => `#${i + 1}`), series: [{ name: 'Value', values: raw.map(toNumber) }] };
  }

  if (raw.some((d) => typeof d !== 'object' || d === null)) return null;

  // Array of objects: {label|name|category, value|...numericKeys}
  const labels: string[] = [];
  const numericKeys = new Set<string>();
  for (const row of raw) {
    const labelKey = LABEL_KEYS.find((k) => k in row);
    labels.push(labelKey ? String(row[labelKey]) : String(labels.length + 1));
    for (const [k, v] of Object.entries(row)) {
      if (LABEL_KEYS.includes(k)) continue;
      if (isNumeric(v)) numericKeys.add(k);
    }
  }
  if (!numericKeys.size) return null;

  const preferredKey = VALUE_KEYS.find((k) => numericKeys.has(k));
  const keysToUse = preferredKey ? [preferredKey] : [...numericKeys];
  const series: NormalizedChartSeries[] = keysToUse.map((k) => ({
    name: k,
    values: raw.map((row: any) => toNumber(row[k])),
  }));
  return { labels, series };
}

function isNumeric(v: any) {
  return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
}

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function alignToLength(values: number[], length: number): number[] {
  if (values.length === length) return values;
  if (values.length > length) return values.slice(0, length);
  return [...values, ...new Array(length - values.length).fill(0)];
}

export type ChartFamily = 'bar' | 'stacked_bar' | 'line' | 'area' | 'pie';

const PIE_TYPES = new Set(['pie', 'doughnut', 'donut']);
const LINE_TYPES = new Set(['line', 'slope', 'dot_plot']);
const AREA_TYPES = new Set(['area']);
const STACKED_TYPES = new Set(['stacked_bar']);

export function chartFamilyForType(type: string | undefined): ChartFamily {
  const t = (type || '').toLowerCase();
  if (PIE_TYPES.has(t)) return 'pie';
  if (LINE_TYPES.has(t)) return 'line';
  if (AREA_TYPES.has(t)) return 'area';
  if (STACKED_TYPES.has(t)) return 'stacked_bar';
  // Everything else (bar, grouped_bar, clustered_bar, bullet, treemap, sankey,
  // heatmap, ...) falls back to a grouped bar chart — a faithful bar reading
  // of the same normalized data beats a text-only placeholder for an exotic
  // chart type we don't render natively.
  return 'bar';
}

const CHART_SVG_WIDTH = 400;
const CHART_SVG_HEIGHT = 240;
const CHART_PADDING = { top: 16, right: 16, bottom: 32, left: 16 };

/** Renders a self-contained inline <svg> for the HTML export. Returns null when the chart data can't be normalized. */
export function renderChartSvg(
  chart: { type?: string; data?: any; highlight?: string } | undefined,
  colorTheme: ColorTheme,
): string | null {
  const normalized = normalizeChartData(chart?.data);
  if (!normalized || !normalized.labels.length) return null;
  const family = chartFamilyForType(chart?.type);
  const palette = [colorTheme.chart1, colorTheme.chart2, colorTheme.chart3, colorTheme.chart4, colorTheme.chart5];

  const plotW = CHART_SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  let body: string;
  if (family === 'pie') {
    body = renderPieSvg(normalized, palette, plotW, plotH);
  } else if (family === 'line' || family === 'area') {
    body = renderLineOrAreaSvg(normalized, palette, plotW, plotH, family === 'area');
  } else {
    body = renderBarSvg(normalized, palette, plotW, plotH, family === 'stacked_bar');
  }

  // A pie with every value <= 0 (all-zero, or all-negative after clamping)
  // produces no slices at all -- an empty <g>. That's a normalized chart that
  // still can't actually be rendered, so fall back to the text placeholder
  // the same way a null-normalize does, instead of shipping a blank box.
  // (Bar/line/area always emit at least an axis line, so this never fires
  // for them.)
  if (!body.trim()) return null;

  return `<svg viewBox="0 0 ${CHART_SVG_WIDTH} ${CHART_SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;max-height:260px;">
    <g transform="translate(${CHART_PADDING.left},${CHART_PADDING.top})">${body}</g>
  </svg>`;
}

function renderBarSvg(chart: NormalizedChart, palette: string[], w: number, h: number, stacked: boolean): string {
  const { labels, series } = chart;
  const maxTotal = stacked
    ? Math.max(1, ...labels.map((_, i) => series.reduce((sum, s) => sum + Math.max(0, s.values[i] || 0), 0)))
    : Math.max(1, ...series.flatMap((s) => s.values));

  const groupW = w / labels.length;
  const barGap = groupW * 0.18;
  const barsInGroup = stacked ? 1 : series.length;
  const barW = (groupW - barGap * 2) / Math.max(1, barsInGroup);

  const bars: string[] = [];
  labels.forEach((label, labelIdx) => {
    const groupX = labelIdx * groupW + barGap;
    if (stacked) {
      let yCursor = h;
      series.forEach((s, seriesIdx) => {
        const value = Math.max(0, s.values[labelIdx] || 0);
        const barH = (value / maxTotal) * h;
        yCursor -= barH;
        bars.push(`<rect x="${groupX.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${(groupW - barGap * 2).toFixed(1)}" height="${barH.toFixed(1)}" fill="${palette[seriesIdx % palette.length]}" rx="2" />`);
      });
    } else {
      series.forEach((s, seriesIdx) => {
        const value = Math.max(0, s.values[labelIdx] || 0);
        const barH = (value / maxTotal) * h;
        const x = groupX + seriesIdx * barW;
        bars.push(`<rect x="${x.toFixed(1)}" y="${(h - barH).toFixed(1)}" width="${(barW * 0.85).toFixed(1)}" height="${barH.toFixed(1)}" fill="${palette[seriesIdx % palette.length]}" rx="2" />`);
      });
    }
    const labelX = labelIdx * groupW + groupW / 2;
    bars.push(`<text x="${labelX.toFixed(1)}" y="${h + 16}" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.65">${escapeXml(truncate(label, 10))}</text>`);
  });
  bars.push(`<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="currentColor" stroke-opacity="0.2" />`);
  return bars.join('');
}

function renderLineOrAreaSvg(chart: NormalizedChart, palette: string[], w: number, h: number, filled: boolean): string {
  const { labels, series } = chart;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const stepX = labels.length > 1 ? w / (labels.length - 1) : w;

  const parts: string[] = [];
  series.forEach((s, seriesIdx) => {
    const points = s.values.map((v, i) => [i * stepX, h - (Math.max(0, v) / maxVal) * h] as const);
    const color = palette[seriesIdx % palette.length];
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    if (filled) {
      const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${h} L0,${h} Z`;
      parts.push(`<path d="${areaPath}" fill="${color}" fill-opacity="0.2" stroke="none" />`);
    }
    parts.push(`<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`);
    points.forEach((p) => parts.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${color}" />`));
  });
  labels.forEach((label, i) => {
    parts.push(`<text x="${(i * stepX).toFixed(1)}" y="${h + 16}" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.65">${escapeXml(truncate(label, 10))}</text>`);
  });
  parts.push(`<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="currentColor" stroke-opacity="0.2" />`);
  return parts.join('');
}

function renderPieSvg(chart: NormalizedChart, palette: string[], w: number, h: number): string {
  const values = chart.labels.map((_, i) => Math.max(0, chart.series[0]?.values[i] || 0));
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 4;

  let angleStart = -Math.PI / 2;
  const slices: string[] = [];
  values.forEach((value, i) => {
    const angleSize = (value / total) * Math.PI * 2;
    const angleEnd = angleStart + angleSize;
    if (value > 0) {
      // A single slice covering the (near-)full circle -- one category, or
      // every other value is 0 -- has an arc whose start and end points
      // coincide. Per the SVG spec, an elliptical-arc command whose endpoints
      // are identical is equivalent to omitting the arc entirely, so the
      // "obvious" one-arc path silently draws nothing (just the two radii and
      // a Z, i.e. a hairline, not a filled circle). Split it into two
      // half-circle arcs that share the two diametrically opposite points
      // instead, which every renderer draws correctly.
      const isFullCircle = angleSize >= Math.PI * 2 - 1e-6;
      const x1 = cx + radius * Math.cos(angleStart);
      const y1 = cy + radius * Math.sin(angleStart);
      let path: string;
      if (isFullCircle) {
        const midAngle = angleStart + Math.PI;
        const xMid = cx + radius * Math.cos(midAngle);
        const yMid = cy + radius * Math.sin(midAngle);
        path = `M${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 1 1 ${xMid.toFixed(1)},${yMid.toFixed(1)} A${radius},${radius} 0 1 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
      } else {
        const largeArc = angleSize > Math.PI ? 1 : 0;
        const x2 = cx + radius * Math.cos(angleEnd);
        const y2 = cy + radius * Math.sin(angleEnd);
        path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${largeArc} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
      }
      slices.push(`<path d="${path}" fill="${palette[i % palette.length]}" />`);
    }
    angleStart = angleEnd;
  });
  return slices.join('');
}

function truncate(s: string, max: number) {
  // Slicing by UTF-16 code unit (plain s.slice) can cut a surrogate pair in
  // half -- e.g. an emoji in an AI-generated label -- leaving a lone
  // surrogate embedded in the SVG string. That's invalid UTF-16 that gets
  // replaced with U+FFFD when the export is encoded to UTF-8, corrupting the
  // visible label. Array.from(s) iterates by Unicode code point instead, so
  // surrogate pairs are never split.
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
}

export type PptxChartSpec = {
  family: 'bar' | 'line' | 'pie' | 'area';
  data: Array<{ name: string; labels: string[]; values: number[] }>;
  barGrouping?: 'clustered' | 'stacked';
};

/** Builds the {family, data, options} shape presentationExport.ts needs to call PptxGenJS's addChart. Returns null when data can't be normalized. */
export function pptxChartSpec(chart: { type?: string; data?: any } | undefined, colorTheme: ColorTheme): PptxChartSpec | null {
  const normalized = normalizeChartData(chart?.data);
  if (!normalized || !normalized.labels.length) return null;
  const family = chartFamilyForType(chart?.type);

  if (family === 'pie') {
    const values = normalized.labels.map((_, i) => Math.max(0, normalized.series[0]?.values[i] || 0));
    // Same "all-zero/all-negative pie has nothing to show" guard as the SVG
    // renderer -- fall back to the placeholder instead of asking pptxgenjs to
    // draw a pie with nothing in it.
    if (values.every((v) => v <= 0)) return null;
    return { family: 'pie', data: [{ name: normalized.series[0]?.name || 'Value', labels: normalized.labels, values }] };
  }

  const pptxFamily: PptxChartSpec['family'] = family === 'stacked_bar' ? 'bar' : (family as PptxChartSpec['family']);
  return {
    family: pptxFamily,
    barGrouping: family === 'stacked_bar' ? 'stacked' : 'clustered',
    data: normalized.series.map((s) => ({ name: s.name, labels: normalized.labels, values: s.values })),
  };
}
