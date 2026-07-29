import { describe, it, expect } from 'vitest';
import { EMBEDDED_THAI_FONT_CSS, EXPORT_FONT_STACK } from '../src/lib/exportFonts';

describe('exportFonts (Thai rendering fix for PDF/HTML/canvas exports)', () => {
  it('embeds all 6 weight/subset combinations as base64 woff2', () => {
    const matches = EMBEDDED_THAI_FONT_CSS.match(/data:font\/woff2;base64,/g) || [];
    expect(matches).toHaveLength(6);
  });

  it('declares Sarabun at weights 400, 600, and 700', () => {
    for (const w of [400, 600, 700]) {
      expect(EMBEDDED_THAI_FONT_CSS).toContain(`font-weight:${w}`);
    }
  });

  it('covers both a Thai and a Latin unicode-range per weight (mixed Thai+English text)', () => {
    const thaiRanges = EMBEDDED_THAI_FONT_CSS.match(/U\+0E01-0E5B/g) || [];
    expect(thaiRanges.length).toBeGreaterThanOrEqual(3); // one per weight
  });

  it('does not reference any external CDN — the whole point is offline/print/org-blocked safety', () => {
    expect(EMBEDDED_THAI_FONT_CSS).not.toMatch(/https?:\/\//);
  });

  it('EXPORT_FONT_STACK puts Sarabun first with real Thai system-font fallbacks', () => {
    expect(EXPORT_FONT_STACK.startsWith("'Sarabun'")).toBe(true);
    expect(EXPORT_FONT_STACK).toContain('TH Sarabun New');
  });
});
