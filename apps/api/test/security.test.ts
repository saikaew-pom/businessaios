import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createCsrfToken,
  getAllowedCorsOrigin,
  requireCsrf,
} from '../src/lib/middleware';

describe('CORS origin allowlist', () => {
  const env = {
    ALLOWED_ORIGIN: 'https://businessaios-web.pskspace.workers.dev,https://businessaios.pages.dev',
    WEB_URL: 'https://businessaios-web.pskspace.workers.dev',
  };

  it('allows configured exact origins', () => {
    expect(getAllowedCorsOrigin('https://businessaios-web.pskspace.workers.dev', env))
      .toBe('https://businessaios-web.pskspace.workers.dev');
  });

  it('rejects sibling workers.dev and pages.dev origins', () => {
    expect(getAllowedCorsOrigin('https://evil.pskspace.workers.dev', env)).toBeNull();
    expect(getAllowedCorsOrigin('https://evil.pages.dev', env)).toBeNull();
  });

  it('rejects localhost substring tricks', () => {
    expect(getAllowedCorsOrigin('https://localhost.evil.example', env)).toBeNull();
  });
});

describe('CSRF middleware', () => {
  const env = { SESSION_SECRET: 'test-secret' };

  function makeApp() {
    const app = new Hono();
    app.use('*', requireCsrf as any);
    app.post('/mutate', (c) => c.json({ ok: true }));
    return app;
  }

  it('allows unsafe requests without a session cookie', async () => {
    const res = await makeApp().request('/mutate', { method: 'POST' }, env);
    expect(res.status).toBe(200);
  });

  it('rejects cookie-authenticated unsafe requests without a CSRF token', async () => {
    const res = await makeApp().request('/mutate', {
      method: 'POST',
      headers: { Cookie: 'session=session-token' },
    }, env);
    expect(res.status).toBe(403);
  });

  it('allows cookie-authenticated unsafe requests with the matching CSRF token', async () => {
    const sessionToken = 'session-token';
    const csrfToken = await createCsrfToken(env, sessionToken);
    const res = await makeApp().request('/mutate', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionToken}`,
        'X-CSRF-Token': csrfToken,
      },
    }, env);
    expect(res.status).toBe(200);
  });
});
