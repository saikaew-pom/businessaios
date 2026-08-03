import { describe, expect, it } from 'vitest';
import { PhotonImage } from '@cf-wasm/photon/node';
import { buildAnchorGroups, parseTemplateLayout, renderComposition, type LayoutBlock } from '../src/lib/creative/compositionRenderer';

// RGBA pixel at (x, y) from a decoded raw-pixel buffer — used to prove text
// actually landed where its anchor says, not just that *some* PNG came out.
function pixelAt(rawPixels: Uint8Array, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return { r: rawPixels[i], g: rawPixels[i + 1], b: rawPixels[i + 2], a: rawPixels[i + 3] };
}
function isNearWhite(p: { r: number; g: number; b: number }) {
  return p.r > 200 && p.g > 200 && p.b > 200;
}

const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4kWKEFTEMLQkAVkZXgTy9n4kAAAAASUVORK5CYII=';
function validPngBytes(): Uint8Array {
  return new Uint8Array(Buffer.from(VALID_PNG_BASE64, 'base64'));
}

// A photo-sized (not 8x8) buffer, to prove the base64 encode path inside
// the renderer doesn't blow the call stack via `String.fromCharCode(...bytes)`
// on a real-world image size.
function largeNoisyPngLikeBuffer(sizeBytes: number): Uint8Array {
  const bytes = new Uint8Array(sizeBytes);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) % 256;
  return bytes;
}

