import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildPresentationHTML, buildPresentationPPTX, PresentationExportData } from '../src/lib/presentationExport';
import { getColorTheme } from '../src/lib/presentationPresets';

// A minimal valid 1x1 transparent PNG, used as a stand-in for a resolved AI image.
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
// A minimal valid 1x1 JPEG, used to confirm non-PNG mimes are embedded truthfully.
const TINY_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

function makeExportData(chart: any): PresentationExportData {
  return {
    project: { id: 'proj_1', title: 'ทดสอบ Export', objective: 'informative' },
    outline: { framework: 'scqa_minto', outline: [] },
    blueprint: {
      slides: [
        {
          slide_number: 1,
          type: 'story',
          layout: 'chart_text',
          title: 'ยอดขายรายไตรมาส',
          bullet_points: ['Q1 เติบโต 12%', 'Q2 ทรงตัว'],
          chart,
        },
      ],
    },
    notes: { slide_notes: [] },
    colorTheme: getColorTheme('business_blue'),
  };
}

function makeImageSlideExportData(slideOverrides: any): PresentationExportData {
  return {
    project: { id: 'proj_1', title: 'ทดสอบ Export', objective: 'story' },
    outline: { framework: 'popup_pitch', outline: [] },
    blueprint: { slides: [{ slide_number: 1, title: 'เปิดตัว', ...slideOverrides }] },
    notes: { slide_notes: [] },
    colorTheme: getColorTheme('business_blue'),
  };
}

describe('buildPresentationHTML — real chart rendering', () => {
  it('embeds an inline <svg> chart for a chart_text slide with normalizable data', () => {
    const html = buildPresentationHTML(makeExportData({ type: 'bar', data: [{ label: 'Q1', value: 10 }, { label: 'Q2', value: 20 }], highlight: 'Q2 โตสุด' }));
    expect(html).toContain('<svg');
    expect(html).toContain('Q2 โตสุด');
    expect(html).not.toContain('class="placeholder"');
  });

  it('falls back to the text placeholder when chart data does not normalize, without crashing', () => {
    const html = buildPresentationHTML(makeExportData({ type: 'bar', data: 'not an array' }));
    expect(html).toContain('class="placeholder"');
    expect(html).toContain('📊');
  });

  it('falls back gracefully when chart is entirely missing', () => {
    const html = buildPresentationHTML(makeExportData(undefined));
    expect(html).toContain('class="placeholder"');
  });
});

describe('buildPresentationPPTX — real chart rendering', () => {
  it('generates a valid pptx arraybuffer for a chart_text slide with normalizable data', async () => {
    const buf = await buildPresentationPPTX(makeExportData({ type: 'pie', data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }] }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw when chart data fails to normalize (falls back to a placeholder shape)', async () => {
    const buf = await buildPresentationPPTX(makeExportData({ type: 'bar', data: null }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('generates a valid pptx for a stacked bar chart with multiple series', async () => {
    const buf = await buildPresentationPPTX(makeExportData({
      type: 'stacked_bar',
      data: [{ label: 'Q1', product_a: 40, product_b: 60 }, { label: 'Q2', product_a: 55, product_b: 45 }],
    }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw when an explicit {labels, series} chart has a series shorter than labels', async () => {
    const buf = await buildPresentationPPTX(makeExportData({
      type: 'bar',
      data: { labels: ['a', 'b', 'c'], series: [{ name: 'x', values: [1, 2] }] },
    }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw when every pie value is zero (falls back to the placeholder shape)', async () => {
    const buf = await buildPresentationPPTX(makeExportData({ type: 'pie', data: [{ label: 'A', value: 0 }, { label: 'B', value: 0 }] }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});

describe('buildPresentationHTML — real AI image embedding', () => {
  it('uses a resolved image as the full-bleed background with a dark scrim, instead of the flat gradient', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'เปิดตัวผลิตภัณฑ์ใหม่',
      media_suggestion: { kind: 'image', resolved_image_base64: TINY_PNG_BASE64, resolved_image_mime: 'image/png' },
    }));
    expect(html).toContain(`data:image/png;base64,${TINY_PNG_BASE64}`);
    expect(html).toContain('background-image');
    expect(html).toContain('rgba(0,0,0,0.55)');
  });

  it('renders an inline <img> for a non-full-bleed image slide with a resolved image', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'ภาพประกอบ',
      media_suggestion: { kind: 'image', description: 'coffee shop interior', resolved_image_base64: TINY_PNG_BASE64, resolved_image_mime: 'image/png' },
    }));
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).not.toContain('class="placeholder"');
  });

  it('falls back to the text caption when no image has resolved yet (still generating, or never requested)', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'ภาพประกอบ',
      media_suggestion: { kind: 'image', description: 'coffee shop interior', generation_id: 'gen_still_processing' },
    }));
    expect(html).toContain('coffee shop interior');
    expect(html).not.toContain('<img src="data:');
  });

  it('treats an empty-string resolved_image_base64 as unresolved (falls back to the text caption, no crash)', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'ภาพประกอบ',
      media_suggestion: { kind: 'image', description: 'coffee shop interior', resolved_image_base64: '', resolved_image_mime: 'image/png' },
    }));
    expect(html).not.toContain('<img src="data:');
    expect(html).toContain('coffee shop interior');
  });

  it('treats a garbage (non-base64) resolved_image_base64 as unresolved instead of embedding it raw', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'Garbage image',
      media_suggestion: { kind: 'image', resolved_image_base64: 'not-valid-base64-!!!@@@###???', resolved_image_mime: 'image/png' },
    }));
    // Falls back to the flat gradient background instead of a broken data: URI.
    expect(html).not.toContain('background-image');
  });

  it('does not let a crafted mime type break out of the style="" attribute on a full-bleed slide (HTML/CSS injection)', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'Evil',
      media_suggestion: {
        kind: 'image', resolved_image_base64: TINY_PNG_BASE64,
        resolved_image_mime: 'image/png"><script>alert(1)</script><div style="',
      },
    }));
    expect(html).not.toContain('<script>alert(1)</script>');
    // The malformed mime doesn't match the allowlist, so it's normalized to
    // the safe default and the (validly base64-encoded) image still renders
    // as the background -- just with no trace of the injection payload.
    expect(html).toContain(`url('data:image/png;base64,${TINY_PNG_BASE64}')`);
    expect(html).not.toContain('div style=');
  });

  it('does not let a crafted mime type break out of the <img src=""> attribute (HTML/CSS injection)', () => {
    const html = buildPresentationHTML(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'Evil',
      media_suggestion: {
        kind: 'image', resolved_image_base64: TINY_PNG_BASE64,
        resolved_image_mime: 'image/png"><script>alert(2)</script><img x="',
      },
    }));
    expect(html).not.toContain('<script>alert(2)</script>');
    // The malformed mime doesn't match the allowlist, so it's normalized to
    // the safe default and the (validly base64-encoded) image still renders
    // -- just with no trace of the injection payload anywhere in the output.
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).not.toContain('img x=');
  });
});

