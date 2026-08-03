/**
 * vitest-only stand-in for `@resvg/resvg-wasm/index_bg.wasm`. See
 * yogaWasmShim.ts / compositionRenderer.ts for why production imports the
 * real `.wasm` specifier directly instead of this Node-only shim.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
export default new WebAssembly.Module(readFileSync(wasmPath));
