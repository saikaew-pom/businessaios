// Wrangler's bundler resolves `.wasm` imports natively to a precompiled
// WebAssembly.Module (required for Workers — see compositionRenderer.ts).
// TypeScript has no built-in knowledge of this module type.
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
