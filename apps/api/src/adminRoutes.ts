/**
 * Admin panel routes (users, credits, stats, email log) — requireAdmin-gated.
 * Extracted out of index.ts (M1 refactor, 2026-07-29).
 */
import type { Hono } from 'hono';
import { requireAuth, requireAdmin } from './lib/middleware';
import { generateId } from './lib/crypto';
import { addCredits, deductCredits, getCredits } from './lib/credit';
import type { Bindings, Variables } from './lib/types';

export function createAdminRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {

// =====================================================
// Admin (Super Admin)
// =====================================================

app.get('/api/admin/users', requireAuth, requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT id, email, name, first_name, last_name, role, plan, credits, email_verified, two_factor_enabled, created_at
    FROM users ORDER BY created_at DESC LIMIT 200
  `).all();
  return c.json({ users: rows.results || [] });
});

app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ role?: string; plan?: string; credits?: number }>();

  const updates: string[] = [];
  const values: any[] = [];
  if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
  if (body.plan !== undefined) { updates.push('plan = ?'); values.push(body.plan); }
  if (body.credits !== undefined) { updates.push('credits = ?'); values.push(body.credits); }
  if (updates.length === 0) return c.json({ ok: true });

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'user_update', ?, ?, ?)
  `).bind(generateId(), admin.id, id, JSON.stringify(body), Date.now()).run();

  return c.json({ ok: true });
});

app.post('/api/admin/users/:id/credits', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ delta?: number; reason?: string; note?: string }>();

  if (typeof body.delta !== 'number' || body.delta === 0) {
    return c.json({ error: 'invalid_delta' }, 400);
  }

  if (body.delta > 0) {
    await addCredits(c.env, id, body.delta, body.reason || 'admin_grant', {
      createdBy: admin.id,
      note: body.note,
    });
  } else {
    await deductCredits(c.env, id, -body.delta, body.reason || 'admin_deduct');
  }

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'credit_change', ?, ?, ?)
  `).bind(generateId(), admin.id, id, JSON.stringify(body), Date.now()).run();

  const newBalance = await getCredits(c.env, id);
  return c.json({ ok: true, balance: newBalance });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, async (c) => {
  const users = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const projects = await c.env.DB.prepare('SELECT COUNT(*) as c FROM projects').first<{ c: number }>();
  const generations = await c.env.DB.prepare('SELECT COUNT(*) as c, COALESCE(SUM(cost_usd), 0) as total FROM generations').first<{ c: number; total: number }>();
  const toolRuns = await c.env.DB.prepare('SELECT COUNT(*) as c, COALESCE(SUM(cost_usd), 0) as total FROM tool_runs').first<{ c: number; total: number }>();
  const recentUsers = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE created_at > ?').bind(Date.now() - 7 * 24 * 60 * 60 * 1000).first<{ c: number }>();
  const totalCredits = await c.env.DB.prepare('SELECT COALESCE(SUM(credits), 0) as c FROM users').first<{ c: number }>();

  return c.json({
    ok: true,
    stats: {
      total_users: users?.c || 0,
      new_users_7d: recentUsers?.c || 0,
      total_projects: projects?.c || 0,
      total_generations: generations?.c || 0,
      total_tool_runs: toolRuns?.c || 0,
      total_api_cost_usd: (generations?.total || 0) + (toolRuns?.total || 0),
      total_credits: totalCredits?.c || 0,
    },
  });
});

// Email outbox preview (admin)
app.get('/api/admin/emails', requireAuth, requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT id, to_email, subject, template, status, created_at
    FROM email_outbox ORDER BY created_at DESC LIMIT 50
  `).all();
  return c.json({ emails: rows.results || [] });
});

app.get('/api/admin/emails/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT * FROM email_outbox WHERE id = ?'
  ).bind(id).first<any>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (c.req.query('format') === 'html') {
    return c.html(row.body_html);
  }
  return c.json({ email: row });
});

}
