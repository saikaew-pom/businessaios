/**
 * Middleware: auth, error handling, request ID
 */

import type { Context, Next } from 'hono';
import type { Bindings, Variables } from './types';
import { SESSION_TTL_MS } from './types';

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

export function getSessionToken(c: Context<{ Bindings: Bindings; Variables: Variables }>): string | null {
  // From cookie
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) return match[1];
  }

  // From Authorization header (fallback)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function setSessionCookie(c: Context<{ Bindings: Bindings; Variables: Variables }>, token: string, expiresAt: number) {
  c.header(
    'Set-Cookie',
    `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}`
  );
}

export function clearSessionCookie(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0');
}
