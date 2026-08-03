import { describe, it, expect } from 'vitest';
import {
  normalizeChartData,
  chartFamilyForType,
  renderChartSvg,
  pptxChartSpec,
} from '../src/lib/presentationCharts';
import { getColorTheme } from '../src/lib/presentationPresets';

const theme = getColorTheme('business_blue');

describe('normalizeChartData', () => {
  it('normalizes {label, value} objects', () => {
    const result = normalizeChartData([
      { label: 'Q1', value: 100 },
      { label: 'Q2', value: 150 },
    ]);
    expect(result).toEqual({ labels: ['Q1', 'Q2'], series: [{ name: 'value', values: [100, 150] }] });
  });

  it('normalizes {name, amount} objects via fallback label/value key detection', () => {
    const result = normalizeChartData([
      { name: 'Coffee', amount: 40 },
      { name: 'Tea', amount: 60 },
    ]);
    expect(result).toEqual({ labels: ['Coffee', 'Tea'], series: [{ name: 'amount', values: [40, 60] }] });
  });

  it('treats multiple unnamed numeric keys as separate series (grouped/stacked)', () => {
    const result = normalizeChartData([
      { label: 'Q1', product_a: 40, product_b: 60 },
      { label: 'Q2', product_a: 55, product_b: 45 },
    ]);
    expect(result?.labels).toEqual(['Q1', 'Q2']);
    expect(result?.series).toEqual([
      { name: 'product_a', values: [40, 55] },
      { name: 'product_b', values: [60, 45] },
    ]);
  });

  it('normalizes a plain array of numbers', () => {
    const result = normalizeChartData([10, 20, 30]);
    expect(result).toEqual({ labels: ['#1', '#2', '#3'], series: [{ name: 'Value', values: [10, 20, 30] }] });
  });

  it('normalizes explicit {labels, series} shape', () => {
    const result = normalizeChartData({
      labels: ['Jan', 'Feb'],
      series: [{ name: 'Revenue', values: [100, 200] }],
    });
    expect(result).toEqual({ labels: ['Jan', 'Feb'], series: [{ name: 'Revenue', values: [100, 200] }] });
  });

  it('coerces numeric strings', () => {
    const result = normalizeChartData([{ label: 'A', value: '42' }]);
    expect(result?.series[0].values).toEqual([42]);
  });

  it('returns null for garbage AI output instead of throwing', () => {
    expect(normalizeChartData(undefined)).toBeNull();
    expect(normalizeChartData(null)).toBeNull();
    expect(normalizeChartData([])).toBeNull();
    expect(normalizeChartData('just a string')).toBeNull();
    expect(normalizeChartData([{ label: 'A', description: 'no numbers here' }])).toBeNull();
    expect(normalizeChartData([1, 'mixed', {}])).toBeNull();
    expect(normalizeChartData({ labels: ['A'], series: [] })).toBeNull();
  });

  it('aligns a series shorter than labels by padding with zeros (not a short/misindexed array)', () => {
    const result = normalizeChartData({ labels: ['a', 'b', 'c'], series: [{ name: 'x', values: [1, 2] }] });
    expect(result?.series[0].values).toEqual([1, 2, 0]);
  });

  it('aligns a series longer than labels by truncating extra values', () => {
    const result = normalizeChartData({ labels: ['a'], series: [{ name: 'x', values: [1, 2, 3] }] });
    expect(result?.series[0].values).toEqual([1]);
  });
});

describe('chartFamilyForType', () => {
  it('maps known families', () => {
    expect(chartFamilyForType('pie')).toBe('pie');
    expect(chartFamilyForType('doughnut')).toBe('pie');
    expect(chartFamilyForType('line')).toBe('line');
    expect(chartFamilyForType('area')).toBe('area');
    expect(chartFamilyForType('stacked_bar')).toBe('stacked_bar');
  });

  it('falls back to bar for exotic/unknown chart types', () => {
    expect(chartFamilyForType('treemap')).toBe('bar');
    expect(chartFamilyForType('sankey')).toBe('bar');
    expect(chartFamilyForType('heatmap')).toBe('bar');
    expect(chartFamilyForType('bullet')).toBe('bar');
    expect(chartFamilyForType(undefined)).toBe('bar');
  });
});