describe('compositionRenderer', () => {
  it('rejects a template layout missing required fields', () => {
    expect(() => parseTemplateLayout('{"canvas":{"width":1080}}')).toThrow('invalid_template_layout');
  });

  it('parses a well-formed template layout', () => {
    const layout = parseTemplateLayout('{"canvas":{"width":1080,"height":1080},"blocks":[]}');
    expect(layout.canvas.width).toBe(1080);
  });

  it('rejects a block with an anchor outside the known 9-position grid', () => {
    // Regression test: an unrecognized anchor used to sail through
    // validation and only fail later, deep inside buildInnerNode, with an
    // uncaught "Cannot read properties of undefined (reading 'textAlign')"
    // TypeError — this validates it at parse time instead, same as the
    // existing canvas/blocks shape checks above.
    const badLayout = JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      blocks: [{ type: 'headline', anchor: 'bogus-anchor', font_size: 48, color: '#fff' }],
    });
    expect(() => parseTemplateLayout(badLayout)).toThrow('invalid_template_layout');
  });

  it('rejects a block with an unknown type', () => {
    const badLayout = JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      blocks: [{ type: 'title', anchor: 'bottom-left', font_size: 48, color: '#fff' }],
    });
    expect(() => parseTemplateLayout(badLayout)).toThrow('invalid_template_layout');
  });

  it('renders a Thai headline + subheadline over a base image to a valid PNG', async () => {
    const layout = parseTemplateLayout(JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      background: { overlay_gradient: { direction: '180deg', stops: [{ offset: '45%', color: 'rgba(0,0,0,0)' }, { offset: '100%', color: 'rgba(0,0,0,0.82)' }] } },
      blocks: [
        { type: 'headline', anchor: 'bottom-left', font_size: 58, font_weight: 700, color: '#ffffff', max_width_pct: 88 },
        { type: 'subheadline', anchor: 'bottom-left', font_size: 26, font_weight: 400, color: '#e2e8f0', max_width_pct: 88 },
      ],
    }));

    const png = await renderComposition({
      layout,
      text: { headline: 'ก่อนใช้ ChatGPT ผมต้องปั่นงานถึงเที่ยงคืน', subheadline: 'ตอนนี้ปิดคอมได้ตั้งแต่ทุ่มตรง' },
      baseImageBytes: validPngBytes(),
      baseImageMimeType: 'image/png',
    });

    expect(png.length).toBeGreaterThan(1000);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });

  it('does not blow the call stack encoding a real photo-sized base image (~800KB)', async () => {
    const layout = parseTemplateLayout(JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      blocks: [{ type: 'headline', anchor: 'bottom-left', font_size: 48, font_weight: 700, color: '#fff' }],
    }));

    const png = await renderComposition({
      layout,
      text: { headline: 'ทดสอบภาพขนาดใหญ่' },
      baseImageBytes: largeNoisyPngLikeBuffer(800_000),
      baseImageMimeType: 'image/png',
    });

    expect(png.length).toBeGreaterThan(1000);
  });

  it('actually places a bottom-anchored headline near the bottom of the canvas, not the top', async () => {
    // Regression test for a real bug: satori silently drops the `inset`
    // shorthand, so an absolutely-positioned box sized to its content
    // instead of the full canvas — justifyContent had nothing to push
    // against, and "bottom-left" text rendered at the top instead.
    const layout = parseTemplateLayout(JSON.stringify({
      canvas: { width: 400, height: 400 },
      // Force a uniformly solid-black background regardless of the base
      // image's own (arbitrary, tiny-test-fixture) pixel colors, so the
      // only white pixels possible in the render are the glyph itself.
      background: { overlay_gradient: { direction: '180deg', stops: [{ offset: '0%', color: 'rgba(0,0,0,1)' }, { offset: '100%', color: 'rgba(0,0,0,1)' }] } },
      blocks: [{ type: 'headline', anchor: 'bottom-left', font_size: 48, font_weight: 700, color: '#ffffff' }],
    }));

    const png = await renderComposition({
      layout,
      text: { headline: 'X' },
      baseImageBytes: validPngBytes(),
      baseImageMimeType: 'image/png',
    });

    const image = PhotonImage.new_from_byteslice(png);
    try {
      const width = image.get_width();
      const height = image.get_height();
      const raw = image.get_raw_pixels();

      // Sample a horizontal strip near the top (should be plain background,
      // no white glyph pixels) vs. a band just above the 72px bottom padding
      // (should contain the white "X" glyph, since anchor is bottom-left).
      const rowHasWhite = (y: number) => Array.from({ length: width }, (_, x) => pixelAt(raw, width, x, y)).some(isNearWhite);
      const topHasWhite = rowHasWhite(20);
      const bottomHasWhite = [height - 80, height - 100, height - 120].some(rowHasWhite);

      expect(topHasWhite).toBe(false);
      expect(bottomHasWhite).toBe(true);
    } finally {
      image.free();
    }
  });

  it('renders a side-bar layout with a solid color block plus headline', async () => {
    const layout = parseTemplateLayout(JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      background: { side_bar: { width_pct: 38, color: '#0f172a' } },
      blocks: [{ type: 'headline', anchor: 'center-left', font_size: 48, font_weight: 700, color: '#ffffff', max_width_pct: 32, side_bar_only: true }],
    }));

    const png = await renderComposition({
      layout,
      text: { headline: 'Corporate Style' },
      baseImageBytes: validPngBytes(),
      baseImageMimeType: 'image/png',
    });

    expect(png.length).toBeGreaterThan(1000);
  });

  it('does not narrow the shared container when blocks sharing an anchor disagree on side_bar_only, regardless of order', () => {
    // Regression test: the container's width was previously decided by
    // whichever block for a given anchor happened to be FIRST in the array.
    // If a non-side-bar block came first, the shared container stayed
    // full-width, so the side-bar block's own `maxWidth: 100%` resolved
    // against that full-width container instead of the sidebar's own
    // (narrower) width — reintroducing the overflow bug the side-bar
    // special case exists to prevent.
    const nonSideBarFirst: LayoutBlock[] = [
      { type: 'subheadline', anchor: 'center-left', font_size: 20, color: '#fff', side_bar_only: false },
      { type: 'headline', anchor: 'center-left', font_size: 48, color: '#fff', side_bar_only: true },
    ];
    const sideBarFirst: LayoutBlock[] = [
      { type: 'headline', anchor: 'center-left', font_size: 48, color: '#fff', side_bar_only: true },
      { type: 'subheadline', anchor: 'center-left', font_size: 20, color: '#fff', side_bar_only: false },
    ];
    const text = { headline: 'Headline', subheadline: 'Sub' };

    const groupsA = buildAnchorGroups(nonSideBarFirst, text, 38);
    const groupsB = buildAnchorGroups(sideBarFirst, text, 38);

    // Both orderings must agree the shared container is NOT narrowed,
    // since the two blocks disagree on whether they belong in the sidebar.
    expect((groupsA[0].props.style as Record<string, unknown>).width).toBeUndefined();
    expect((groupsB[0].props.style as Record<string, unknown>).width).toBeUndefined();
  });

  it("narrows the shared container to the template's actual configured side_bar width_pct, not a hardcoded value", () => {
    // Regression test: the container width was previously hardcoded to
    // '38%' regardless of what the template's side_bar.width_pct actually
    // was, so it only happened to look right because every built-in seed
    // template uses exactly 38 — any template authored with a different
    // bar width (e.g. 25 or 45) got a text column that didn't match the
    // visible bar's real width at all.
    const blocks: LayoutBlock[] = [
      { type: 'headline', anchor: 'center-left', font_size: 48, color: '#fff', side_bar_only: true },
      { type: 'subheadline', anchor: 'center-left', font_size: 20, color: '#fff', side_bar_only: true },
    ];
    const text = { headline: 'Headline', subheadline: 'Sub' };

    const narrow = buildAnchorGroups(blocks, text, 25);
    const wide = buildAnchorGroups(blocks, text, 45);

    expect((narrow[0].props.style as Record<string, unknown>).width).toBe('25%');
    expect((wide[0].props.style as Record<string, unknown>).width).toBe('45%');
  });

  it('omits a block entirely when its text is empty rather than rendering an empty box', async () => {
    const layout = parseTemplateLayout(JSON.stringify({
      canvas: { width: 1080, height: 1080 },
      blocks: [
        { type: 'headline', anchor: 'bottom-left', font_size: 48, font_weight: 700, color: '#fff' },
        { type: 'subheadline', anchor: 'bottom-left', font_size: 24, font_weight: 400, color: '#fff' },
      ],
    }));

    // No subheadline provided — should render fine with just the headline.
    const png = await renderComposition({
      layout,
      text: { headline: 'Only headline' },
      baseImageBytes: validPngBytes(),
      baseImageMimeType: 'image/png',
    });
    expect(png.length).toBeGreaterThan(1000);
  });
});
