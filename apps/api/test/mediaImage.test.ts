import { describe, expect, it } from 'vitest';
import { inspectImageBytes } from '../src/lib/mediaImage';

describe('media image inspection', () => {
  it('reads PNG dimensions from IHDR without full decode', () => {
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x03, 0x00,
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);

    expect(inspectImageBytes(bytes)).toMatchObject({
      ok: true,
      kind: 'png',
      mimeType: 'image/png',
      width: 1024,
      height: 768,
    });
  });

  it('reads JPEG dimensions from a SOF segment', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11,
      0x08,
      0x02, 0x58,
      0x03, 0x20,
      0x03, 0x01, 0x11, 0x00,
      0x02, 0x11, 0x00,
      0x03, 0x11, 0x00,
      0xff, 0xd9,
    ]);

    expect(inspectImageBytes(bytes)).toMatchObject({
      ok: true,
      kind: 'jpeg',
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
    });
  });

  it('reads WebP VP8X dimensions', () => {
    const bytes = new Uint8Array(30);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
    bytes.set([0xff, 0x03, 0x00], 24); // width - 1 = 1023
    bytes.set([0xff, 0x01, 0x00], 27); // height - 1 = 511

    expect(inspectImageBytes(bytes)).toMatchObject({
      ok: true,
      kind: 'webp',
      mimeType: 'image/webp',
      width: 1024,
      height: 512,
    });
  });

  it('rejects unsupported bytes and max-byte violations', () => {
    expect(inspectImageBytes(new Uint8Array([1, 2, 3]))).toMatchObject({ ok: false, error: 'unsupported_type' });
    expect(inspectImageBytes(new Uint8Array(12), { maxBytes: 8 })).toMatchObject({ ok: false, error: 'too_large' });
  });

  it('rejects images over max megapixels', () => {
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x20, 0x00,
      0x00, 0x00, 0x20, 0x00,
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);

    expect(inspectImageBytes(bytes, { maxMegapixels: 16 })).toMatchObject({ ok: false, error: 'too_many_pixels' });
  });
});