describe('buildPresentationPPTX — real AI image embedding', () => {
  it('embeds the resolved image as the slide background for a full-bleed visual slide', async () => {
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'เปิดตัวผลิตภัณฑ์ใหม่',
      media_suggestion: { kind: 'image', resolved_image_base64: TINY_PNG_BASE64, resolved_image_mime: 'image/png' },
    }));
    const zip = await JSZip.loadAsync(buf);
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('embeds the resolved image inline for a non-full-bleed image slide', async () => {
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'ภาพประกอบ',
      media_suggestion: { kind: 'image', resolved_image_base64: TINY_PNG_BASE64, resolved_image_mime: 'image/png' },
    }));
    const zip = await JSZip.loadAsync(buf);
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('does not throw and uses the flat background when no image has resolved yet', async () => {
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'เปิดตัวผลิตภัณฑ์ใหม่',
      media_suggestion: { kind: 'image', generation_id: 'gen_still_processing' },
    }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw when resolved_image_base64 is not valid base64 (falls back to the flat background instead of crashing pptxgenjs/JSZip)', async () => {
    // Regression test: pptxgenjs's zip writer previously threw
    // "Invalid base64 input, bad content length" synchronously out of
    // buildPresentationPPTX() when handed a garbage base64 string, which
    // would 500 the whole export endpoint for one bad slide's image.
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'Garbage',
      media_suggestion: { kind: 'image', resolved_image_base64: 'not-valid-base64-!!!@@@###???', resolved_image_mime: 'image/png' },
    }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw when resolved_image_base64 is an empty string', async () => {
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'story', layout: 'story', title: 'Empty',
      media_suggestion: { kind: 'image', resolved_image_base64: '', resolved_image_mime: 'image/png' },
    }));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('embeds a non-PNG resolved image (JPEG) with a matching extension and real JPEG bytes, not mislabeled as .png', async () => {
    // Regression test: pptxgenjs's addBackgroundDefinition derives the
    // embedded media file's extension from `path` (defaulted to
    // 'preencoded.png' when only `data` is given), not from the mime inside
    // `data`. Verified by unzipping the .pptx: a JPEG background previously
    // came out named/typed as .png in the package while the bytes were still
    // genuinely JPEG -- a silently-corrupt-but-non-throwing export.
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'JPEG background',
      media_suggestion: { kind: 'image', resolved_image_base64: TINY_JPEG_BASE64, resolved_image_mime: 'image/jpeg' },
    }));
    const zip = await JSZip.loadAsync(buf);
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('ppt/media/') && !f.endsWith('/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
    expect(mediaFiles[0]).toMatch(/\.jpe?g$/i);
    const bytes = await zip.file(mediaFiles[0])!.async('uint8array');
    expect(bytes[0]).toBe(0xff); // JPEG magic number FF D8
    expect(bytes[1]).toBe(0xd8);
  });

  it('draws the full-bleed scrim shape behind the title text (shape added before text in slide XML/z-order)', async () => {
    const buf = await buildPresentationPPTX(makeImageSlideExportData({
      type: 'visual', layout: 'full_bleed', title: 'Z-order check',
      media_suggestion: { kind: 'image', resolved_image_base64: TINY_PNG_BASE64, resolved_image_mime: 'image/png' },
    }));
    const zip = await JSZip.loadAsync(buf);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('string');
    const shapeIdx = slideXml!.indexOf('<p:sp>');
    const titleIdx = slideXml!.indexOf('Z-order check');
    expect(shapeIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    // pptxgenjs stacks shapes/text in call order -- the scrim must be added
    // (and therefore appear earlier in the XML) before the title text run,
    // otherwise it would render on top of and hide the title.
    expect(shapeIdx).toBeLessThan(titleIdx);
  });
});
