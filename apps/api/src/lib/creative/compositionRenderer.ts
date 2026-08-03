// Cloudflare Workers disallows compiling WebAssembly from raw bytes at
// runtime ("Wasm code generation disallowed by embedder") — only a
// precompiled WebAssembly.Module obtained via a native bundler `.wasm`
// import is allowed. Both satori's default build and @resvg/resvg-wasm's
// `initWasm` embed/decode their wasm as base64 at runtime, which works in
// Node but is rejected by the real Workers runtime. The standalone build
// (satori/standalone + explicit `init(yogaWasmModule)`) and importing
// @resvg/resvg-wasm's .wasm directly are the fix — same pattern already
// used by @cf-wasm/photon (see its dist/workerd.js) for the exact same
// reason. vitest resolves these two `.wasm` specifiers to Node-compatible
// shims (see vitest.config.ts) that produce an equivalent WebAssembly.Module.
import satori, { init as initSatoriYoga } from 'satori/standalone';
import yogaWasmModule from 'satori/yoga.wasm';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasmModule from '@resvg/resvg-wasm/index_bg.wasm';
import { PROMPT_BOLD_BASE64, PROMPT_REGULAR_BASE64 } from './fonts/promptBase64';

export type GradientStop = { offset: string; color: string };
export type Anchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type LayoutBlock = {
  type: 'headline' | 'subheadline' | 'badge';
  anchor: Anchor;
  font_size: number;
  font_weight?: 400 | 700;
  color: string;
  max_width_pct?: number;
  text_align?: 'left' | 'center' | 'right';
  background_color?: string;
  card_background?: string;
  card_padding?: number;
  side_bar_only?: boolean;
};

export type TemplateLayout = {
  canvas: { width: number; height: number };
  background?: {
    overlay_gradient?: { direction: string; stops: GradientStop[] };
    side_bar?: { width_pct: number; color: string };
  };
  blocks: LayoutBlock[];
};

export type CompositionText = {
  headline?: string;
  subheadline?: string;
  badge?: string;
};

