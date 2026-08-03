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
import { seedMediaModelCatalog } from './lib/media/catalog';
import { runMediaProcessor } from './lib/media/processor';
import { reconcileStuckGenerations } from './lib/media/reconciler';
import { sweepMediaPurge } from './lib/media/purge';
import { listPlatformProviderKeys, setPlatformProviderKey } from './lib/media/providerKeys';
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

  if (!id) {
    return c.json({ error: 'missing_user_id' }, 400);
  }

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

// Mark a user's email verified without the email round-trip (support action —
// for when the verification email never reaches the user, e.g. a deliverability
// problem on our side; unblocks them immediately while email is being fixed)
app.post('/api/admin/users/:id/mark-verified', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');

  const user = await c.env.DB.prepare('SELECT id, email_verified FROM users WHERE id = ?')
    .bind(id).first<{ id: string; email_verified: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  if (user.email_verified) return c.json({ error: 'already_verified' }, 400);

  const now = Date.now();
  await c.env.DB.prepare('UPDATE users SET email_verified = 1, email_verified_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, id).run();

  await c.env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, 'mark_verified', ?, '{}', ?)
  `).bind(generateId(), admin.id, id, now).run();

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

// =====================================================
// Creative Studio Operations Console
// =====================================================

app.get('/api/admin/creative/models', requireAuth, requireAdmin, async (c) => {
  const ready = await hasCreativeSchema(c.env);
  if (!ready) return c.json({ schema_ready: false, models: [] });

  await seedMediaModelCatalog(c.env);
  const rows = await c.env.DB.prepare(`
    SELECT id, provider, provider_model_id, display_name, model_type, operation,
           capabilities_json, pricing_json, pricing_version, config_version,
           is_active, is_maintenance, sort_order, created_at, updated_at
    FROM ai_models
    ORDER BY sort_order ASC, display_name ASC
  `).all<any>();

  return c.json({
    schema_ready: true,
    models: (rows.results || []).map((row) => ({
      ...row,
      capabilities: parseJson(row.capabilities_json, {}),
      pricing: parseJson(row.pricing_json, {}),
      is_active: row.is_active === 1,
      is_maintenance: row.is_maintenance === 1,
      capabilities_json: undefined,
      pricing_json: undefined,
    })),
  });
});

app.put('/api/admin/creative/models/:id', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{
    display_name?: string;
    is_active?: boolean;
    is_maintenance?: boolean;
    sort_order?: number;
    pricing?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
  }>();

  const model = await c.env.DB.prepare('SELECT id FROM ai_models WHERE id = ?').bind(id).first();
  if (!model) return c.json({ error: 'model_not_found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.display_name !== undefined) {
    const name = body.display_name.trim().slice(0, 120);
    if (!name) return c.json({ error: 'invalid_display_name' }, 400);
    updates.push('display_name = ?');
    values.push(name);
  }
  if (body.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(body.is_active ? 1 : 0);
  }
  if (body.is_maintenance !== undefined) {
    updates.push('is_maintenance = ?');
    values.push(body.is_maintenance ? 1 : 0);
  }
  if (body.sort_order !== undefined) {
    updates.push('sort_order = ?');
    values.push(Math.max(0, Math.min(10_000, Number(body.sort_order) || 0)));
  }
  if (body.pricing !== undefined) {
    const error = validateModelPricing(body.pricing);
    if (error) return c.json({ error }, 400);
    updates.push('pricing_json = ?');
    values.push(JSON.stringify(body.pricing));
  }
  if (body.capabilities !== undefined) {
    const error = validateModelCapabilities(body.capabilities);
    if (error) return c.json({ error }, 400);
    updates.push('capabilities_json = ?');
    values.push(JSON.stringify(body.capabilities));
  }
  if (!updates.length) return c.json({ ok: true });

  updates.push('config_version = config_version + 1');
  updates.push('updated_at = ?');
  values.push(Date.now(), id);

  await c.env.DB.prepare(`UPDATE ai_models SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values).run();
  await logAdminAction(c.env, admin.id, 'creative_model_update', null, {
    model_id: id,
    changed_fields: Object.keys(body),
  });

  return c.json({ ok: true });
});

