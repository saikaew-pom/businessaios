/**
 * Middleware: auth, error handling, request ID
 */

import type { Context, Next } from 'hono';
import type { Bindings, Variables } from './types';
import { safeCompare } from './crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://businessaios-web.pskspace.workers.dev',
  'https://businessaios.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export async function requireAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const sessionToken = getSessionToken(c);
  if (!sessionToken) {
    return c.json({ error: 'unauthorized', message: 'Login required' }, 401);
  }

  const session = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.plan
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sessionToken, Date.now()).first<{
    id: string;
    user_id: string;
    expires_at: number;
    email: string;
    name: string | null;
    plan: string;
  }>();

  if (!session) {
    return c.json({ error: 'unauthorized', message: 'Invalid or expired session' }, 401);
  }

  c.set('user', {
    id: session.user_id,
    email: session.email,
    name: session.name,
    plan: session.plan,
  });

  await next();
}

/**
 * Require admin role — must be used after requireAuth.
 */
export async function requireAdmin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'unauthorized', message: 'Login required' }, 401);
  }

  const full = await c.env.DB.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).bind(user.id).first<{ role: string | null }>();

  if (full?.role !== 'admin') {
    return c.json({ error: 'forbidden', message: 'Admin access required' }, 403);
  }

  await next();
}

export function getUser(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  return c.get('user');
}

/**
 * Lightweight rate limiter — uses D1 to count requests per IP per minute.
 * For production-grade protection, use Cloudflare WAF rules.
 */
export async function rateLimit(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const bucket = Math.floor(Date.now() / 60000); // 1-minute buckets
  const key = `rl:${ip}:${bucket}`;

  const existing = await c.env.DB.prepare(
    'SELECT value FROM rate_limits WHERE key = ?'
  ).bind(key).first<{ value: number }>();

  const count = (existing?.value || 0) + 1;

  if (count > 30) {
    return c.json({ error: 'rate_limited', message: 'Too many requests, try again in 1 minute' }, 429);
  }

  if (existing) {
    await c.env.DB.prepare('UPDATE rate_limits SET value = ? WHERE key = ?').bind(count, key).run();
  } else {
    await c.env.DB.prepare('INSERT INTO rate_limits (key, value) VALUES (?, ?)').bind(key, count).run();
  }

  await next();
}

/**
 * Category-scoped rate limiter — same D1-bucket mechanism as `rateLimit`, but
 * keyed per (category, ip) with its own threshold, so e.g. uploads and
 * generations don't share one flat budget. Returns a middleware factory
 * rather than replacing `rateLimit` directly, since existing call sites
 * already use that as a bare middleware reference.
 */
export function categoryRateLimit(category: string, limit: number, windowMs = 60_000) {
  return async function rateLimitForCategory(
    c: Context<{ Bindings: Bindings; Variables: Variables }>,
    next: Next,
  ) {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rl:${category}:${ip}:${bucket}`;

    const existing = await c.env.DB.prepare(
      'SELECT value FROM rate_limits WHERE key = ?'
    ).bind(key).first<{ value: number }>();

    const count = (existing?.value || 0) + 1;

    if (count > limit) {
      return c.json({ error: 'rate_limited', message: `Too many ${category} requests, try again shortly` }, 429);
    }

    if (existing) {
      await c.env.DB.prepare('UPDATE rate_limits SET value = ? WHERE key = ?').bind(count, key).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO rate_limits (key, value, expires_at) VALUES (?, ?, ?)'
      ).bind(key, count, Date.now() + windowMs).run();
    }

    await next();
  };
}

export function getAllowedOrigins(env: Partial<Bindings>): string[] {
  const configured = [
    env.ALLOWED_ORIGIN,
    env.WEB_URL,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...configured, ...DEFAULT_ALLOWED_ORIGINS]));
}

export function getAllowedCorsOrigin(origin: string | undefined, env: Partial<Bindings>): string | null {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  return getAllowedOrigins(env).includes(normalized) ? normalized : null;
}

export function getSessionToken(c: Context<{ Bindings: Bindings; Variables: Variables }>): string | null {
  const cookieToken = getCookieSessionToken(c);
  if (cookieToken) return cookieToken;

  // From Authorization header (fallback)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function getCookieSessionToken(c: Context<{ Bindings: Bindings; Variables: Variables }>): string | null {
  // From cookie
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

export function setSessionCookie(c: Context<{ Bindings: Bindings; Variables: Variables }>, token: string, expiresAt: number) {
  c.header('Set-Cookie', buildSessionCookieHeader(token, expiresAt));
}

export function clearSessionCookie(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  c.header('Set-Cookie', buildClearSessionCookieHeader());
}

export function buildSessionCookieHeader(token: string, expiresAt: number): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}`;
}

export function buildClearSessionCookieHeader(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export async function getCsrfTokenForRequest(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<string | null> {
  const sessionToken = getCookieSessionToken(c);
  if (!sessionToken) return null;
  return createCsrfToken(c.env, sessionToken);
}

export async function requireCsrf(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  if (SAFE_METHODS.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }

  const sessionToken = getCookieSessionToken(c);
  if (!sessionToken) {
    await next();
    return;
  }

  const supplied = c.req.header('X-CSRF-Token') || c.req.header('x-csrf-token');
  if (!supplied) {
    return c.json({ error: 'csrf_required', message: 'CSRF token required' }, 403);
  }

  const expected = await createCsrfToken(c.env, sessionToken);
  if (!safeCompare(supplied, expected)) {
    return c.json({ error: 'csrf_invalid', message: 'Invalid CSRF token' }, 403);
  }

  await next();
}

export async function createCsrfToken(env: Partial<Bindings>, sessionToken: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getCsrfSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`csrf:${sessionToken}`));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}

function getCsrfSecret(env: Partial<Bindings>): string {
  return env.SESSION_SECRET || env.MASTER_ENCRYPTION_KEY || 'dev-secret';
}

function normalizeOrigin(origin: string | undefined | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin.trim());
    return url.origin;
  } catch {
    return null;
  }
}
