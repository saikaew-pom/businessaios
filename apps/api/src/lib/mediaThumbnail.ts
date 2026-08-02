import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';

// Longest-side cap for generated thumbnails, matching the R2 key convention
// documented in the plan (`media/{user_id}/.../thumbnail.webp`).
const THUMBNAIL_MAX_DIMENSION = 320;

/**
 * Real (not stubbed) thumbnail generation using Photon (WASM), resolved via
 * `@cf-wasm/photon`'s conditional exports — `workerd` build in production,
 * `node` build under the vitest test suite, same import either way.
 */
export function generateThumbnailWebp(bytes: Uint8Array): Uint8Array {
  const image = PhotonImage.new_from_byteslice(bytes);
  try {
    const width = image.get_width();
    const height = image.get_height();
    if (!width || !height) throw new Error('thumbnail_source_dimensions_unavailable');
    const scale = Math.min(1, THUMBNAIL_MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const resized = resize(image, targetWidth, targetHeight, SamplingFilter.Nearest);
    try {
      return resized.get_bytes_webp();
    } finally {
      resized.free();
    }
  } finally {
    image.free();
  }
}
