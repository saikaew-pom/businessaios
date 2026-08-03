/**
 * vitest-only stand-in for satori's native `satori/yoga.wasm` import.
 * Production code imports that specifier directly — Wrangler's bundler
 * resolves `.wasm` imports to a precompiled WebAssembly.Module, which is
 * required in real Workers (see the comment in compositionRenderer.ts).
 * vitest runs under Node/Vite, not Wrangler, so this alias (configured in
 * vitest.config.ts) points the same import specifier at this file instead,
 * which compiles the identical wasm binary the normal Node way.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('satori/yoga.wasm');
export default new WebAssembly.Module(readFileSync(wasmPath));
