import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
      default_writer: 'wranglerangler',
    }),
    alias: {
      $lib: 'src/lib',
    },
    prerender: {
      handleHttpError: 'ignore',
      handleMissingId: 'ignore',
    },
  },
};

export default config;
