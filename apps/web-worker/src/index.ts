/**
 * BusinessAiOs Web Worker
 * Serves SPA - assets + SPA fallback (no 307 redirect)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Skip API - they go to the API worker
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    // For known asset paths (have file extension or start with /_app/), serve from ASSETS
    // Otherwise serve index.html for SPA routing
    const isAsset =
      url.pathname.startsWith('/_app/') ||
      url.pathname === '/favicon.svg' ||
      /\.[a-zA-Z0-9]+$/.test(url.pathname);

    if (isAsset) {
      const response = await env.ASSETS.fetch(request);
      // If ASSETS returns 404 even for an asset path, fall through to index
      if (response.status !== 404) return response;
    }

    // SPA fallback - serve index.html with 200 (not 307 redirect)
    const indexUrl = new URL('/index.html', url.origin);
    const indexResponse = await env.ASSETS.fetch(indexUrl);
    const html = await indexResponse.text();

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
      },
    });
  },
};
