import app from '../web/.svelte-kit/cloudflare/_worker.js';

function shouldBypassHtmlCache(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_app/immutable/') || url.pathname === '/_app/version.json') return false;
  if (url.pathname === '/favicon.svg') return false;
  const accept = request.headers.get('accept') || '';
  return request.method === 'GET' && accept.includes('text/html');
}

export default {
  async fetch(request, env, ctx) {
    const bypassHtmlCache = shouldBypassHtmlCache(request);
    const nextRequest = bypassHtmlCache
      ? new Request(request, {
          headers: new Headers({
            ...Object.fromEntries(request.headers),
            'cache-control': 'no-cache',
          }),
        })
      : request;

    const response = await app.fetch(nextRequest, env, ctx);
    if (!bypassHtmlCache) return response;

    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