describe('renderChartSvg', () => {
  it('renders a bar chart svg with a bar per label', () => {
    const svg = renderChartSvg({ type: 'bar', data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] }, theme);
    expect(svg).toContain('<svg');
    expect((svg!.match(/<rect/g) || []).length).toBe(2);
  });

  it('renders a pie chart svg with a path per slice', () => {
    const svg = renderChartSvg({ type: 'pie', data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }] }, theme);
    expect(svg).toContain('<svg');
    expect((svg!.match(/<path/g) || []).length).toBe(2);
  });

  it('renders a single 100%-share pie slice as a filled full circle, not a degenerate zero-length arc', () => {
    // A single non-zero value gives the arc identical start/end points --
    // per the SVG spec that's equivalent to omitting the arc, so a naive
    // one-arc path silently draws nothing. Must render as two half-circle
    // arcs instead.
    const svg = renderChartSvg({ type: 'pie', data: [{ label: 'A', value: 100 }] }, theme);
    expect(svg).toContain('<path');
    expect(svg).toContain(theme.chart1);
  });

  it('falls back to null (not a blank chart) when every pie value is zero or negative', () => {
    expect(renderChartSvg({ type: 'pie', data: [{ label: 'A', value: 0 }, { label: 'B', value: 0 }] }, theme)).toBeNull();
    expect(renderChartSvg({ type: 'pie', data: [{ label: 'A', value: -5 }, { label: 'B', value: -10 }] }, theme)).toBeNull();
  });

  it('renders a line chart with a polyline path and point markers', () => {
    const svg = renderChartSvg({ type: 'line', data: [{ label: 'Jan', value: 5 }, { label: 'Feb', value: 15 }] }, theme);
    expect(svg).toContain('<svg');
    expect((svg!.match(/<circle/g) || []).length).toBe(2);
  });

  it('renders a stacked bar with one rect per series per label', () => {
    const svg = renderChartSvg({
      type: 'stacked_bar',
      data: [
        { label: 'Q1', product_a: 40, product_b: 60 },
        { label: 'Q2', product_a: 55, product_b: 45 },
      ],
    }, theme);
    expect((svg!.match(/<rect/g) || []).length).toBe(4);
  });

  it('uses the theme chart colors', () => {
    const svg = renderChartSvg({ type: 'bar', data: [{ label: 'A', value: 10 }] }, theme);
    expect(svg).toContain(theme.chart1);
  });

  it('returns null when chart is missing or data does not normalize', () => {
    expect(renderChartSvg(undefined, theme)).toBeNull();
    expect(renderChartSvg({ type: 'bar', data: undefined }, theme)).toBeNull();
    expect(renderChartSvg({ type: 'bar', data: 'garbage' as any }, theme)).toBeNull();
  });

  it('escapes label text to prevent XSS from AI-generated labels', () => {
    const svg = renderChartSvg({ type: 'bar', data: [{ label: '<script>alert(1)</script>', value: 5 }] }, theme);
    expect(svg).not.toContain('<script>');
  });

  it('truncates a long label at a Unicode code point boundary, never splitting an emoji surrogate pair', () => {
    const svg = renderChartSvg({ type: 'bar', data: [{ label: '123456789😀tail', value: 5 }] }, theme);
    const text = svg!.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] || '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        expect(text.charCodeAt(i + 1)).toBeGreaterThanOrEqual(0xdc00);
        expect(text.charCodeAt(i + 1)).toBeLessThanOrEqual(0xdfff);
      }
    }
  });
});

describe('pptxChartSpec', () => {
  it('builds a bar spec with clustered grouping by default', () => {
    const spec = pptxChartSpec({ type: 'bar', data: [{ label: 'A', value: 10 }] }, theme);
    expect(spec?.family).toBe('bar');
    expect(spec?.barGrouping).toBe('clustered');
    expect(spec?.data).toEqual([{ name: 'value', labels: ['A'], values: [10] }]);
  });

  it('builds a stacked bar spec with stacked grouping, mapped to the bar family', () => {
    const spec = pptxChartSpec({
      type: 'stacked_bar',
      data: [{ label: 'Q1', a: 1, b: 2 }],
    }, theme);
    expect(spec?.family).toBe('bar');
    expect(spec?.barGrouping).toBe('stacked');
    expect(spec?.data.length).toBe(2);
  });

  it('builds a pie spec using only the first series', () => {
    const spec = pptxChartSpec({ type: 'pie', data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }] }, theme);
    expect(spec?.family).toBe('pie');
    expect(spec?.data).toEqual([{ name: 'value', labels: ['A', 'B'], values: [30, 70] }]);
  });

  it('returns null for ungormalizable data', () => {
    expect(pptxChartSpec({ type: 'bar', data: [] }, theme)).toBeNull();
    expect(pptxChartSpec(undefined, theme)).toBeNull();
  });
});
