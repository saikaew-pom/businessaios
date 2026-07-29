/**
 * Admin panel routes (users, credits, stats, email log) — requireAdmin-gated.
 * Extracted out of index.ts (M1 refactor, 2026-07-29).
 * Expanded into an Operations Console (search/pagination/user detail/help actions, 2026-07-29).
 */
import type { Hono } from 'hono';
import { requireAuth, requireAdmin } from './lib/middleware';
import { generateId } from './lib/crypto';
import { addCredits, deductCredits } from './lib/credit';
import { sendVerificationEmail, sendPasswordResetOTP } from './lib/verification';
import type { Bindings, Variables } from './lib/types';

export function createAdminRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {

// =====================================================
// Admin (Super Admin)
// =====================================================

app.get('/api/admin/users', requireAuth, requireAdmin, async (c) => {
  const q = (c.req.query('q') || '').trim();
  const role = c.req.query('role') || '';
  const verified = c.req.query('verified'); // '0' | '1'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '25', 10) || 25));

  const conditions: string[] = [];
  const params: any[] = [];

  if (q) {
    const like = `%${q}%`;
    conditions.push('(email LIKE ? OR name LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
    params.push(like, like, like, like);
  }
  if (role === 'admin' || role === 'user') {
    conditions.push('role = ?');
    params.push(role);
  }
  if (verified === '0' || verified === '1') {
    conditions.push('email_verified = ?');
    params.push(Number(verified));
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM users ${whereClause}`)
    .bind(...params).first<{ c: number }>();

  const rows = await c.env.DB.prepare(`
    SELECT id, email, name, first_name, last_name, role, plan, credits, email_verified, two_factor_enabled, created_at
    FROM users ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, pageSize, (page - 1) * pageSize).all();

  return c.json({
    users: rows.results || [],
    total: countRow?.c || 0,
    page,
    pageSize,
  });
});

app.get('/api/admin/users/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id');

  const user = await c.env.DB.prepare(`
    SELECT id, email, name, first_name, last_name, phone, avatar_url, role, plan, credits,
           email_verified, email_verified_at, two_factor_enabled, locale, created_at, updated_at
    FROM users WHERE id = ?
  `).bind(id).first<any>();

  if (!user) return c.json({ error: 'not_found' }, 404);

  const [transactions, projects, toolRuns, generationsAgg, payments, actions] = await Promise.all([
    c.env.DB.prepare(`
      SELECT id, delta, reason, reference_id, balance_after, note, created_by, created_at
      FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT id, name, industry, kind, status, current_step, created_at, updated_at
      FROM projects WHERE user_id = ? ORDER BY updated_at DESC
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT id, tool_name, cost_usd, created_at FROM tool_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) as c, COALESCE(SUM(cost_usd), 0) as total FROM generations WHERE user_id = ?
    `).bind(id).first<{ c: number; total: number }>(),
    c.env.DB.prepare(`
      SELECT id, package_id, credits, amount_satang, status, created_at
      FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT aa.id, aa.action, aa.details, aa.created_at, u.email as admin_email
      FROM admin_actions aa LEFT JOIN users u ON u.id = aa.admin_id
      WHERE aa.target_user_id = ? ORDER BY aa.created_at DESC LIMIT 30
    `).bind(id).all(),
  ]);

  return c.json({
    user,
    credit_transactions: transactions.results || [],
    projects: projects.results || [],
    tool_runs: toolRuns.results || [],
    generations_summary: { count: generationsAgg?.c || 0, cost_usd: generationsAgg?.total || 0 },
    payments: payments.results || [],
    admin_actions: actions.results || [],
  });
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

  const targetExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!targetExists) return c.json({ error: 'not_found' }, 404);

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

  const targetExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!targetExists) return c.json({ error: 'not_found' }, 404);

  const result = body.delta > 0
    ? await addCredits(c.env, id, body.delta, body.reason || 'admin_grant', {
        createdBy: admin.id,
        note: body.note,
      })
    : await deductCredits(c.env, id, -body.delta, body.reason || 'admin_deduct');

  if (!result.ok) {
    // Deduction failed (insufficient balance or a concurrent write) — do not log a
    // 'credit_change' admin_action, since no change actually happened.
    const message = result.error === 'insufficient_credits'
      ? `เครดิตของ user ไม่พอให้หัก (คงเหลือ ${result.balance})`
      : 'ไม่สามารถปรับเครดิตได้ กรุณาลองใหม่';
    return c.json({ error: result.error, message, balance: result.balance }, 400);
  }

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'credit_change', ?, ?, ?)
  `).bind(generateId(), admin.id, id, JSON.stringify(body), Date.now()).run();

  return c.json({ ok: true, balance: result.balance });
});

// Resend the account-verification email on a user's behalf (support action)
app.post('/api/admin/users/:id/resend-verification', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');

  const user = await c.env.DB.prepare('SELECT id, email, name, email_verified FROM users WHERE id = ?')
    .bind(id).first<{ id: string; email: string; name: string | null; email_verified: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  if (user.email_verified) return c.json({ error: 'already_verified' }, 400);

  await sendVerificationEmail(c.env, user.id, user.email, user.name);

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'resend_verification', ?, '{}', ?)
  `).bind(generateId(), admin.id, id, Date.now()).run();

  return c.json({ ok: true });
});