app.get('/api/admin/creative/stats', requireAuth, requireAdmin, async (c) => {
  const ready = await hasCreativeSchema(c.env);
  if (!ready) return c.json({ schema_ready: false, stats: null });

  const [
    generationsByStatus,
    recentErrors,
    attemptsByProvider,
    workQueue,
    holdsByStatus,
    assetCounts,
    stuckGenerations,
  ] = await Promise.all([
    c.env.DB.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(estimated_credits), 0) as estimated_credits
      FROM media_generations GROUP BY status ORDER BY count DESC
    `).all(),
    c.env.DB.prepare(`
      SELECT id, user_id, model_id, status, error_code, error_message, updated_at
      FROM media_generations
      WHERE error_code IS NOT NULL OR status IN ('failed', 'delivery_pending')
      ORDER BY updated_at DESC LIMIT 20
    `).all(),
    c.env.DB.prepare(`
      SELECT provider, status, COUNT(*) as count, COALESCE(SUM(provider_cost_usd), 0) as provider_cost_usd
      FROM generation_attempts GROUP BY provider, status ORDER BY provider ASC, status ASC
    `).all(),
    c.env.DB.prepare(`
      SELECT status, work_type, COUNT(*) as count, MAX(updated_at) as newest_updated_at
      FROM media_work_items GROUP BY status, work_type ORDER BY status ASC, work_type ASC
    `).all(),
    c.env.DB.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(reserved_credits), 0) as credits
      FROM media_credit_holds GROUP BY status ORDER BY status ASC
    `).all(),
    c.env.DB.prepare(`
      SELECT lifecycle_status, asset_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as bytes
      FROM media_assets GROUP BY lifecycle_status, asset_type ORDER BY count DESC
    `).all(),
    c.env.DB.prepare(`
      SELECT id, user_id, model_id, status, delivery_status, updated_at, delivery_deadline_at
      FROM media_generations
      WHERE status IN ('queued', 'submitting', 'processing', 'delivery_pending', 'cancel_requested')
        AND updated_at < ?
      ORDER BY updated_at ASC LIMIT 20
    `).bind(Date.now() - 30 * 60 * 1000).all(),
  ]);

  return c.json({
    schema_ready: true,
    stats: {
      generations_by_status: generationsByStatus.results || [],
      recent_errors: recentErrors.results || [],
      attempts_by_provider: attemptsByProvider.results || [],
      work_queue: workQueue.results || [],
      holds_by_status: holdsByStatus.results || [],
      asset_counts: assetCounts.results || [],
      stuck_generations: stuckGenerations.results || [],
    },
  });
});

app.get('/api/admin/creative/generations/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const generation = await c.env.DB.prepare('SELECT * FROM media_generations WHERE id = ?').bind(id).first<any>();
  if (!generation) return c.json({ error: 'generation_not_found' }, 404);
  const [attempts, references, assets, hold, workItems] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM generation_attempts WHERE generation_id = ? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM generation_references WHERE generation_id = ? ORDER BY sort_order ASC').bind(id).all(),
    c.env.DB.prepare(`
      SELECT id, asset_type, source, original_filename, mime_type, file_size, width, height,
             favorite, lifecycle_status, created_at, updated_at
      FROM media_assets WHERE generation_id = ? ORDER BY created_at ASC
    `).bind(id).all(),
    c.env.DB.prepare('SELECT * FROM media_credit_holds WHERE generation_id = ?').bind(id).first(),
    c.env.DB.prepare(`
      SELECT id, work_type, status, available_at, lease_until, attempts, max_attempts, last_error, created_at, updated_at
      FROM media_work_items WHERE generation_id = ? ORDER BY created_at DESC
    `).bind(id).all(),
  ]);

  return c.json({
    generation: {
      ...generation,
      options: parseJson(generation.options_json, {}),
      pricing_snapshot: parseJson(generation.pricing_snapshot_json, {}),
      options_json: undefined,
      pricing_snapshot_json: undefined,
    },
    attempts: attempts.results || [],
    references: references.results || [],
    assets: assets.results || [],
    hold,
    work_items: workItems.results || [],
  });
});

