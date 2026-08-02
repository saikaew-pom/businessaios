export type SupportedImageKind = 'jpeg' | 'png' | 'webp';

export type ImageInspection = {
  ok: true;
  kind: SupportedImageKind;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  bytes: number;
  megapixels: number;
} | {
  ok: false;
  error: 'empty' | 'unsupported_type' | 'dimensions_not_found' | 'too_large' | 'too_many_pixels';
  bytes: number;
};

export type ImageInspectionOptions = {
  maxBytes?: number;
  maxMegapixels?: number;
};

type ParsedImageMetadata = {
  kind: SupportedImageKind;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
};

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_MEGAPIXELS = 16;

export function inspectImageBytes(bytes: Uint8Array, options: ImageInspectionOptions = {}): ImageInspection {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxMegapixels = options.maxMegapixels ?? DEFAULT_MAX_MEGAPIXELS;

  if (!bytes.length) return { ok: false, error: 'empty', bytes: 0 };
  if (bytes.length > maxBytes) return { ok: false, error: 'too_large', bytes: bytes.length };

  const parsed = parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes);
  if (!parsed) return { ok: false, error: 'unsupported_type', bytes: bytes.length };
  if (!parsed.width || !parsed.height) return { ok: false, error: 'dimensions_not_found', bytes: bytes.length };

  const megapixels = (parsed.width * parsed.height) / 1_000_000;
  if (megapixels > maxMegapixels) return { ok: false, error: 'too_many_pixels', bytes: bytes.length };

  return {
    ok: true,
    ...parsed,
    bytes: bytes.length,
    megapixels: Number(megapixels.toFixed(4)),
  };
}

function parsePng(bytes: Uint8Array): ParsedImageMetadata | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 16) !== 'IHDR') return null;
  return {
    kind: 'png',
    mimeType: 'image/png',
    extension: 'png',
    width: readU32BE(bytes, 16),
    height: readU32BE(bytes, 20),
  };
}

function parseJpeg(bytes: Uint8Array): ParsedImageMetadata | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = bytes[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const segmentLength = readU16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;

    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return {
        kind: 'jpeg',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        height: readU16BE(bytes, offset + 3),
        width: readU16BE(bytes, offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebp(bytes: Uint8Array): ParsedImageMetadata | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 16);

  if (chunk === 'VP8X' && bytes.length >= 30) {
    return {
      kind: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      width: 1 + readU24LE(bytes, 24),
      height: 1 + readU24LE(bytes, 27),
    };
  }

  if (chunk === 'VP8 ' && bytes.length >= 30) {
    return {
      kind: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      width: readU16LE(bytes, 26) & 0x3fff,
      height: readU16LE(bytes, 28) & 0x3fff,
    };
  }

  if (chunk === 'VP8L' && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return {
      kind: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + ((b3 << 6) | (b2 >> 2) | ((b1 & 0xc0) << 6)),
    };
  }

  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