// Send a password-reset OTP to the user's email (support action — same OTP flow as self-serve reset)
app.post('/api/admin/users/:id/send-password-reset', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');

  const user = await c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(id).first<{ id: string; email: string; name: string | null }>();
  if (!user) return c.json({ error: 'not_found' }, 404);

  await sendPasswordResetOTP(c.env, user.id, user.email, user.name);

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'send_password_reset', ?, '{}', ?)
  `).bind(generateId(), admin.id, id, Date.now()).run();

  return c.json({ ok: true });
});

// Internal team note attached to a user (stored as an admin_actions entry, shown in User Detail)
app.post('/api/admin/users/:id/notes', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ text?: string }>();
  const text = (body.text || '').trim();
  if (!text) return c.json({ error: 'empty_note' }, 400);

  const targetExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!targetExists) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'note', ?, ?, ?)
  `).bind(generateId(), admin.id, id, JSON.stringify({ text }), Date.now()).run();

  return c.json({ ok: true });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, async (c) => {
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const [
    users, projects, generations, toolRuns, recentUsers, totalCredits,
    verifiedUsers, usersWithProject, paymentsAgg, signupsByDay,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM projects').first<{ c: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c, COALESCE(SUM(cost_usd), 0) as total FROM generations').first<{ c: number; total: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c, COALESCE(SUM(cost_usd), 0) as total FROM tool_runs').first<{ c: number; total: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE created_at > ?').bind(Date.now() - 7 * 24 * 60 * 60 * 1000).first<{ c: number }>(),
    c.env.DB.prepare('SELECT COALESCE(SUM(credits), 0) as c FROM users').first<{ c: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE email_verified = 1').first<{ c: number }>(),
    c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as c FROM projects').first<{ c: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as payers, COALESCE(SUM(amount_satang), 0) as revenue_satang
      FROM payments WHERE status = 'succeeded'
    `).first<{ payers: number; revenue_satang: number }>(),
    c.env.DB.prepare(`
      SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') as day, COUNT(*) as c
      FROM users WHERE created_at > ?
      GROUP BY day ORDER BY day ASC
    `).bind(fourteenDaysAgo).all(),
  ]);

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
      funnel: {
        signed_up: users?.c || 0,
        verified: verifiedUsers?.c || 0,
        created_a_plan: usersWithProject?.c || 0,
        paid: paymentsAgg?.payers || 0,
      },
      revenue_satang: paymentsAgg?.revenue_satang || 0,
      signups_by_day: signupsByDay.results || [],
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