app.post('/api/admin/creative/reconcile', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const result = await runMediaProcessor(c.env);
  const stuck = await reconcileStuckGenerations(c.env);
  const purge = await sweepMediaPurge(c.env);
  await logAdminAction(c.env, admin.id, 'creative_manual_reconcile', null, {
    claimed: result.claimed,
    expired_refunded: stuck.expired,
    dead_letters: stuck.deadLetters,
    purged_assets: purge.purgedAssets,
    expired_intents: purge.expiredIntents,
  });
  return c.json({ ok: true, result, stuck, purge });
});

// Only providers whose adapter actually reads from platform_provider_keys at
// runtime belong here (see lib/media/providers/router.ts). MiniMax is
// intentionally excluded: its key is a Worker secret (env.MINIMAX_API_KEY),
// so accepting a platform key for it here would silently do nothing at
// generation time while still reporting success and clearing maintenance —
// a misleading no-op for whoever pastes a key in expecting it to take effect.
const KNOWN_MEDIA_PROVIDERS = ['fal'];

app.get('/api/admin/creative/providers', requireAuth, requireAdmin, async (c) => {
  const ready = await hasCreativeSchema(c.env);
  if (!ready) return c.json({ schema_ready: false, providers: [] });
  return c.json({ schema_ready: true, providers: await listPlatformProviderKeys(c.env) });
});

app.put('/api/admin/creative/providers/:provider/key', requireAuth, requireAdmin, async (c) => {
  const admin = c.get('user')!;
  const provider = c.req.param('provider');
  if (!provider || !KNOWN_MEDIA_PROVIDERS.includes(provider)) return c.json({ error: 'unknown_provider' }, 404);

  const body = await c.req.json<{ api_key?: string }>().catch(() => ({}) as { api_key?: string });
  const apiKey = body.api_key;
  if (!apiKey || !apiKey.trim()) return c.json({ error: 'api_key_required' }, 400);

  await seedMediaModelCatalog(c.env); // ensure this provider's models exist before the UPDATE below can affect them
  const result = await setPlatformProviderKey(c.env, provider, apiKey, admin.id);
  if (!result.ok) return c.json({ error: result.error }, 400);

  // Setting a key is the signal that the provider is ready — lift maintenance
  // on its models automatically so the admin doesn't need a second action.
  await c.env.DB.prepare('UPDATE ai_models SET is_maintenance = 0, updated_at = ? WHERE provider = ?')
    .bind(Date.now(), provider).run();

  await logAdminAction(c.env, admin.id, 'creative_provider_key_set', null, {
    provider,
    key_hint: result.key_hint,
  });

  return c.json({ ok: true, key_hint: result.key_hint });
});

}

async function hasCreativeSchema(env: Pick<Bindings, 'DB'>) {
  const row = await env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'media_generations'
  `).first<{ name: string }>();
  return Boolean(row?.name);
}

function validateModelPricing(value: Record<string, unknown>) {
  if (typeof value.credits_per_output !== 'number' || value.credits_per_output < 1) return 'invalid_pricing';
  if (value.minimum_credits !== undefined && (typeof value.minimum_credits !== 'number' || value.minimum_credits < 1)) return 'invalid_pricing';
  return '';
}

function validateModelCapabilities(value: Record<string, unknown>) {
  if (!Array.isArray(value.aspectRatios) || !Array.isArray(value.outputFormats)) return 'invalid_capabilities';
  if (typeof value.maxOutputCount !== 'number' || value.maxOutputCount < 1) return 'invalid_capabilities';
  return '';
}

function parseJson(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function logAdminAction(
  env: Pick<Bindings, 'DB'>,
  adminId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
) {
  await env.DB.prepare(`
    INSERT INTO admin_actions (id, admin_id, action, target_user_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(generateId(), adminId, action, targetUserId, JSON.stringify(details), Date.now()).run();
}