const ANCHOR_STYLE: Record<Anchor, { justifyContent: string; alignItems: string; textAlign: 'left' | 'center' | 'right' }> = {
  'top-left': { justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left' },
  'top-center': { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' },
  'top-right': { justifyContent: 'flex-start', alignItems: 'flex-end', textAlign: 'right' },
  'center-left': { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' },
  center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  'center-right': { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right' },
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end', textAlign: 'right' },
};

let wasmReady: Promise<void> | null = null;
function ensureWasmInit(): Promise<void> {
  if (!wasmReady) {
    wasmReady = Promise.all([
      initSatoriYoga(yogaWasmModule as unknown as WebAssembly.Module),
      initWasm(resvgWasmModule as unknown as WebAssembly.Module),
    ]).then(() => undefined);
  }
  return wasmReady;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// `String.fromCharCode(...bytes)` blows the call stack on real photo-sized
// buffers (spreads one arg per byte) — encode in fixed-size chunks instead.
const BASE64_CHUNK_SIZE = 8192;
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function textForBlock(block: LayoutBlock, text: CompositionText): string {
  if (block.type === 'headline') return text.headline || '';
  if (block.type === 'subheadline') return text.subheadline || '';
  return text.badge || '';
}

function buildBackgroundStyle(layout: TemplateLayout, baseImageDataUri: string): Record<string, unknown> {
  const style: Record<string, unknown> = {
    width: `${layout.canvas.width}px`,
    height: `${layout.canvas.height}px`,
    display: 'flex',
    position: 'relative',
    backgroundImage: `url(${baseImageDataUri})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  if (layout.background?.overlay_gradient) {
    const { direction, stops } = layout.background.overlay_gradient;
    const stopStr = stops.map((s) => `${s.color} ${s.offset}`).join(', ');
    style.backgroundImage = `linear-gradient(${direction}, ${stopStr}), url(${baseImageDataUri})`;
  }
  return style;
}

function buildInnerNode(block: LayoutBlock, content: string) {
  const anchorStyle = ANCHOR_STYLE[block.anchor];
  const innerStyle: Record<string, unknown> = {
    display: 'flex',
    color: block.color,
    fontSize: block.font_size,
    fontWeight: block.font_weight || 700,
    fontFamily: 'Prompt',
    lineHeight: 1.25,
    // `max_width_pct` is authored relative to the full canvas — but for a
    // side-bar block, the anchor-group container is already narrowed to
    // the bar's own width, so re-applying a canvas-relative percentage on
    // top of that compounds into a much narrower box than intended (e.g.
    // 32% of a 38%-wide bar ≈ 12% of the canvas), wrapping almost every
    // word onto its own line. The bar's width already IS the constraint.
    maxWidth: block.side_bar_only ? '100%' : `${block.max_width_pct || 90}%`,
    textAlign: block.text_align || anchorStyle.textAlign,
    whiteSpace: 'pre-wrap',
  };
  if (block.type === 'badge' || block.background_color) {
    innerStyle.background = block.background_color || 'rgba(0,0,0,0.6)';
    innerStyle.padding = '10px 22px';
    innerStyle.borderRadius = '999px';
  }
  if (block.card_background) {
    innerStyle.background = block.card_background;
    innerStyle.padding = `${block.card_padding ?? 48}px`;
    innerStyle.borderRadius = '24px';
  }
  return { type: 'div', props: { style: innerStyle, children: content } };
}

/**
 * Blocks sharing the same anchor (e.g. headline + subheadline both
 * bottom-left) must stack in ONE flex column, not each get their own
 * absolutely-positioned full-canvas container — otherwise every block
 * independently hugs the same corner and they render on top of each other.
 */
export function buildAnchorGroups(blocks: LayoutBlock[], text: CompositionText, sideBarWidthPct?: number) {
  const groups = new Map<Anchor, { anchorStyle: (typeof ANCHOR_STYLE)[Anchor]; sideBarOnly: boolean; children: ReturnType<typeof buildInnerNode>[] }>();
  for (const block of blocks) {
    const content = textForBlock(block, text);
    if (!content) continue;
    const existing = groups.get(block.anchor);
    const node = buildInnerNode(block, content);
    if (existing) {
      existing.children.push(node);
      // The shared container can only be narrowed to the sidebar's own
      // width if EVERY block sharing this anchor agrees it belongs in the
      // sidebar. Using just the first block seen (order-dependent) meant a
      // template listing a non-side-bar block before a side-bar one for the
      // same anchor left the container un-narrowed, so the side-bar block's
      // own `maxWidth: 100%` (100% of an un-narrowed, near-full-canvas
      // container) reintroduced the exact overflow the side-bar special
      // case exists to prevent. Defaulting to "not narrowed" on disagreement
      // is the safe direction: it can only make a box wider than intended,
      // never push text outside the container's own bounds.
      existing.sideBarOnly = existing.sideBarOnly && !!block.side_bar_only;
    } else {
      groups.set(block.anchor, { anchorStyle: ANCHOR_STYLE[block.anchor], sideBarOnly: !!block.side_bar_only, children: [node] });
    }
  }

  return Array.from(groups.values()).map((group) => {
    const style: Record<string, unknown> = {
      position: 'absolute',
      // satori doesn't support the `inset` shorthand (silently drops it,
      // so the box sizes to its content instead of the full canvas and
      // justifyContent has nothing to push against) — spell out all four
      // sides explicitly instead.
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: group.anchorStyle.justifyContent,
      alignItems: group.anchorStyle.alignItems,
      gap: '16px',
      padding: '72px',
    };
    // satori's style expander chokes on explicit `undefined` values, so this
    // key must be absent entirely rather than set to undefined when unused.
    //
    // This must match the ACTUAL configured side_bar.width_pct (passed in
    // from renderComposition, which is also what draws the visible bar
    // itself), not a fixed guess — a template authored with e.g. a 25% or
    // 45% bar previously got its text container hardcoded to 38% regardless,
    // so the text column didn't match the bar's real width for any
    // non-38%-wide side bar.
    if (group.sideBarOnly && sideBarWidthPct != null) style.width = `${sideBarWidthPct}%`;
    return { type: 'div', props: { style, children: group.children } };
  });
}

/**
 * Renders a template layout + dynamic text onto a base image, entirely
 * within the Workers runtime: satori lays out flexbox + typography and
 * traces text into vector glyph paths (so it never depends on the viewer
 * having the font installed — critical for Thai, which Photon's built-in
 * draw_text() can't render with a custom font at all), then resvg-wasm
 * rasterizes the resulting SVG to PNG.
 */
export async function renderComposition(params: {
  layout: TemplateLayout;
  text: CompositionText;
  baseImageBytes: Uint8Array;
  baseImageMimeType: string;
}): Promise<Uint8Array> {
  const { layout, text, baseImageBytes, baseImageMimeType } = params;
  await ensureWasmInit();

  const baseImageDataUri = `data:${baseImageMimeType};base64,${bytesToBase64(baseImageBytes)}`;

  const sideBar = layout.background?.side_bar;
  const children = [
    sideBar
      ? {
          type: 'div',
          props: {
            style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${sideBar.width_pct}%`, background: sideBar.color, display: 'flex' },
          },
        }
      : null,
    ...buildAnchorGroups(layout.blocks, text, sideBar?.width_pct),
  ].filter(Boolean);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: buildBackgroundStyle(layout, baseImageDataUri),
        children,
      },
    },
    {
      width: layout.canvas.width,
      height: layout.canvas.height,
      fonts: [
        { name: 'Prompt', data: base64ToBytes(PROMPT_BOLD_BASE64).buffer as ArrayBuffer, weight: 700, style: 'normal' },
        { name: 'Prompt', data: base64ToBytes(PROMPT_REGULAR_BASE64).buffer as ArrayBuffer, weight: 400, style: 'normal' },
      ],
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: layout.canvas.width } });
  return resvg.render().asPng();
}

const VALID_BLOCK_TYPES = new Set(['headline', 'subheadline', 'badge']);

export function parseTemplateLayout(layoutJson: string): TemplateLayout {
  const parsed = JSON.parse(layoutJson);
  if (!parsed?.canvas?.width || !parsed?.canvas?.height || !Array.isArray(parsed?.blocks)) {
    throw new Error('invalid_template_layout');
  }
  // Every block must have a type and anchor buildInnerNode/ANCHOR_STYLE
  // actually know how to handle — otherwise `ANCHOR_STYLE[block.anchor]`
  // resolves to `undefined` and the very next property read
  // (`anchorStyle.textAlign`) crashes with an uncaught TypeError deep inside
  // rendering, well past this function's own validation checks.
  const hasValidBlocks = (parsed.blocks as unknown[]).every(
    (block) =>
      block != null &&
      typeof block === 'object' &&
      VALID_BLOCK_TYPES.has((block as { type?: unknown }).type as string) &&
      Object.prototype.hasOwnProperty.call(ANCHOR_STYLE, (block as { anchor?: unknown }).anchor as string),
  );
  if (!hasValidBlocks) {
    throw new Error('invalid_template_layout');
  }
  return parsed as TemplateLayout;
}
