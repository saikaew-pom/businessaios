import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `satori/yoga.wasm` and `@resvg/resvg-wasm/index_bg.wasm` are native
// bundler `.wasm` imports required for the composition renderer to work in
// real Cloudflare Workers (see the comment in compositionRenderer.ts).
// vitest runs under Vite/Node, not Wrangler, so it can't resolve those the
// same way — redirect them to Node-compatible shims instead.
export default defineConfig({
  resolve: {
    alias: {
      'satori/yoga.wasm': fileURLToPath(new URL('./test/helpers/yogaWasmShim.ts', import.meta.url)),
      '@resvg/resvg-wasm/index_bg.wasm': fileURLToPath(new URL('./test/helpers/resvgWasmShim.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
