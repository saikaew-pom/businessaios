/**
 * BusinessAiOs API
 * Cloudflare Workers + Hono + D1 + R2
 *
 * MVP: Auth + Projects + AI Generation + PDF Export
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { callMinimax, extractJson, extractJsonFromAny, estimateCost } from './lib/minimax';
import { hashPassword, verifyPassword, generateSessionToken, generateId, encryptText, decryptText, generateOTP, generateToken, getMasterSecret } from './lib/crypto';
import { PROMPT_TEMPLATES, STEPS, painGeneratorPrompt, brandVoicePrompt, personaBuilderPrompt, competitorAnalysisPrompt, jtbdGeneratorPrompt, valuePropositionCanvasPrompt, bmcGeneratorPrompt, millionDollarOfferPrompt, objectionHandlerPrompt, hookLibraryPrompt } from './lib/prompts';
import { renderCanvasPDF } from './lib/canvasTemplates';
import { requireAuth, requireAdmin, rateLimit, getSessionToken, setSessionCookie, clearSessionCookie } from './lib/middleware';
import { sendEmail, emailVerifyTemplate, passwordResetOTPTemplate, loginOTPTemplate } from './lib/email';
import { verifyTurnstile } from './lib/turnstile';
import { calculateCredits, getCredits, deductCredits, addCredits, getCreditHistory } from './lib/credit';
import { SESSION_TTL_MS } from './lib/types';
import type { Bindings, Variables } from './lib/types';
import { createPresentationRoutes } from './presentationRoutes';
import paymentsRoutes from './paymentsRoutes';

// =====================================================
// App
// =====================================================
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', logger());
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

app.use('*', cors({
  origin: (origin) => {
    // No Origin header (e.g. curl, server-to-server) — allow, there's no browser
    // cookie to steal in that case.
    if (!origin) return '*';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
    if (origin.endsWith('.pages.dev')) return origin;
    if (origin.endsWith('.workers.dev')) return origin;
    if (origin.endsWith('.businessaios.com')) return origin;
    // Anything else: reject. Do NOT fall through to `return origin` here —
    // combined with credentials:true + SameSite=None cookies, that reflected
    // any origin back and let any website ride the user's session (CSRF).
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// =====================================================
// Health
// =====================================================
app.get('/', (c) => c.json({
  name: 'BusinessAiOs API',
  version: '0.2.0',
  status: 'ok',
  timestamp: new Date().toISOString(),
  endpoints: {
    health: 'GET /',
    auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me'],
    projects: ['GET /api/projects', 'POST /api/projects', 'GET /api/projects/:id', 'PUT /api/projects/:id', 'DELETE /api/projects/:id'],
    generate: ['POST /api/projects/:id/generate/:step'],
    exports: ['POST /api/projects/:id/export', 'GET /api/exports/:id'],
  },
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

/**
 * Public config — exposes non-secret env values to the frontend
 * (e.g. Turnstile site key, feature flags)
 */
app.get('/api/config', (c) => {
  const env = c.env;
  return c.json({
    turnstile: {
      site_key: (env as any).TURNSTILE_SITE_KEY || null,
      required: (env as any).TURNSTILE_REQUIRED !== 'false' && !!(env as any).TURNSTILE_SECRET,
    },
    features: {
      email_verification: !!(env as any).BREVO_API_KEY,
      google_oauth: !!(env as any).GOOGLE_CLIENT_ID,
    },
  });
});

// =====================================================
// Waitlist (existing — keep for compatibility)
// =====================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/waitlist', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ email?: string; name?: string; source?: string; locale?: string; referrer?: string }>();

  if (!body.email || !EMAIL_REGEX.test(body.email.trim().toLowerCase())) {
    return c.json({ error: 'invalid_email' }, 400);
  }

  const email = body.email.trim().toLowerCase();

  try {
    const existing = await env.DB.prepare('SELECT id FROM waitlist WHERE email = ?').bind(email).first();
    if (existing) return c.json({ ok: true, duplicate: true });

    await env.DB.prepare(`
      INSERT INTO waitlist (id, email, name, source, locale, referrer, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(), email, body.name?.trim() || null,
      body.source || 'unknown', body.locale || 'th',
      body.referrer || null, c.req.header('user-agent')?.slice(0, 500) || null,
      Date.now()
    ).run();

    return c.json({ ok: true });
  } catch (err) {
    console.error('Waitlist error:', err);
    return c.json({ error: 'internal_error' }, 500);
  }
});

app.get('/api/waitlist/count', async (c) => {
  const r = await c.env.DB.prepare('SELECT COUNT(*) as c FROM waitlist').first<{ c: number }>();
  return c.json({ count: r?.c ?? 0 });
});

// =====================================================
// Auth
// =====================================================

app.post('/api/auth/register', rateLimit, async (c) => {
  const env = c.env;
  const body = await c.req.json<{
    email?: string;
    password?: string;
    name?: string;
    locale?: string;
    first_name?: string;
    last_name?: string;
    turnstile_token?: string;
  }>();

  // Turnstile check (mock in dev)
  const turnstileCheck = await verifyTurnstile(env, body.turnstile_token);
  if (!turnstileCheck.ok) {
    return c.json({ error: 'turnstile_failed', message: 'Bot check failed' }, 400);
  }

  if (!body.email || !EMAIL_REGEX.test(body.email.trim().toLowerCase())) {
    return c.json({ error: 'invalid_email', message: 'อีเมลไม่ถูกต้อง' }, 400);
  }
  if (!body.password || body.password.length < 8) {
    return c.json({ error: 'weak_password', message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const now = Date.now();

  try {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return c.json({ error: 'email_taken', message: 'อีเมลนี้ถูกใช้แล้ว' }, 409);
    }

    const userId = generateId();
    const passwordHash = await hashPassword(body.password);
    const fullName = [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || body.name?.trim() || null;

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name, first_name, last_name, plan, locale, credits, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'free', ?, 100, ?, ?)
    `).bind(
      userId, email, passwordHash, fullName,
      body.first_name?.trim() || null,
      body.last_name?.trim() || null,
      body.locale || 'th', now, now
    ).run();

    // Signup bonus credit (200 credits — enough to try most tools)
    await env.DB.prepare(`
      INSERT INTO credit_transactions (id, user_id, delta, reason, balance_after, note, created_at)
      VALUES (?, ?, 200, 'signup_bonus', 200, 'Welcome bonus — 200 credits', ?)
    `).bind(generateId(), userId, now).run();

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(sessionToken, userId, expiresAt, now, c.req.header('user-agent')?.slice(0, 500) || null, c.req.header('cf-connecting-ip') || null).run();

    setSessionCookie(c, sessionToken, expiresAt);

    // Send verification email (async, don't block response)
    c.executionCtx?.waitUntil(sendVerificationEmail(env, userId, email, fullName));

    return c.json({
      ok: true,
      user: { id: userId, email, name: fullName, plan: 'free', credits: 100, email_verified: false },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return c.json({ error: 'internal_error', message: err.message }, 500);
  }
});

app.post('/api/auth/login', rateLimit, async (c) => {
  const env = c.env;
  const body = await c.req.json<{ email?: string; password?: string; turnstile_token?: string; otp?: string }>();

  // Turnstile check
  const turnstileCheck = await verifyTurnstile(env, body.turnstile_token);
  if (!turnstileCheck.ok) {
    return c.json({ error: 'turnstile_failed' }, 400);
  }

  if (!body.email || !body.password) {
    return c.json({ error: 'missing_credentials' }, 400);
  }

  const email = body.email.trim().toLowerCase();

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, plan, email_verified, two_factor_enabled, role, credits FROM users WHERE email = ?'
    ).bind(email).first<{
      id: string; email: string; password_hash: string; name: string | null;
      plan: string; email_verified: number; two_factor_enabled: number;
      role: string | null; credits: number;
    }>();

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return c.json({ error: 'invalid_credentials', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401);
    }

    // 2FA: if enabled, require OTP
    if (user.two_factor_enabled) {
      if (!body.otp) {
        // Generate and send OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min
        await env.DB.prepare(`
          INSERT INTO otp_codes (id, user_id, purpose, code, expires_at, created_at)
          VALUES (?, ?, 'login_2fa', ?, ?, ?)
        `).bind(generateId(), user.id, otp, expiresAt, Date.now()).run();

        c.executionCtx?.waitUntil(sendEmail(env, {
          to: user.email,
          ...loginOTPTemplate({ name: user.name || undefined, otp, expiresInMinutes: 10 }),
          template: 'login_2fa',
        }));

        return c.json({
          ok: true,
          require_otp: true,
          message: 'กรุณาใส่รหัส OTP ที่ส่งไปทางอีเมล',
        });
      }

      // Verify OTP
      const otpRow = await env.DB.prepare(`
        SELECT id, expires_at FROM otp_codes
        WHERE user_id = ? AND purpose = 'login_2fa' AND code = ? AND used = 0
        ORDER BY created_at DESC LIMIT 1
      `).bind(user.id, body.otp).first<{ id: string; expires_at: number }>();

      if (!otpRow || otpRow.expires_at < Date.now()) {
        return c.json({ error: 'invalid_otp', message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' }, 401);
      }

      await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otpRow.id).run();
    }

    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(sessionToken, user.id, expiresAt, Date.now(), c.req.header('user-agent')?.slice(0, 500) || null, c.req.header('cf-connecting-ip') || null).run();

    setSessionCookie(c, sessionToken, expiresAt);

    return c.json({
      ok: true,
      user: {
        id: user.id, email: user.email, name: user.name, plan: user.plan,
        role: user.role, credits: user.credits,
        email_verified: !!user.email_verified, two_factor_enabled: !!user.two_factor_enabled,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return c.json({ error: 'internal_error', message: err.message }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  const token = getSessionToken(c);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  // Fetch full profile
  const full = await c.env.DB.prepare(
    'SELECT id, email, name, first_name, last_name, phone, avatar_url, plan, role, email_verified, two_factor_enabled, credits, created_at FROM users WHERE id = ?'
  ).bind(user.id).first<any>();
  return c.json({ user: full });
});

// =====================================================
// Projects
// =====================================================

// NOTE: GET/POST /api/projects and GET /api/projects/:id were previously
// declared a SECOND time further down in this file (a `kind`-aware version
// meant to replace these). Hono uses the first matching handler, so that
// second block was dead code — `kind` filtering/creation never actually ran.
// Consolidated here; see the bottom of this file where the duplicates used
// to live for how `kind` is now handled inline.
app.get('/api/projects', requireAuth, async (c) => {
  const user = c.get('user')!;
  // Optional ?status= filter: 'draft' | 'completed' | 'archived' | '' (all)
  const statusFilter = c.req.query('status');
  const kindFilter = c.req.query('kind');

  let query = `SELECT id, name, industry, current_step, status, kind, created_at, updated_at
                FROM projects
                WHERE user_id = ?`;
  const params: any[] = [user.id];

  if (statusFilter && statusFilter !== 'all') {
    query += ` AND status = ?`;
    params.push(statusFilter);
  } else if (!statusFilter) {
    // Default: hide archived
    query += ` AND status != 'archived'`;
  }

  if (kindFilter) {
    query += ` AND kind = ?`;
    params.push(kindFilter);
  }

  query += ` ORDER BY updated_at DESC LIMIT 200`;

  const projects = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ projects: projects.results || [] });
});

app.post('/api/projects', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ name?: string; industry?: string; locale?: string; kind?: string }>();

  if (!body.name?.trim()) {
    return c.json({ error: 'name_required' }, 400);
  }

  const id = generateId();
  const now = Date.now();
  const kind = body.kind || 'playbook';
  const validKinds = ['playbook', 'brand_voice', 'pain_points', 'persona', 'competitor_analysis', 'jtbd_generator', 'value_proposition_canvas', 'business_model_canvas', 'million_dollar_offer', 'objection_handler', 'hook_library'];
  const finalKind = validKinds.includes(kind) ? kind : 'playbook';

  await c.env.DB.prepare(`
    INSERT INTO projects (id, user_id, name, industry, current_step, status, locale, step_data, kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'draft', ?, '{}', ?, ?, ?)
  `).bind(id, user.id, body.name.trim(), body.industry || null, body.locale || 'th', finalKind, now, now).run();

  return c.json({ ok: true, project: { id, name: body.name, current_step: 1, status: 'draft', kind: finalKind } });
});

app.get('/api/projects/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  const project = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!project) return c.json({ error: 'not_found' }, 404);

  // Parse step_data
  try {
    project.step_data = JSON.parse(project.step_data || '{}');
  } catch {
    project.step_data = {};
  }

  return c.json({ project });
});

app.put('/api/projects/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    industry?: string;
    step_data?: any;
    current_step?: number;
    status?: string;
  }>();

  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();

  if (!project) return c.json({ error: 'not_found' }, 404);

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.industry !== undefined) { updates.push('industry = ?'); values.push(body.industry); }
  if (body.step_data !== undefined) { updates.push('step_data = ?'); values.push(JSON.stringify(body.step_data)); }
  if (body.current_step !== undefined) { updates.push('current_step = ?'); values.push(body.current_step); }
  if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }

  updates.push('updated_at = ?');
  values.push(Date.now());

  values.push(id);
  values.push(user.id);

  await c.env.DB.prepare(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  return c.json({ ok: true });
});

app.delete('/api/projects/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const hard = c.req.query('hard') === '1';

  if (hard) {
    // Permanent delete — removes project + all related data
    // First delete related rows
    await c.env.DB.prepare('DELETE FROM generations WHERE project_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM step_assets WHERE project_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM project_links WHERE project_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM exports WHERE project_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ ok: true, hard: true });
  }

  // Soft delete (archive)
  await c.env.DB.prepare(
    'UPDATE projects SET status = "archived" WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).run();

  return c.json({ ok: true });

});

/**
 * POST /api/projects/:id/restore
 * Restore an archived project back to draft
 */
app.post('/api/projects/:id/restore', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  await c.env.DB.prepare(
    'UPDATE projects SET status = "draft" WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).run();
  return c.json({ ok: true });
});

/**
 * POST /api/projects/:id/reset
 * Reset project to step 1 (clear all step_data, current_step=1)
 * Keeps the project name, industry, kind
 */
app.post('/api/projects/:id/reset', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  const project: any = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();
  if (!project) return c.json({ error: 'not_found' }, 404);

  // Delete all step data
  await c.env.DB.prepare('DELETE FROM generations WHERE project_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM step_assets WHERE project_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM project_links WHERE project_id = ?').bind(id).run();
  // Keep exports for history (don't delete)
  // Reset project
  await c.env.DB.prepare(
    'UPDATE projects SET step_data = ?, current_step = 1, status = "draft", updated_at = ? WHERE id = ?'
  ).bind('{}', Date.now(), id).run();

  return c.json({ ok: true });
});

// =====================================================
// AI Generation
// =====================================================
// =====================================================
// AI Generation
// =====================================================

app.post('/api/projects/:id/generate/:step', requireAuth, rateLimit, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id') || '';
  const stepNumStr = c.req.param('step') || '0';
  const stepNum = parseInt(stepNumStr, 10);

  if (!projectId || !STEPS.includes(stepNum as any)) {
    return c.json({ error: 'invalid_step', message: 'Step ต้องเป็น 1-7' }, 400);
  }

  const env = c.env;

  // Verify project belongs to user
  const project = await env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first<any>();

  if (!project) return c.json({ error: 'not_found' }, 404);

  // Email verification gate (mandatory)
  const userCheck = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (userCheck && userCheck.email_verified === 0) {
    return c.json({
      error: 'email_not_verified',
      message: 'กรุณายืนยันอีเมลก่อน',
      verify_url: '/verify-email',
    }, 403);
  }

  let stepData: any = {};
  try { stepData = JSON.parse(project.step_data || '{}'); } catch {}

  const body = await c.req.json<{ input?: any }>();
  const input = body.input || stepData[`step${stepNum}`] || {};

  // Inject context from previous steps
  if (stepNum >= 2) input.brand_card = stepData.step1;
  if (stepNum >= 3) input.personas = stepData.step2;
  if (stepNum >= 4) { input.brand_card = stepData.step1; input.personas = stepData.step2; }
  if (stepNum >= 5) { input.brand_card = stepData.step1; input.personas = stepData.step2; input.positioning = stepData.step4; }
  if (stepNum >= 6) { input.brand_card = stepData.step1; input.positioning = stepData.step4; }
  if (stepNum >= 7) { input.brand_card = stepData.step1; input.positioning = stepData.step4; }
  if (stepNum >= 4) input.business_name = project.name;

  // Inject user-added context: step assets (notes + files + linked projects)
  try {
    const assets = await env.DB.prepare(`
      SELECT id, kind, title, content, file_name, mime_type, source, source_id, source_meta
      FROM step_assets
      WHERE project_id = ? AND step_number = ?
      ORDER BY created_at ASC
    `).bind(projectId, stepNum).all<any>();

    const notesArr: string[] = [];
    const filesArr: any[] = [];
    const linkedArr: any[] = [];

    for (const a of (assets.results || [])) {
      if (a.kind === 'note') {
        if (a.content) notesArr.push(`[${a.title || 'Note'}]\n${a.content}`);
      } else if (a.kind === 'file') {
        if (a.content) {
          // Inline file content (text/csv/json stored in content for retrieval)
          notesArr.push(`[ไฟล์: ${a.file_name} (${a.mime_type || 'unknown'})]\n${a.content.slice(0, 4000)}`);
        } else if (a.file_url) {
          filesArr.push({ name: a.file_name, url: a.file_url, mime: a.mime_type });
        }
      } else if (a.kind === 'link') {
        // Linked project/tool
        if (a.source === 'project' && a.source_id) {
          const linkedProj = await env.DB.prepare(
            'SELECT id, name, kind, step_data FROM projects WHERE id = ?'
          ).bind(a.source_id).first<any>();
          if (linkedProj) {
            let linkedData: any = {};
            try { linkedData = JSON.parse(linkedProj.step_data || '{}'); } catch {}
            const summary: any = { source: 'project', name: linkedProj.name, kind: linkedProj.kind };
            if (linkedProj.kind === 'brand_voice') summary.brand_voice = linkedData;
            if (linkedProj.kind === 'pain_points') summary.pain_points = linkedData;
            if (linkedProj.kind === 'persona') summary.personas = linkedData;
            if (linkedProj.kind === 'playbook' && linkedData.step1) summary.brand_card = linkedData.step1;
            if (linkedProj.kind === 'playbook' && linkedData.step2) summary.personas = linkedData.step2;
            linkedArr.push(summary);
          }
        } else if (a.source === 'tool_save' && a.source_id) {
          const linkedTool = await env.DB.prepare(
            'SELECT id, tool_type, title, input, output FROM tool_saves WHERE id = ? AND user_id = ?'
          ).bind(a.source_id, user.id).first<any>();
          if (linkedTool) {
            const output = linkedTool.output ? JSON.parse(linkedTool.output) : {};
            const summary: any = { source: 'tool_save', name: linkedTool.title, type: linkedTool.tool_type };
            if (linkedTool.tool_type === 'brand_voice') summary.brand_voice = output;
            if (linkedTool.tool_type === 'pain_generator') summary.pain_points = output;
            if (linkedTool.tool_type === 'persona_builder') summary.personas = output;
            if (linkedTool.tool_type === 'competitor_analysis') summary.competitor_analysis = output;
            if (linkedTool.tool_type === 'jtbd_generator') summary.jtbd = output;
            if (linkedTool.tool_type === 'value_proposition_canvas') summary.vpc = output;
            if (linkedTool.tool_type === 'million_dollar_offer') summary.offer = output;
            if (linkedTool.tool_type === 'objection_handler') summary.objections = output;
            if (linkedTool.tool_type === 'hook_library') summary.hooks = output;
            linkedArr.push(summary);
          }
        }
      }
    }

    if (notesArr.length > 0) {
      input.user_notes = notesArr.join('\n\n');
    }
    if (filesArr.length > 0) {
      input.uploaded_files = filesArr;
    }
    if (linkedArr.length > 0) {
      input.linked_assets = linkedArr;
    }
  } catch (e) {
    console.error('Failed to load step_assets:', e);
  }

  // Build prompt
  const template = PROMPT_TEMPLATES[stepNum];
  const { system, user: userMsg } = template.buildPrompt(input);

  // Per-step max tokens — step 5 (30 items) and step 7 (full dashboard) need more
  // Reasoning model uses ~5K tokens for thinking + actual output, so be generous
  const maxTokensByStep: Record<number, number> = {
    1: 8000,   // Brand card — short but reasoning-heavy
    2: 12000,  // Customer persona — medium
    3: 10000,  // Customer journey — medium
    4: 8000,   // Positioning — short
    5: 20000,  // 30-item calendar — very long
    6: 12000,  // Marketing workflow — medium
    7: 14000,  // KPI dashboard — medium-long
  };
  const maxCompletionTokens = maxTokensByStep[stepNum] || 8000;

  // Reserve credits BEFORE calling the AI. This is an atomic
  // check-and-deduct (see deductCredits), so two concurrent requests can't
  // both pass a balance check and double-spend, and a user without enough
  // credits never gets a free generation while we still pay MiniMax for it.
  // The estimate is deliberately generous (worst-case completion tokens,
  // ~3 chars/token for the prompt) — we refund the difference below once we
  // know the real usage.
  const genId = generateId();
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxCompletionTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', genId);
  if (!reservation.ok) {
    return c.json({
      error: 'insufficient_credits',
      message: 'เครดิตไม่เพียงพอ — กรุณาเติมเครดิตหรือใช้ BYOK',
      balance: reservation.balance,
      required: reserveCredits,
    }, 402);
  }

  // Call AI
  const startTime = Date.now();
  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning หรือคิดออกเสียง — ตอบ JSON object เท่านั้นใน content field' },
        { role: 'user', content: userMsg + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น ไม่ต้องคิดออกเสียง ไม่ต้องอธิบาย]' },
      ],
      { maxTokens: maxCompletionTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    console.error(`AI error step ${stepNum}:`, err);
    // No output produced — refund the full reservation.
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: genId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  // Parse JSON — try content first, fallback to reasoning
  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    console.error('Parse error step', stepNum, ':', err.message);
    console.error('Content length:', result.content.length, 'Reasoning length:', result.reasoning.length);
    if (result.reasoning) console.error('Reasoning preview:', result.reasoning.slice(0, 500));
    // AI ran (and cost us money) but produced nothing usable — still refund
    // the user, since they didn't get a generation out of it.
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: genId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 1000),
      reasoning: result.reasoning.slice(0, 1000),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  const durationMs = Date.now() - startTime;
  const costUsd = estimateCost(result.usage);

  // Save generation
  await env.DB.prepare(`
    INSERT OR REPLACE INTO generations (id, project_id, user_id, step_number, prompt_tokens, completion_tokens, total_tokens, model, output, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    genId, projectId, user.id, stepNum,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    env.MINIMAX_MODEL, JSON.stringify(output), costUsd, durationMs, Date.now()
  ).run();

  // Save to project step_data
  stepData[`step${stepNum}`] = output;
  await env.DB.prepare(
    'UPDATE projects SET step_data = ?, current_step = ?, updated_at = ? WHERE id = ?'
  ).bind(JSON.stringify(stepData), Math.max(stepNum + 1, project.current_step), Date.now(), projectId).run();

  // Reconcile the reservation against actual usage. Almost always actual
  // usage is <= what we reserved (completion is capped by maxTokens; prompt
  // estimate is generous), so this is normally a refund of the difference.
  // In the rare case actual cost is higher, try to collect the difference,
  // but never fail the request over it — the generation already happened.
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: genId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', genId);
    if (extra.ok) finalBalance = extra.balance;
  }

  return c.json({
    ok: true,
    step: stepNum,
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: durationMs,
      tokens: result.usage,
      cost_usd: costUsd,
      credits_used: creditsUsed,
      credits_remaining: finalBalance,
    },
  });
});

// =====================================================
// Standalone Tools
// =====================================================

/**
 * Pain Generator — analyze pain points using SPICE framework
 * Uses user's Minimax credits — no auth required (anyone can use it)
 */
app.post('/api/tools/pain-generator', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ชื่อธุรกิจ ประเภท และอุตสาหกรรม' }, 400);
  }

  // Email + credits gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = painGeneratorPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    console.error('Pain generator error:', err);
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    console.error('Pain parse error:', err.message);
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  // Save to usage table
  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'pain_generator', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  // Deduct credits
  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'pain-generator',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Brand Voice Generator
 */
app.post('/api/tools/brand-voice', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  // Email + credits gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = brandVoicePrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    console.error('Brand voice error:', err);
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'brand_voice', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  // Deduct credits
  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'brand-voice',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Persona Builder (for businesses without reviews)
 */
app.post('/api/tools/persona-builder', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  // Email + credits gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = personaBuilderPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'persona_builder', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  // Deduct credits
  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'persona-builder',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Competitor Analysis
 */
app.post('/api/tools/competitor-analysis', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  // Email + credits gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = competitorAnalysisPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'competitor_analysis', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'competitor-analysis',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Job-to-be-Done (JTBD) Generator
 */
app.post('/api/tools/jtbd-generator', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = jtbdGeneratorPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 10000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'jtbd_generator', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'jtbd-generator',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Value Proposition Canvas (VPC) Generator
 */
app.post('/api/tools/value-proposition-canvas', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = valuePropositionCanvasPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 10000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'value_proposition_canvas', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'value-proposition-canvas',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Business Model Canvas (BMC) Generator
 * Framework: Osterwalder + Pigneur (2010) — Business Model Generation
 * 9 Building Blocks + Pattern + SWOT + Key Assumptions
 */
app.post('/api/tools/business-model-canvas', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = bmcGeneratorPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'business_model_canvas', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'business-model-canvas',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Million Dollar Offer Tool
 * Framework: Value Equation + 7 Components + MAGIC naming
 */
app.post('/api/tools/million-dollar-offer', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = millionDollarOfferPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 12000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'million_dollar_offer', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'million-dollar-offer',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Objection Handler Tool
 * Framework: 7 Objection Categories + LAER + Reframing
 */
app.post('/api/tools/objection-handler', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = objectionHandlerPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 16000, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'objection_handler', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'objection-handler',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

/**
 * Hook Library / Headlines Tool
 * Framework: 10 Hook Formulas + Platform-specific + A/B testing
 */
app.post('/api/tools/hook-library', requireAuth, rateLimit, async (c) => {
  const env = c.env;
  const user = c.get('user')!;
  const body = await c.req.json<{ input: any }>();
  const input = body.input || {};

  if (!input.business_name || !input.business_type || !input.industry) {
    return c.json({ error: 'missing_fields', message: 'กรุณาใส่ข้อมูลธุรกิจ' }, 400);
  }

  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (false && u && u!.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }
  if ((u?.credits || 0) < 1) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ' }, 402);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = hookLibraryPrompt.buildPrompt(input);

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: 16000, temperature: 0.8, jsonMode: true }
    );
  } catch (err: any) {
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
    }, 500);
  }

  const toolRunId = generateId();
  await env.DB.prepare(`
    INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toolRunId, user.id, 'hook_library', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
    result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
    estimateCost(result.usage), Date.now() - startTime, Date.now()
  ).run();

  const creditsUsed = calculateCredits(result.usage);
  const deductResult = await deductCredits(env, user.id, creditsUsed, 'generation', toolRunId);

  return c.json({
    ok: true,
    tool: 'hook-library',
    output,
    meta: {
      model: env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: deductResult.ok ? deductResult.balance : 0,
    },
  });
});

// =====================================================
// Exports (PDF) — moved to multi-format block below
// =====================================================

app.get('/api/exports/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const env = c.env;
  const id = c.req.param('id');

  const exp = await env.DB.prepare(
    'SELECT * FROM exports WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!exp) return c.json({ error: 'not_found' }, 404);

  const obj = await env.R2.get(exp.r2_key);
  if (!obj) return c.json({ error: 'not_found_in_storage' }, 404);

  // For HTML exports (project PDF flow) — render inline so browser can print
  // For other formats (md, json, csv, doc) — force download
  const fmt = (exp.format || 'html').toLowerCase();
  const fileSize = (await obj.body?.getSize?.()) ?? 0;
  const filename = `${exp.project_id || 'export'}-${id}.${fmt}`;

  if (fmt === 'html' || fmt === 'pdf') {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header('Content-Disposition', `inline; filename="${filename}"`);
  } else {
    const mimeTypes: Record<string, string> = {
      md: 'text/markdown; charset=utf-8',
      markdown: 'text/markdown; charset=utf-8',
      json: 'application/json; charset=utf-8',
      csv: 'text/csv; charset=utf-8',
      doc: 'application/msword; charset=utf-8',
      docx: 'application/msword; charset=utf-8',
    };
    c.header('Content-Type', mimeTypes[fmt] || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
  }
  c.header('Content-Length', String(fileSize));
  c.header('Cache-Control', 'no-cache');

  return c.body(await obj.text());
});

// =====================================================
// HTML Builder (for export) — Beautiful PDF-ready layout
// =====================================================

function buildProjectHTML(project: any, stepData: any): string {
  const escape = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeArr = (v: any): any[] => Array.isArray(v) ? v : [];
  const safeStr = (v: any) => v ? escape(v) : '—';
  const stepName = (n: number) => PROMPT_TEMPLATES[n]?.name || `Step ${n}`;
  const stepHasData = (n: number) => !!stepData[`step${n}`];

  // 🔧 Normalize: some old entries stored `{input, output}` while new ones store output directly.
  // Unwrap so renderers see flat output object.
  const normalize = (d: any): any => {
    if (!d) return d;
    if (d.output && typeof d.output === 'object') return d.output;
    return d;
  };

  // Format a date in Thai
  const thaiDate = (ts: number) => new Date(ts).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Render Step 1 (Brand Card)
  const renderStep1 = (d: any) => {
    if (!d) return '';
    return `
      <div class="hero-card">
        <div class="hero-label">POSITIONING</div>
        <div class="hero-text">${safeStr(d.positioning)}</div>
      </div>
      <div class="card-grid">
        <div class="card">
          <div class="card-label">UVP — Unique Value Proposition</div>
          <div class="card-text">${safeStr(d.uvp)}</div>
        </div>
        <div class="card">
          <div class="card-label">Voice & Tone</div>
          <div class="card-text">${safeStr(d.voice_tone)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Target Audience</div>
        <div class="card-text">${safeStr(d.target_audience)}</div>
      </div>
      ${d.anti_positioning ? `<div class="card warning">
        <div class="card-label">⚠️ ไม่ใช่ลูกค้าเรา</div>
        <div class="card-text">${safeStr(d.anti_positioning)}</div>
      </div>` : ''}
    `;
  };

  // Render Step 2 (Persona)
  const renderStep2 = (d: any) => {
    const personas = safeArr(d.personas);
    if (!personas.length) return `<div class="empty">ยังไม่มีข้อมูล</div>`;
    return personas.map((p: any, i: number) => `
      <div class="persona">
        <div class="persona-header">
          <div class="persona-avatar">${(p.name || '?')[0]}</div>
          <div>
            <div class="persona-name">${safeStr(p.name)}</div>
            ${p.size_estimate ? `<div class="persona-meta">≈ ${safeStr(p.size_estimate)}</div>` : ''}
          </div>
        </div>
        ${p.demographics ? `<div class="persona-section">
          <div class="persona-section-label">ข้อมูลส่วนตัว</div>
          <div class="persona-grid">
            ${p.demographics.age ? `<div><span class="lbl">อายุ</span> ${safeStr(p.demographics.age)}</div>` : ''}
            ${p.demographics.job ? `<div><span class="lbl">อาชีพ</span> ${safeStr(p.demographics.job)}</div>` : ''}
            ${p.demographics.income ? `<div><span class="lbl">รายได้</span> ${safeStr(p.demographics.income)}</div>` : ''}
            ${p.demographics.location ? `<div><span class="lbl">ที่อยู่</span> ${safeStr(p.demographics.location)}</div>` : ''}
          </div>
        </div>` : ''}
        ${p.psychographics ? `<div class="persona-section">
          <div class="persona-section-label">จิตวิทยา</div>
          <div class="persona-grid">
            ${p.psychographics.values ? `<div><span class="lbl">ค่านิยม</span> ${safeStr(p.psychographics.values)}</div>` : ''}
            ${p.psychographics.fears ? `<div><span class="lbl">กลัว</span> ${safeStr(p.psychographics.fears)}</div>` : ''}
          </div>
        </div>` : ''}
        ${p.pain_points?.length ? `<div class="persona-section">
          <div class="persona-section-label pain">😣 Pain Points</div>
          <ul class="bullet-list">${p.pain_points.map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
        </div>` : ''}
        ${p.preferred_channels?.length ? `<div class="persona-section">
          <div class="persona-section-label">📱 ช่องทาง</div>
          <div class="tag-list">${p.preferred_channels.map((c: string) => `<span class="tag">${safeStr(c)}</span>`).join('')}</div>
        </div>` : ''}
        ${p.best_offer ? `<div class="best-offer">
          <div class="best-offer-label">🎯 ข้อเสนอที่ตรงใจ</div>
          <div>${safeStr(p.best_offer)}</div>
        </div>` : ''}
      </div>
    `).join('');
  };

  // Render Step 3 (Journey)
  const renderStep3 = (d: any) => {
    const journey = safeArr(d.journey);
    return `
      ${journey.map((s: any, i: number) => `
        <div class="journey-stage">
          <div class="journey-num">${i + 1}</div>
          <div class="journey-content">
            <div class="journey-header">
              <div class="journey-title">${safeStr(s.stage_name_th || s.stage)}</div>
              <div class="journey-subtitle">${safeStr(s.stage)}</div>
            </div>
            ${s.emotions ? `<div class="journey-emotion">
              <strong>อารมณ์:</strong> ${safeStr(s.emotions.primary)}
              ${s.emotions.secondary ? ` · ${safeStr(s.emotions.secondary)}` : ''}
              ${s.emotions.quote ? `<div class="quote">"${safeStr(s.emotions.quote)}"</div>` : ''}
            </div>` : ''}
            ${s.touchpoints?.length ? `<div class="tag-list">${s.touchpoints.map((t: string) => `<span class="tag">${safeStr(t)}</span>`).join('')}</div>` : ''}
            ${s.key_message ? `<div class="key-message"><strong>ข้อความหลัก:</strong> ${safeStr(s.key_message)}</div>` : ''}
            ${s.content_types?.length ? `<div class="meta-line">📝 ${s.content_types.map(safeStr).join(' · ')}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${safeArr(d.pain_points).length ? `
        <div class="card warning">
          <div class="card-label">⚠️ จุดเจ็บที่ต้องระวัง</div>
          ${d.pain_points.map((p: any) => `
            <div class="pain-item">
              <div class="pain-stage">${safeStr(p.stage)}</div>
              <div><strong>ปัญหา:</strong> ${safeStr(p.pain)}</div>
              <div><strong>วิธีแก้:</strong> ${safeStr(p.solution)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  };

  // Render Step 4 (Positioning)
  const renderStep4 = (d: any) => {
    return `
      <div class="hero-card">
        <div class="hero-label">POSITIONING STATEMENT</div>
        <div class="hero-text">${safeStr(d.positioning_statement)}</div>
      </div>
      ${d.positioning_one_liner ? `<div class="one-liner">"${safeStr(d.positioning_one_liner)}"</div>` : ''}
      ${safeArr(d.uvp_bullets).length ? `
        <div class="card">
          <div class="card-label">Value Bullets</div>
          <ul class="check-list">${d.uvp_bullets.map((b: string) => `<li>${safeStr(b)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${safeArr(d.tagline_options).length ? `
        <div class="card">
          <div class="card-label">Tagline Options</div>
          ${d.tagline_options.map((t: string, i: number) => `<div class="tagline">#${i+1} "${safeStr(t)}"</div>`).join('')}
        </div>
      ` : ''}
      ${d.competitive_frame ? `
        <div class="card">
          <div class="card-label">vs คู่แข่ง</div>
          ${Object.entries(d.competitive_frame).map(([k, v], i) => {
            // Map vs_competitor_N → "คู่แข่งที่ N"
            const m = k.match(/vs_competitor[_]?(\d+)/i) || k.match(/competitor[_]?(\d+)/i);
            const label = m ? `คู่แข่งที่ ${m[1]}` : safeStr(k);
            return `<div class="vs-item"><span class="lbl">${label}:</span> ${safeStr(v)}</div>`;
          }).join('')}
        </div>
      ` : ''}
      ${d.elevator_pitch ? `<div class="card warning">
        <div class="card-label">⏱️ 30-Second Elevator Pitch</div>
        <div class="card-text">${safeStr(d.elevator_pitch)}</div>
      </div>` : ''}
    `;
  };

  // Render Step 5 (Content Calendar)
  const renderStep5 = (d: any) => {
    const cal = safeArr(d.calendar);
    if (!cal.length) return '<div class="empty">ยังไม่มีข้อมูล</div>';
    return `
      <div class="meta-line" style="font-weight: 600; margin-bottom: 16px;">
        📅 ${cal.length} โพสต์ · ${cal.filter((p: any) => p.pillar === 'awareness').length} awareness · ${cal.filter((p: any) => p.pillar === 'education').length} education · ${cal.filter((p: any) => p.pillar === 'social_proof').length} social proof · ${cal.filter((p: any) => p.pillar === 'conversion').length} conversion
      </div>
      <div class="calendar-grid">
        ${cal.map((p: any) => `
          <div class="calendar-item">
            <div class="cal-header">
              <span class="cal-day">Day ${p.day}</span>
              <span class="cal-pillar pillar-${p.pillar}">${p.pillar}</span>
            </div>
            <div class="cal-meta">${p.platform} · ${p.format}</div>
            <div class="cal-hook">"${safeStr(p.hook)}"</div>
            <div class="cal-caption">${safeStr(p.caption)}</div>
            <div class="cal-cta">→ ${safeStr(p.cta)}</div>
            ${p.hashtags?.length ? `<div class="cal-hashtags">${p.hashtags.map(safeStr).join(' ')}</div>` : ''}
            ${p.visual_suggestion ? `<div class="cal-visual">🎨 ${safeStr(p.visual_suggestion)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // Render Step 6 (Marketing Workflow)
  const renderStep6 = (d: any) => {
    const workflows = safeArr(d.workflows);
    return `
      ${workflows.map((wf: any) => `
        <div class="workflow">
          <div class="workflow-header">
            <div>
              <div class="workflow-name">${safeStr(wf.name)}</div>
              <div class="workflow-meta">ID: ${safeStr(wf.id)} · ${safeStr(wf.type)}</div>
            </div>
            <div class="workflow-saved">
              <div class="big-num">-${wf.time_saved_pct}%</div>
              <div class="small-lbl">เวลา</div>
            </div>
          </div>
          <div class="time-row">
            <div class="time-before">ก่อน: ${safeStr(wf.time_before)}</div>
            <div class="time-after">หลัง: ${safeStr(wf.time_after)}</div>
          </div>
          ${safeArr(wf.steps).length ? `
            <div class="steps-list">
              <div class="card-label">ขั้นตอน</div>
              ${wf.steps.map((s: any) => `
                <div class="step-item">
                  <span class="step-num">${s.step}</span>
                  <div>
                    <div class="step-action">${safeStr(s.action)}</div>
                    <div class="step-meta">⏱ ${safeStr(s.duration)} · 📦 ${safeStr(s.output)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${wf.tools_used?.length ? `<div class="meta-line">🛠 <strong>เครื่องมือ:</strong> ${wf.tools_used.map(safeStr).join(', ')} (~${wf.tools_cost_monthly} บาท/เดือน)</div>` : ''}
          <div class="meta-line">📊 <strong>KPI:</strong> ${safeStr(wf.kpi)} · <strong>ความถี่:</strong> ${safeStr(wf.frequency)}</div>
        </div>
      `).join('')}
      ${d.voice_guide ? `
        <div class="voice-guide">
          <div class="card-label">🎙️ Voice Guide</div>
          <div class="voice-tone">${safeStr(d.voice_guide.tone)}</div>
          <div class="voice-grid">
            <div>
              <div class="card-label" style="color: #16a34a;">✅ ควรทำ</div>
              <ul class="bullet-list">${safeArr(d.voice_guide.do).map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
            </div>
            <div>
              <div class="card-label" style="color: #dc2626;">❌ ไม่ควรทำ</div>
              <ul class="bullet-list">${safeArr(d.voice_guide.dont).map((x: string) => `<li>${safeStr(x)}</li>`).join('')}</ul>
            </div>
          </div>
          ${safeArr(d.voice_guide.sample_phrases).length ? `
            <div class="sample-phrases">
              <div class="card-label">ตัวอย่างประโยค</div>
              ${d.voice_guide.sample_phrases.map((p: string) => `<div class="sample-phrase">"${safeStr(p)}"</div>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;
  };

  // Render Step 7 (KPI Dashboard)
  const renderStep7 = (d: any) => {
    const kpis = safeArr(d.kpis);
    return `
      <div class="kpi-grid">
        ${kpis.map((k: any) => `
          <div class="kpi-card">
            <div class="kpi-id">${safeStr(k.id)}</div>
            <div class="kpi-name">${safeStr(k.name)}</div>
            <div class="kpi-progress">
              <div class="kpi-current">
                <div class="kpi-num">${k.current || 0}</div>
                <div class="kpi-lbl">ปัจจุบัน</div>
              </div>
              <div class="kpi-arrow">→</div>
              <div class="kpi-30d">
                <div class="kpi-num green">${k.target_30d || 0}</div>
                <div class="kpi-lbl">30 วัน</div>
              </div>
              <div class="kpi-arrow">→</div>
              <div class="kpi-90d">
                <div class="kpi-num blue">${k.target_90d || 0}</div>
                <div class="kpi-lbl">90 วัน</div>
              </div>
            </div>
            <div class="kpi-meta">
              <div><span class="lbl">หน่วย:</span> ${safeStr(k.unit)}</div>
              <div><span class="lbl">เครื่องมือ:</span> ${safeStr(k.tool)}</div>
              <div><span class="lbl">ความถี่:</span> ${safeStr(k.frequency)}</div>
              <div><span class="lbl">คนดูแล:</span> ${safeStr(k.owner)}</div>
            </div>
            ${k.action_if_below ? `<div class="kpi-action">⚠️ ถ้าต่ำกว่าเป้า: ${safeStr(k.action_if_below)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${d.action_plan_30d ? `
        <div class="card">
          <div class="card-label">📅 Action Plan 30 วัน</div>
          ${Object.entries(d.action_plan_30d).map(([week, plan]: [string, any]) => `
            <div class="week-block">
              <div class="week-label">${week}</div>
              <div class="week-theme">${safeStr(plan.theme)}</div>
              ${plan.tasks?.length ? `<ul class="bullet-list">${plan.tasks.map((t: string) => `<li>${safeStr(t)}</li>`).join('')}</ul>` : ''}
              ${plan.outcome ? `<div class="meta-line">🎯 ${safeStr(plan.outcome)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${d.review_ritual ? `
        <div class="card warning">
          <div class="card-label">🔁 Review Ritual</div>
          ${d.review_ritual.daily ? `<div><strong>ทุกวัน:</strong> ${safeStr(d.review_ritual.daily)}</div>` : ''}
          ${d.review_ritual.weekly ? `<div><strong>ทุกสัปดาห์:</strong> ${safeStr(d.review_ritual.weekly)}</div>` : ''}
          ${d.review_ritual.monthly ? `<div><strong>ทุกเดือน:</strong> ${safeStr(d.review_ritual.monthly)}</div>` : ''}
        </div>
      ` : ''}
    `;
  };

  const renderers: Record<number, (d: any) => string> = {
    1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4,
    5: renderStep5, 6: renderStep6, 7: renderStep7,
  };

  const completedSteps = STEPS.filter(n => stepHasData(n));

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escape(project.name)} — Marketing System</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  :root {
    --primary: #3b82f6;
    --primary-dark: #1d4ed8;
    --primary-light: #eff6ff;
    --warning: #fef3c7;
    --warning-border: #fbbf24;
    --success: #dcfce7;
    --success-border: #22c55e;
    --danger: #fee2e2;
    --text: #0f172a;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }
  body {
    font-family: 'Noto Sans Thai', 'Inter', -apple-system, sans-serif;
    max-width: 880px; margin: 0 auto; padding: 0;
    color: var(--text); line-height: 1.65;
    background: white;
  }
  .cover {
    height: 100vh; min-height: 700px;
    background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%);
    color: white;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 60px 40px;
    text-align: center;
    page-break-after: always;
    position: relative;
  }
  .cover::after {
    content: 'BusinessAiOs'; position: absolute; bottom: 30px;
    font-size: 14px; opacity: 0.7; letter-spacing: 2px;
  }
  .cover-badge {
    display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.2);
    border-radius: 99px; font-size: 13px; font-weight: 500;
    margin-bottom: 24px; backdrop-filter: blur(10px);
  }
  .cover h1 {
    font-size: 48px; font-weight: 800; margin: 0 0 20px; line-height: 1.2;
    max-width: 700px;
  }
  .cover-subtitle {
    font-size: 20px; opacity: 0.95; max-width: 600px; line-height: 1.5;
    margin-bottom: 40px;
  }
  .cover-meta {
    display: flex; gap: 32px; flex-wrap: wrap; justify-content: center;
    font-size: 14px; opacity: 0.9;
  }
  .cover-meta-item {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .cover-meta-label { opacity: 0.7; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta-value { font-weight: 600; font-size: 16px; }

  .toc {
    page-break-after: always;
    padding: 60px 40px;
  }
  .toc h2 {
    color: var(--primary-dark); font-size: 28px; margin: 0 0 32px;
    padding-bottom: 12px; border-bottom: 2px solid var(--primary);
  }
  .toc-item {
    display: flex; align-items: center; padding: 14px 16px;
    border-radius: 10px; margin-bottom: 8px;
    background: #f8fafc; border-left: 4px solid var(--primary);
  }
  .toc-item.pending { opacity: 0.4; border-left-color: var(--border); background: #fafafa; }
  .toc-num {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--primary); color: white;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; margin-right: 16px; font-size: 14px;
  }
  .toc-item.pending .toc-num { background: #cbd5e1; }
  .toc-name { font-weight: 600; font-size: 16px; flex: 1; }
  .toc-status { font-size: 12px; color: var(--text-muted); padding: 4px 10px; background: white; border-radius: 99px; }
  .toc-status.done { color: #16a34a; background: var(--success); }
  .toc-status.pending { color: #64748b; }

  .section {
    padding: 40px 40px 60px;
    page-break-before: always;
  }
  .section-header {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 32px; padding-bottom: 16px;
    border-bottom: 2px solid var(--primary);
  }
  .section-num {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  }
  .section-title { font-size: 32px; font-weight: 700; color: var(--text); margin: 0; }
  .section-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

  .empty {
    text-align: center; padding: 40px; color: var(--text-muted);
    background: #f8fafc; border-radius: 12px; font-style: italic;
  }

  /* Cards */
  .hero-card {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; padding: 32px; border-radius: 16px;
    margin-bottom: 24px; box-shadow: 0 8px 24px rgba(29, 78, 216, 0.15);
  }
  .hero-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85; margin-bottom: 12px; }
  .hero-text { font-size: 22px; font-weight: 600; line-height: 1.4; }
  .one-liner {
    background: white; border: 3px solid var(--primary);
    padding: 24px; border-radius: 12px; margin-bottom: 24px;
    text-align: center; font-size: 20px; font-weight: 600;
    color: var(--primary-dark);
  }
  .card {
    background: white; border: 1px solid var(--border);
    padding: 20px 24px; border-radius: 12px; margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .card.warning { background: var(--warning); border-color: var(--warning-border); border-left: 6px solid var(--warning-border); }
  .card.success { background: var(--success); border-color: var(--success-border); border-left: 6px solid var(--success-border); }
  .card-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; color: var(--primary); margin-bottom: 8px;
  }
  .card.warning .card-label { color: #b45309; }
  .card.success .card-label { color: #15803d; }
  .card-text { font-size: 15px; line-height: 1.6; color: var(--text); }
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card-grid .card { margin-bottom: 0; }

  /* Persona */
  .persona {
    background: white; border: 1px solid var(--border);
    border-radius: 16px; padding: 24px; margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .persona-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .persona-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), #60a5fa);
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
  }
  .persona-name { font-size: 18px; font-weight: 700; color: var(--text); }
  .persona-meta { font-size: 12px; color: var(--text-muted); }
  .persona-section { margin: 16px 0; padding-top: 16px; border-top: 1px solid var(--border); }
  .persona-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: var(--primary); margin-bottom: 8px;
  }
  .persona-section-label.pain { color: #dc2626; }
  .persona-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
  .persona-grid > div { padding: 4px 0; }
  .persona-grid .lbl { color: var(--text-muted); margin-right: 6px; }
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tag {
    background: var(--primary-light); color: var(--primary-dark);
    padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 500;
  }
  .best-offer {
    background: var(--success); border-left: 6px solid var(--success-border);
    padding: 16px; border-radius: 8px; margin-top: 16px;
    font-size: 14px; line-height: 1.5;
  }
  .best-offer-label {
    font-size: 11px; font-weight: 700; color: #15803d;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;
  }
  .bullet-list, .check-list { margin: 8px 0; padding-left: 20px; font-size: 14px; }
  .check-list { list-style: none; padding-left: 0; }
  .check-list li { padding: 4px 0 4px 24px; position: relative; }
  .check-list li::before { content: '✓'; color: var(--primary); font-weight: 700; position: absolute; left: 0; }

  /* Journey */
  .journey-stage { display: flex; gap: 20px; margin-bottom: 20px; page-break-inside: avoid; }
  .journey-num {
    flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  }
  .journey-content { flex: 1; background: white; border: 1px solid var(--border); padding: 20px; border-radius: 12px; }
  .journey-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .journey-title { font-size: 18px; font-weight: 700; color: var(--text); }
  .journey-subtitle { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
  .journey-emotion { font-size: 14px; color: var(--text-muted); margin: 8px 0; }
  .quote { font-style: italic; color: var(--text-muted); padding-left: 12px; border-left: 3px solid var(--border); margin-top: 8px; }
  .key-message { background: var(--primary-light); border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 6px; margin: 12px 0; font-size: 14px; }
  .meta-line { font-size: 13px; color: var(--text-muted); margin-top: 8px; }
  .pain-item { padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }
  .pain-item:last-child { border-bottom: none; }
  .pain-stage { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 1px; margin-bottom: 4px; }

  /* Tagline */
  .tagline { padding: 10px 16px; background: #f1f5f9; border-radius: 8px; margin: 6px 0; font-style: italic; font-size: 15px; }
  .vs-item { font-size: 14px; padding: 4px 0; }
  .vs-item .lbl { color: var(--text-muted); font-family: monospace; font-size: 12px; margin-right: 8px; }

  /* Calendar */
  .calendar-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .calendar-item {
    background: white; border: 1px solid var(--border);
    padding: 14px; border-radius: 10px; page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .cal-day { font-size: 11px; font-weight: 700; color: var(--primary); }
  .cal-pillar { font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; text-transform: uppercase; }
  .pillar-awareness { background: #dbeafe; color: #1e40af; }
  .pillar-education { background: #f3e8ff; color: #6b21a8; }
  .pillar-social_proof { background: #dcfce7; color: #15803d; }
  .pillar-conversion { background: #fef3c7; color: #b45309; }
  .cal-meta { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .cal-hook { font-size: 14px; font-weight: 600; margin-bottom: 6px; line-height: 1.4; }
  .cal-caption { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.5; white-space: pre-line; }
  .cal-cta { font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 6px; }
  .cal-hashtags { font-size: 11px; color: var(--primary); margin-top: 6px; }
  .cal-visual { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }

  /* Workflow */
  .workflow {
    background: white; border: 1px solid var(--border);
    padding: 20px; border-radius: 12px; margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .workflow-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .workflow-name { font-size: 17px; font-weight: 700; }
  .workflow-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .workflow-saved { text-align: center; }
  .big-num { font-size: 32px; font-weight: 800; color: #16a34a; line-height: 1; }
  .small-lbl { font-size: 11px; color: var(--text-muted); }
  .time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .time-before, .time-after { padding: 8px 12px; border-radius: 6px; text-align: center; font-size: 13px; }
  .time-before { background: var(--danger); color: #b91c1c; }
  .time-after { background: var(--success); color: #15803d; }
  .steps-list { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .step-item { display: flex; gap: 12px; padding: 8px 0; }
  .step-num {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
    background: var(--primary-light); color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .step-action { font-size: 14px; font-weight: 500; }
  .step-meta { font-size: 11px; color: var(--text-muted); }
  .voice-guide {
    background: linear-gradient(135deg, var(--primary-light), white);
    border: 1px solid var(--primary);
    padding: 20px; border-radius: 12px; margin-top: 16px;
  }
  .voice-tone { font-size: 16px; font-weight: 600; color: var(--primary-dark); margin-bottom: 12px; }
  .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sample-phrases { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--primary); }
  .sample-phrase { font-style: italic; padding: 6px 0; color: var(--text); font-size: 14px; }

  /* KPI */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .kpi-card {
    background: white; border: 1px solid var(--border);
    padding: 16px; border-radius: 10px; page-break-inside: avoid;
  }
  .kpi-id { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
  .kpi-name { font-size: 14px; font-weight: 700; margin: 4px 0 12px; }
  .kpi-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .kpi-current, .kpi-30d, .kpi-90d { flex: 1; text-align: center; }
  .kpi-num { font-size: 22px; font-weight: 800; color: var(--text-muted); }
  .kpi-num.green { color: #16a34a; }
  .kpi-num.blue { color: var(--primary); }
  .kpi-lbl { font-size: 10px; color: var(--text-muted); }
  .kpi-arrow { color: var(--text-muted); font-size: 14px; }
  .kpi-meta { font-size: 11px; color: var(--text-muted); }
  .kpi-meta > div { padding: 2px 0; }
  .kpi-meta .lbl { color: var(--text-muted); margin-right: 4px; }
  .kpi-action {
    margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);
    font-size: 11px; color: #b45309;
  }
  .week-block { padding: 12px 0; border-bottom: 1px solid var(--border); }
  .week-block:last-child { border-bottom: none; }
  .week-label { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; }
  .week-theme { font-size: 15px; font-weight: 700; margin: 4px 0; }

  .footer-page {
    page-break-before: always;
    background: linear-gradient(135deg, #1d4ed8, #3b82f6);
    color: white; min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    text-align: center; padding: 60px 40px;
  }
  .footer-page h2 { font-size: 36px; margin-bottom: 16px; }
  .footer-page p { font-size: 18px; opacity: 0.95; max-width: 600px; line-height: 1.6; }
  .footer-brand { margin-top: 60px; font-size: 14px; opacity: 0.7; }

  /* Print styles */
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    body { padding: 0; }
    .cover, .footer-page { min-height: 100vh; }
    .section { padding: 40px 40px 60px; }
    .toc { padding: 40px 40px; }
  }
  @media screen {
    body { padding: 0 0 60px; }
    .cover, .footer-page { min-height: 100vh; }
  }

  /* No-print controls (for browser print) */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: var(--primary); color: white; padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .print-bar button {
    background: white; color: var(--primary); border: none;
    padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;
  }
  .print-bar button:hover { background: #f1f5f9; }
  @media print { .print-bar { display: none; } }
  .print-bar-spacer { height: 60px; }
  @media print { .print-bar-spacer { display: none; } }
</style>
</head>
<body>
  <div class="print-bar">
    <div>📄 ${escape(project.name)} — Marketing System</div>
    <button onclick="window.print()">🖨️ Save as PDF (Cmd/Ctrl+P)</button>
  </div>
  <div class="print-bar-spacer"></div>

  <!-- COVER -->
  <div class="cover">
    <div class="cover-badge">✨ Marketing System</div>
    <h1>${escape(project.name)}</h1>
    <div class="cover-subtitle">${escape(project.industry || 'Business')} · Marketing Playbook</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Generated</div>
        <div class="cover-meta-value">${thaiDate(project.created_at)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Steps Completed</div>
        <div class="cover-meta-value">${completedSteps.length} / 7</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Status</div>
        <div class="cover-meta-value">${escape(project.status)}</div>
      </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="toc">
    <h2>📑 สารบัญ</h2>
    ${STEPS.map(n => {
      const done = stepHasData(n);
      const cls = done ? '' : 'pending';
      return `<div class="toc-item ${cls}">
        <div class="toc-num">${n}</div>
        <div class="toc-name">${escape(stepName(n))}</div>
        <div class="toc-status ${done ? 'done' : 'pending'}">${done ? '✓ เสร็จ' : 'ยังไม่สร้าง'}</div>
      </div>`;
    }).join('')}
  </div>

  <!-- SECTIONS -->
  ${STEPS.map(n => {
    const data = normalize(stepData[`step${n}`]);
    const content = data ? renderers[n](data) : `<div class="empty">ยังไม่ได้สร้าง — กลับไปที่ Step ${n} ใน BusinessAiOs เพื่อสร้างเนื้อหา</div>`;
    return `<div class="section">
      <div class="section-header">
        <div class="section-num">${n}</div>
        <div>
          <div class="section-title">${escape(stepName(n))}</div>
          <div class="section-subtitle">Step ${n} of 7</div>
        </div>
      </div>
      ${content}
    </div>`;
  }).join('\n')}

  <!-- FOOTER PAGE -->
  <div class="footer-page">
    <h2>🚀 พร้อมใช้งานแล้ว!</h2>
    <p>คุณได้ Marketing System ครบชุด พร้อมวางแผนและลงมือทำ</p>
    <div class="footer-brand">BusinessAiOs · Operating System for AI Business</div>
  </div>
</body>
</html>`;
}

// =====================================================
// Email helpers + verification flows
// =====================================================

async function sendVerificationEmail(env: Bindings, userId: string, email: string, name: string | null) {
  const token = generateToken(32);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h

  await env.DB.prepare(`
    INSERT INTO email_verifications (id, user_id, email, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(generateId(), userId, email, token, expiresAt, Date.now()).run();

  const origin = env.WEB_URL || 'https://businessaios-web.pskspace.workers.dev';
  const verifyUrl = `${origin}/verify-email?token=${token}`;

  await sendEmail(env, {
    to: email,
    ...emailVerifyTemplate({ name: name || undefined, verifyUrl }),
    template: 'email_verify',
  });
}

// =====================================================
// Google OAuth (Social Login)
// =====================================================

/**
 * Start Google OAuth flow
 * Redirects user to Google's consent screen
 *
 * Requires env:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET (only needed for callback)
 *   - GOOGLE_REDIRECT_URI (e.g. https://api.businessaios.com/api/auth/google/callback)
 *
 * If not configured → returns 503 so frontend can show "Google login not configured"
 */
app.get('/api/auth/google', async (c) => {
  const clientId = (c.env as any).GOOGLE_CLIENT_ID;
  const redirectUri = (c.env as any).GOOGLE_REDIRECT_URI
    || `${new URL(c.req.url).origin}/api/auth/google/callback`;

  if (!clientId) {
    return c.json({
      error: 'google_oauth_not_configured',
      message: 'Google OAuth ยังไม่ได้ตั้งค่า — ติดต่อ admin',
    }, 503);
  }

  // Build Google OAuth URL
  const state = generateToken();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  // Optional: store state in cookie for CSRF check
  c.header('Set-Cookie', `google_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/**
 * Google OAuth callback
 * Receives code, exchanges for access token, gets user info,
 * creates or logs in user, sets session cookie, redirects to dashboard
 */
app.get('/api/auth/google/callback', async (c) => {
  const clientId = (c.env as any).GOOGLE_CLIENT_ID;
  const clientSecret = (c.env as any).GOOGLE_CLIENT_SECRET;
  const redirectUri = (c.env as any).GOOGLE_REDIRECT_URI
    || `${new URL(c.req.url).origin}/api/auth/google/callback`;
  const webUrl = (c.env as any).WEB_URL || 'https://businessaios-web.pskspace.workers.dev';

  if (!clientId || !clientSecret) {
    return c.redirect(`${webUrl}/login?error=google_oauth_not_configured`);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${webUrl}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect(`${webUrl}/login?error=no_code`);
  }

  // Verify state
  const stateCookie = c.req.header('Cookie')?.match(/google_oauth_state=([^;]+)/)?.[1];
  if (state && stateCookie && state !== stateCookie) {
    return c.redirect(`${webUrl}/login?error=state_mismatch`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[Google OAuth] token exchange failed:', await tokenRes.text());
      return c.redirect(`${webUrl}/login?error=token_exchange_failed`);
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return c.redirect(`${webUrl}/login?error=userinfo_failed`);
    }

    const userInfo: any = await userInfoRes.json();
    const googleId = userInfo.id;
    const email = (userInfo.email || '').toLowerCase().trim();
    const name = userInfo.name || email.split('@')[0];
    const avatarUrl = userInfo.picture || null;
    const emailVerified = !!userInfo.verified_email;

    if (!email) {
      return c.redirect(`${webUrl}/login?error=no_email`);
    }

    // Find or create user
    const existing: any = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? OR id = ?')
      .bind(email, `google_${googleId}`).first();

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update with Google info if missing
      if (!existing.avatar_url && avatarUrl) {
        await c.env.DB.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?')
          .bind(avatarUrl, Date.now(), userId).run();
      }
      // Always mark email verified (Google already verified it)
      if (emailVerified && !existing.email_verified) {
        await c.env.DB.prepare('UPDATE users SET email_verified = 1, email_verified_at = ?, updated_at = ? WHERE id = ?')
          .bind(Date.now(), Date.now(), userId).run();
      }
    } else {
      // Create new user
      userId = generateId();
      const now = Date.now();
      // Use Google ID prefixed so we know it's OAuth-created
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, name, first_name, last_name, plan, locale, credits, email_verified, email_verified_at, avatar_url, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'free', 'th', 100, ?, ?, ?, 'user', ?, ?)
      `).bind(
        userId,
        email,
        name,
        userInfo.given_name || name.split(' ')[0],
        userInfo.family_name || (name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : ''),
        emailVerified ? 1 : 1, // Google verified → always set 1
        emailVerified ? Date.now() : null,
        avatarUrl,
        now,
        now
      ).run();

      // Add signup credit (200 credits — enough to try most tools)
      await addCredits(c.env, userId, 200, 'signup_bonus', { note: 'Google OAuth signup' });
    }

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await c.env.DB.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(sessionToken, userId, expiresAt, Date.now(),
      c.req.header('user-agent')?.slice(0, 500) || null,
      c.req.header('cf-connecting-ip') || null).run();

    // Set session cookie + redirect
    const cookieExpired = Math.floor(SESSION_TTL_MS / 1000);
    const headers = new Headers();
    headers.set('Location', `${webUrl}/dashboard?google_login=success`);
    headers.set('Set-Cookie',
      `session=${sessionToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${cookieExpired}`);
    headers.append('Set-Cookie', `google_oauth_state=; Path=/; Max-Age=0`);

    return new Response(null, { status: 302, headers });
  } catch (err: any) {
    console.error('[Google OAuth] error:', err);
    return c.redirect(`${webUrl}/login?error=oauth_error`);
  }
});


// =====================================================
// Auth v2: Verification, Password Reset, 2FA
// =====================================================

app.post('/api/auth/send-verification', requireAuth, async (c) => {
  const user = c.get('user')!;
  const full = await c.env.DB.prepare('SELECT email, name, email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email: string; name: string | null; email_verified: number }>();

  if (!full) return c.json({ error: 'user_not_found' }, 404);
  if (full.email_verified) return c.json({ ok: true, already_verified: true });

  await sendVerificationEmail(c.env, user.id, full.email, full.name);
  return c.json({ ok: true, message: 'ส่งอีเมลยืนยันแล้ว' });
});

app.post('/api/auth/verify-email', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ token?: string }>();
  if (!body.token) return c.json({ error: 'missing_token' }, 400);

  const row = await env.DB.prepare(`
    SELECT id, user_id, expires_at, used FROM email_verifications
    WHERE token = ? ORDER BY created_at DESC LIMIT 1
  `).bind(body.token).first<{ id: string; user_id: string; expires_at: number; used: number }>();

  if (!row) return c.json({ error: 'invalid_token' }, 400);
  if (row.used) return c.json({ error: 'token_used' }, 400);
  if (row.expires_at < Date.now()) return c.json({ error: 'token_expired' }, 400);

  await env.DB.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').bind(row.id).run();
  await env.DB.prepare('UPDATE users SET email_verified = 1, email_verified_at = ?, updated_at = ? WHERE id = ?')
    .bind(Date.now(), Date.now(), row.user_id).run();

  return c.json({ ok: true, message: 'ยืนยันอีเมลสำเร็จ' });
});

app.post('/api/auth/request-reset', rateLimit, async (c) => {
  const env = c.env;
  const body = await c.req.json<{ email?: string; turnstile_token?: string }>();

  const turnstileCheck = await verifyTurnstile(env, body.turnstile_token);
  if (!turnstileCheck.ok) return c.json({ error: 'turnstile_failed' }, 400);

  if (!body.email || !EMAIL_REGEX.test(body.email.trim().toLowerCase())) {
    return c.json({ error: 'invalid_email' }, 400);
  }
  const email = body.email.trim().toLowerCase();

  // Always return ok (don't reveal if email exists)
  const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?')
    .bind(email).first<{ id: string; name: string | null }>();

  if (user) {
    const otp = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min
    await env.DB.prepare(`
      INSERT INTO otp_codes (id, user_id, purpose, code, expires_at, created_at)
      VALUES (?, ?, 'password_reset', ?, ?, ?)
    `).bind(generateId(), user.id, otp, expiresAt, Date.now()).run();

    await sendEmail(env, {
      to: email,
      ...passwordResetOTPTemplate({ name: user.name || undefined, otp, expiresInMinutes: 15 }),
      template: 'password_reset',
    });
  }

  return c.json({ ok: true, message: 'หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับรหัส OTP' });
});

app.post('/api/auth/reset-password', rateLimit, async (c) => {
  const env = c.env;
  const body = await c.req.json<{ email?: string; otp?: string; new_password?: string }>();

  if (!body.email || !body.otp || !body.new_password) {
    return c.json({ error: 'missing_fields' }, 400);
  }
  if (body.new_password.length < 8) {
    return c.json({ error: 'weak_password' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email).first<{ id: string }>();

  if (!user) return c.json({ error: 'invalid_otp' }, 400);

  const otpRow = await env.DB.prepare(`
    SELECT id, expires_at FROM otp_codes
    WHERE user_id = ? AND purpose = 'password_reset' AND code = ? AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).bind(user.id, body.otp).first<{ id: string; expires_at: number }>();

  if (!otpRow || otpRow.expires_at < Date.now()) {
    return c.json({ error: 'invalid_otp' }, 400);
  }

  await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otpRow.id).run();
  const newHash = await hashPassword(body.new_password);
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, Date.now(), user.id).run();

  // Invalidate all sessions
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

  return c.json({ ok: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
});

// =====================================================
// Profile (v2)
// =====================================================

app.put('/api/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    first_name?: string; last_name?: string; phone?: string; name?: string; locale?: string;
  }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.first_name !== undefined) { updates.push('first_name = ?'); values.push(body.first_name.trim() || null); }
  if (body.last_name !== undefined) { updates.push('last_name = ?'); values.push(body.last_name.trim() || null); }
  if (body.phone !== undefined) { updates.push('phone = ?'); values.push(body.phone.trim() || null); }
  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name.trim() || null); }
  if (body.locale !== undefined) { updates.push('locale = ?'); values.push(body.locale); }

  if (updates.length === 0) return c.json({ ok: true, message: 'ไม่มีการเปลี่ยนแปลง' });

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(user.id);

  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ ok: true });
});

app.post('/api/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ data_url?: string; content_type?: string }>();

  if (!body.data_url?.startsWith('data:image/')) {
    return c.json({ error: 'invalid_image' }, 400);
  }

  // Parse data URL
  const match = body.data_url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return c.json({ error: 'invalid_data_url' }, 400);
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));

  // Limit 1MB
  if (bytes.length > 1024 * 1024) {
    return c.json({ error: 'too_large', message: 'รูปต้องไม่เกิน 1MB' }, 400);
  }

  const key = `avatars/${user.id}.${ext}`;
  await c.env.R2.put(key, bytes, {
    httpMetadata: { contentType: `image/${match[1]}` },
  });

  const avatarUrl = `/api/me/avatar?v=${Date.now()}`;
  await c.env.DB.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?')
    .bind(avatarUrl, Date.now(), user.id).run();

  return c.json({ ok: true, avatar_url: avatarUrl });
});

app.get('/api/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')!;
  // Try webp, jpg, png
  for (const ext of ['webp', 'jpg', 'png']) {
    const obj = await c.env.R2.get(`avatars/${user.id}.${ext}`);
    if (obj) {
      const buf = await obj.arrayBuffer();
      return new Response(buf, {
        headers: {
          'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }
  }
  return c.json({ error: 'not_found' }, 404);
});

app.post('/api/me/change-password', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ old_password?: string; new_password?: string }>();

  if (!body.old_password || !body.new_password) {
    return c.json({ error: 'missing_fields' }, 400);
  }
  if (body.new_password.length < 8) {
    return c.json({ error: 'weak_password' }, 400);
  }

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id).first<{ password_hash: string }>();

  if (!row || !(await verifyPassword(body.old_password, row.password_hash))) {
    return c.json({ error: 'invalid_old_password' }, 401);
  }

  const newHash = await hashPassword(body.new_password);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, Date.now(), user.id).run();

  return c.json({ ok: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
});

app.get('/api/me/credits', requireAuth, async (c) => {
  const user = c.get('user')!;
  const balance = await getCredits(c.env, user.id);
  const history = await getCreditHistory(c.env, user.id, 20);
  return c.json({ ok: true, balance, history });
});

// 2FA
app.post('/api/me/2fa/toggle', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ enabled?: boolean }>();
  const enabled = !!body.enabled;
  await c.env.DB.prepare('UPDATE users SET two_factor_enabled = ?, updated_at = ? WHERE id = ?')
    .bind(enabled ? 1 : 0, Date.now(), user.id).run();
  return c.json({ ok: true, two_factor_enabled: enabled });
});

// =====================================================
// BYOK — API Keys
// =====================================================

app.get('/api/keys', requireAuth, async (c) => {
  const user = c.get('user')!;
  const keys = await c.env.DB.prepare(`
    SELECT id, provider, key_hint, label, is_active, last_used_at, created_at
    FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
  `).bind(user.id).all();
  return c.json({ keys: keys.results || [] });
});

app.post('/api/keys', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ provider?: string; api_key?: string; label?: string }>();

  if (!body.provider || !body.api_key) {
    return c.json({ error: 'missing_fields' }, 400);
  }
  if (!['minimax', 'openai', 'anthropic'].includes(body.provider)) {
    return c.json({ error: 'unsupported_provider' }, 400);
  }

  const masterSecret = getMasterSecret(c.env);
  const encrypted = await encryptText(body.api_key, masterSecret);
  const keyHint = '...' + body.api_key.slice(-4);

  const id = generateId();
  await c.env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, provider, encrypted_key, key_hint, label, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(id, user.id, body.provider, encrypted, keyHint, body.label?.trim() || null, Date.now()).run();

  return c.json({ ok: true, key: { id, provider: body.provider, key_hint: keyHint, label: body.label } });
});

app.put('/api/keys/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ api_key?: string; label?: string; is_active?: boolean }>();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM api_keys WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();

  if (!existing) return c.json({ error: 'not_found' }, 404);

  const updates: string[] = [];
  const values: any[] = [];

  if (body.api_key) {
    const masterSecret = getMasterSecret(c.env);
    const encrypted = await encryptText(body.api_key, masterSecret);
    updates.push('encrypted_key = ?');
    values.push(encrypted);
    updates.push('key_hint = ?');
    values.push('...' + body.api_key.slice(-4));
  }
  if (body.label !== undefined) { updates.push('label = ?'); values.push(body.label.trim() || null); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

  if (updates.length === 0) return c.json({ ok: true, message: 'ไม่มีการเปลี่ยนแปลง' });

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ ok: true });
});

app.delete('/api/keys/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
    .bind(id, user.id).run();
  return c.json({ ok: true });
});

/**
 * Internal: get decrypted API key for AI calls.
 */
async function getUserApiKey(env: Bindings, userId: string, provider: string): Promise<string | null> {
  const row = await env.DB.prepare(`
    SELECT encrypted_key FROM api_keys
    WHERE user_id = ? AND provider = ? AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId, provider).first<{ encrypted_key: string }>();

  if (!row) return null;

  const masterSecret = getMasterSecret(env);
  return await decryptText(row.encrypted_key, masterSecret);
}

// =====================================================
// Saved Tool Runs
// =====================================================

app.post('/api/tools/save', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ tool_type?: string; title?: string; input?: any; output?: any }>();

  if (!body.tool_type) return c.json({ error: 'missing_tool_type' }, 400);
  if (!['pain_generator', 'brand_voice', 'persona_builder', 'competitor_analysis', 'jtbd_generator', 'value_proposition_canvas', 'business_model_canvas', 'million_dollar_offer', 'objection_handler', 'hook_library'].includes(body.tool_type)) {
    return c.json({ error: 'invalid_tool_type' }, 400);
  }

  const id = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO tool_saves (id, user_id, tool_type, title, input, output, archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id, user.id, body.tool_type,
    body.title?.trim() || `${body.tool_type} - ${new Date(now).toLocaleDateString('th-TH')}`,
    JSON.stringify(body.input || {}),
    JSON.stringify(body.output || {}),
    now, now
  ).run();

  return c.json({ ok: true, id });
});

app.get('/api/tools/saved', requireAuth, async (c) => {
  const user = c.get('user')!;
  const archived = c.req.query('archived') === '1' ? 1 : 0;
  const toolType = c.req.query('tool_type');

  let query = `SELECT id, tool_type, title, archived, created_at, updated_at
               FROM tool_saves WHERE user_id = ? AND archived = ?`;
  const params: any[] = [user.id, archived];

  if (toolType) {
    query += ' AND tool_type = ?';
    params.push(toolType);
  }
  query += ' ORDER BY updated_at DESC LIMIT 100';

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ saves: rows.results || [] });
});

app.get('/api/tools/saved/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  const row = await c.env.DB.prepare(
    'SELECT * FROM tool_saves WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!row) return c.json({ error: 'not_found' }, 404);

  return c.json({
    save: {
      ...row,
      input: row.input ? JSON.parse(row.input) : {},
      output: row.output ? JSON.parse(row.output) : {},
    },
  });
});

app.put('/api/tools/saved/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; archived?: boolean; input?: any; output?: any }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title.trim()); }
  if (body.archived !== undefined) { updates.push('archived = ?'); values.push(body.archived ? 1 : 0); }
  if (body.input !== undefined) { updates.push('input = ?'); values.push(JSON.stringify(body.input)); }
  if (body.output !== undefined) { updates.push('output = ?'); values.push(JSON.stringify(body.output)); }

  if (updates.length === 0) return c.json({ ok: true });

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  values.push(user.id);

  await c.env.DB.prepare(
    `UPDATE tool_saves SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  return c.json({ ok: true });
});

app.delete('/api/tools/saved/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM tool_saves WHERE id = ? AND user_id = ?')
    .bind(id, user.id).run();
  return c.json({ ok: true });
});

// =====================================================
// Multi-format Export (Markdown, JSON, CSV, HTML-as-DOCX)
// =====================================================

function buildProjectMarkdown(project: any, stepData: any): string {
  const safeStr = (v: any) => v ? String(v).trim() : '';
  const normalize = (d: any) => d?.output || d;
  const lines: string[] = [];

  lines.push(`# ${project.name} — Marketing System`);
  lines.push('');
  lines.push(`**อุตสาหกรรม:** ${project.industry || '—'}`);
  lines.push(`**สร้างเมื่อ:** ${new Date(project.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;
    lines.push(`## ${n}. ${name}`);
    lines.push('');

    if (n === 1) {
      lines.push(`### Positioning`);
      lines.push(safeStr(data.positioning) || '—');
      lines.push('');
      lines.push(`### UVP`);
      lines.push(safeStr(data.uvp) || '—');
      lines.push('');
      lines.push(`### Voice & Tone`);
      lines.push(safeStr(data.voice_tone) || '—');
      lines.push('');
      lines.push(`### Target Audience`);
      lines.push(safeStr(data.target_audience) || '—');
      lines.push('');
      if (data.anti_positioning) {
        lines.push(`### ไม่ใช่ลูกค้าเรา`);
        lines.push(safeStr(data.anti_positioning));
        lines.push('');
      }
    } else if (n === 2) {
      const personas = data.personas || [];
      personas.forEach((p: any, i: number) => {
        lines.push(`### Persona ${i + 1}: ${safeStr(p.name)}`);
        if (p.size_estimate) lines.push(`*≈ ${safeStr(p.size_estimate)}*`);
        lines.push('');
        if (p.demographics) {
          lines.push('**ข้อมูลส่วนตัว:**');
          Object.entries(p.demographics).forEach(([k, v]) => {
            if (v) lines.push(`- **${k}**: ${v}`);
          });
          lines.push('');
        }
        if (p.psychographics) {
          lines.push('**จิตวิทยา:**');
          Object.entries(p.psychographics).forEach(([k, v]) => {
            if (v) lines.push(`- **${k}**: ${v}`);
          });
          lines.push('');
        }
        if (p.pain_points?.length) {
          lines.push('**Pain Points:**');
          p.pain_points.forEach((x: string) => lines.push(`- ${x}`));
          lines.push('');
        }
        if (p.preferred_channels?.length) {
          lines.push(`**ช่องทาง:** ${p.preferred_channels.join(', ')}`);
          lines.push('');
        }
        if (p.best_offer) {
          lines.push(`**🎯 ข้อเสนอที่ตรงใจ:** ${p.best_offer}`);
          lines.push('');
        }
      });
    } else if (n === 3) {
      (data.journey || []).forEach((s: any, i: number) => {
        lines.push(`### Stage ${i + 1}: ${safeStr(s.stage_name_th || s.stage)}`);
        if (s.emotions) {
          lines.push(`- **อารมณ์:** ${safeStr(s.emotions.primary)} ${s.emotions.secondary ? '/ ' + safeStr(s.emotions.secondary) : ''}`);
          if (s.emotions.quote) lines.push(`> "${safeStr(s.emotions.quote)}"`);
        }
        if (s.touchpoints?.length) lines.push(`- **ช่องทาง:** ${s.touchpoints.join(', ')}`);
        if (s.key_message) lines.push(`- **ข้อความหลัก:** ${safeStr(s.key_message)}`);
        if (s.content_types?.length) lines.push(`- **Content:** ${s.content_types.join(', ')}`);
        lines.push('');
      });
    } else if (n === 4) {
      lines.push(`### Positioning Statement`);
      lines.push(safeStr(data.positioning_statement) || '—');
      lines.push('');
      if (data.positioning_one_liner) {
        lines.push(`### One-Liner`);
        lines.push(`> ${safeStr(data.positioning_one_liner)}`);
        lines.push('');
      }
      if (data.uvp_bullets?.length) {
        lines.push('### Value Bullets');
        data.uvp_bullets.forEach((b: string) => lines.push(`- ✓ ${b}`));
        lines.push('');
      }
      if (data.tagline_options?.length) {
        lines.push('### Tagline Options');
        data.tagline_options.forEach((t: string, i: number) => lines.push(`${i + 1}. "${t}"`));
        lines.push('');
      }
      if (data.competitive_frame) {
        lines.push('### vs คู่แข่ง');
        Object.entries(data.competitive_frame).forEach(([k, v], i) => {
          lines.push(`- **คู่แข่งที่ ${i + 1}:** ${v}`);
        });
        lines.push('');
      }
      if (data.elevator_pitch) {
        lines.push(`### ⏱️ 30-Second Pitch`);
        lines.push(safeStr(data.elevator_pitch));
        lines.push('');
      }
    } else if (n === 5) {
      const cal = data.calendar || [];
      lines.push(`**${cal.length} โพสต์** — ${cal.filter((p: any) => p.pillar === 'awareness').length} awareness, ${cal.filter((p: any) => p.pillar === 'education').length} education, ${cal.filter((p: any) => p.pillar === 'social_proof').length} social proof, ${cal.filter((p: any) => p.pillar === 'conversion').length} conversion`);
      lines.push('');
      cal.forEach((p: any) => {
        lines.push(`#### Day ${p.day} — ${p.pillar} (${p.platform}, ${p.format})`);
        lines.push(`**Hook:** ${safeStr(p.hook)}`);
        lines.push('');
        lines.push(safeStr(p.caption));
        lines.push('');
        lines.push(`→ **CTA:** ${safeStr(p.cta)}`);
        if (p.hashtags?.length) lines.push(`\n${p.hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}`);
        if (p.visual_suggestion) lines.push(`\n🎨 ${safeStr(p.visual_suggestion)}`);
        lines.push('');
      });
    } else if (n === 6) {
      (data.workflows || []).forEach((wf: any) => {
        lines.push(`### ${safeStr(wf.name)} (-${wf.time_saved_pct}% เวลา)`);
        lines.push(`**${safeStr(wf.time_before)} → ${safeStr(wf.time_after)}**`);
        lines.push('');
        if (wf.steps?.length) {
          wf.steps.forEach((s: any) => {
            lines.push(`${s.step}. ${safeStr(s.action)} _(⏱ ${s.duration}, 📦 ${s.output})_`);
          });
          lines.push('');
        }
        if (wf.tools_used?.length) lines.push(`**เครื่องมือ:** ${wf.tools_used.join(', ')} (~${wf.tools_cost_monthly} บาท/เดือน)`);
        if (wf.kpi) lines.push(`**KPI:** ${safeStr(wf.kpi)} · **ความถี่:** ${safeStr(wf.frequency)}`);
        lines.push('');
      });
      if (data.voice_guide) {
        lines.push('### 🎙️ Voice Guide');
        lines.push(safeStr(data.voice_guide.tone));
        lines.push('');
        if (data.voice_guide.do?.length) {
          lines.push('**ควรทำ:**');
          data.voice_guide.do.forEach((d: string) => lines.push(`- ✅ ${d}`));
          lines.push('');
        }
        if (data.voice_guide.dont?.length) {
          lines.push('**ไม่ควรทำ:**');
          data.voice_guide.dont.forEach((d: string) => lines.push(`- ❌ ${d}`));
          lines.push('');
        }
      }
    } else if (n === 7) {
      (data.kpis || []).forEach((k: any) => {
        lines.push(`### ${safeStr(k.name)} (${k.id})`);
        lines.push(`**ปัจจุบัน:** ${k.current} → **30 วัน:** ${k.target_30d} → **90 วัน:** ${k.target_90d} ${safeStr(k.unit)}`);
        lines.push('');
        if (k.tool) lines.push(`- **เครื่องมือ:** ${safeStr(k.tool)}`);
        if (k.frequency) lines.push(`- **ความถี่:** ${safeStr(k.frequency)}`);
        if (k.owner) lines.push(`- **คนดูแล:** ${safeStr(k.owner)}`);
        if (k.action_if_below) lines.push(`- **ถ้าต่ำกว่าเป้า:** ${safeStr(k.action_if_below)}`);
        lines.push('');
      });
      if (data.action_plan_30d) {
        lines.push('### 📅 Action Plan 30 วัน');
        Object.entries(data.action_plan_30d).forEach(([week, plan]: [string, any]) => {
          lines.push(`**${week}** — ${safeStr(plan.theme)}`);
          (plan.tasks || []).forEach((t: string) => lines.push(`- ${t}`));
          if (plan.outcome) lines.push(`🎯 ${safeStr(plan.outcome)}`);
          lines.push('');
        });
      }
    }
    lines.push('---');
    lines.push('');
  }

  lines.push('*สร้างโดย BusinessAiOs · Operating System for AI Business*');
  return lines.join('\n');
}

function buildProjectCSV(project: any, stepData: any): string {
  const normalize = (d: any) => d?.output || d;
  const rows: string[] = [['Step', 'Field', 'Value']];

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;

    if (n === 1) {
      rows.push([String(n), 'positioning', data.positioning || '']);
      rows.push([String(n), 'uvp', data.uvp || '']);
      rows.push([String(n), 'voice_tone', data.voice_tone || '']);
      rows.push([String(n), 'target_audience', data.target_audience || '']);
    } else if (n === 2) {
      (data.personas || []).forEach((p: any, i: number) => {
        rows.push([String(n), `persona_${i+1}_name`, p.name || '']);
        rows.push([String(n), `persona_${i+1}_demographics`, JSON.stringify(p.demographics || {})]);
        rows.push([String(n), `persona_${i+1}_pain_points`, (p.pain_points || []).join('; ')]);
      });
    } else if (n === 4) {
      rows.push([String(n), 'positioning_statement', data.positioning_statement || '']);
      rows.push([String(n), 'positioning_one_liner', data.positioning_one_liner || '']);
      (data.uvp_bullets || []).forEach((b: string, i: number) => rows.push([String(n), `uvp_bullet_${i+1}`, b]));
    } else if (n === 5) {
      (data.calendar || []).forEach((p: any) => {
        rows.push([String(n), `day_${p.day}`, `${p.platform}/${p.format}: ${p.hook}`]);
      });
    } else if (n === 7) {
      (data.kpis || []).forEach((k: any) => {
        rows.push([String(n), `kpi_${k.id}`, `${k.name}: ${k.current}→${k.target_30d}→${k.target_90d}`]);
      });
    }
  }

  return rows.map(r => r.map(cell => {
    const v = String(cell || '').replace(/"/g, '""');
    return `"${v}"`;
  }).join(',')).join('\n');
}

function escapeHtmlForDoc(s: any): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Generate an HTML file that Word can open natively as a .doc
 * Word's HTML import is more limited than browser HTML, but for clean structured content it works.
 * The .doc extension is the key — Word treats it as a Word document.
 */
function buildProjectDocx(project: any, stepData: any): string {
  // Use the same structure as the printable HTML but with Word-friendly CSS
  const safeStr = (v: any) => v ? String(v).trim() : '—';
  const normalize = (d: any) => d?.output || d;
  const sections: string[] = [];

  sections.push(`<h1 style="text-align: center; color: #1d4ed8;">${escapeHtmlForDoc(project.name)}</h1>`);
  sections.push(`<p style="text-align: center; color: #64748b;">Marketing System · ${escapeHtmlForDoc(project.industry || 'Business')}</p>`);
  sections.push(`<hr/>`);

  for (const n of STEPS) {
    const data = normalize(stepData[`step${n}`]);
    if (!data) continue;
    const name = PROMPT_TEMPLATES[n]?.name || `Step ${n}`;

    sections.push(`<h1>${n}. ${escapeHtmlForDoc(name)}</h1>`);

    if (n === 1) {
      sections.push(`<h2>Positioning</h2><p>${escapeHtmlForDoc(data.positioning)}</p>`);
      sections.push(`<h2>UVP</h2><p>${escapeHtmlForDoc(data.uvp)}</p>`);
      sections.push(`<h2>Voice & Tone</h2><p>${escapeHtmlForDoc(data.voice_tone)}</p>`);
      sections.push(`<h2>Target Audience</h2><p>${escapeHtmlForDoc(data.target_audience)}</p>`);
      if (data.anti_positioning) {
        sections.push(`<h2>ไม่ใช่ลูกค้าเรา</h2><p>${escapeHtmlForDoc(data.anti_positioning)}</p>`);
      }
    } else if (n === 2) {
      (data.personas || []).forEach((p: any, i: number) => {
        sections.push(`<h2>Persona ${i+1}: ${escapeHtmlForDoc(p.name)}</h2>`);
        if (p.demographics) {
          sections.push('<h3>ข้อมูลส่วนตัว</h3>');
          sections.push('<ul>');
          Object.entries(p.demographics).forEach(([k, v]) => {
            if (v) sections.push(`<li><b>${k}:</b> ${escapeHtmlForDoc(v)}</li>`);
          });
          sections.push('</ul>');
        }
        if (p.pain_points?.length) {
          sections.push('<h3>Pain Points</h3><ul>');
          p.pain_points.forEach((x: string) => sections.push(`<li>${escapeHtmlForDoc(x)}</li>`));
          sections.push('</ul>');
        }
        if (p.best_offer) {
          sections.push(`<p><b>🎯 ข้อเสนอที่ตรงใจ:</b> ${escapeHtmlForDoc(p.best_offer)}</p>`);
        }
      });
    } else if (n === 4) {
      sections.push(`<h2>Positioning Statement</h2><p>${escapeHtmlForDoc(data.positioning_statement)}</p>`);
      if (data.positioning_one_liner) {
        sections.push(`<h2>One-Liner</h2><p><i>${escapeHtmlForDoc(data.positioning_one_liner)}</i></p>`);
      }
      if (data.uvp_bullets?.length) {
        sections.push('<h2>Value Bullets</h2><ul>');
        data.uvp_bullets.forEach((b: string) => sections.push(`<li>✓ ${escapeHtmlForDoc(b)}</li>`));
        sections.push('</ul>');
      }
      if (data.tagline_options?.length) {
        sections.push('<h2>Tagline Options</h2><ol>');
        data.tagline_options.forEach((t: string) => sections.push(`<li><i>"${escapeHtmlForDoc(t)}"</i></li>`));
        sections.push('</ol>');
      }
    } else if (n === 5) {
      (data.calendar || []).forEach((p: any) => {
        sections.push(`<h3>Day ${p.day} — ${p.pillar} (${p.platform})</h3>`);
        sections.push(`<p><b>Hook:</b> ${escapeHtmlForDoc(p.hook)}</p>`);
        sections.push(`<p>${escapeHtmlForDoc(p.caption)}</p>`);
        sections.push(`<p><b>CTA:</b> ${escapeHtmlForDoc(p.cta)}</p>`);
      });
    } else if (n === 7) {
      sections.push('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">');
      sections.push('<tr><th>KPI</th><th>ปัจจุบัน</th><th>30 วัน</th><th>90 วัน</th><th>หน่วย</th></tr>');
      (data.kpis || []).forEach((k: any) => {
        sections.push(`<tr><td>${escapeHtmlForDoc(k.name)}</td><td>${k.current}</td><td>${k.target_30d}</td><td>${k.target_90d}</td><td>${escapeHtmlForDoc(k.unit)}</td></tr>`);
      });
      sections.push('</table>');
    }
  }

  sections.push(`<hr/><p style="text-align: center; color: #94a3b8; font-size: 12px;">BusinessAiOs · Operating System for AI Business</p>`);

  return sections.join('\n');
}

/**
 * Update the export endpoint to support multiple formats.
 */
app.post('/api/projects/:id/export', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const env = c.env;
  const body = await c.req.json<{ format?: 'html' | 'pdf' | 'md' | 'markdown' | 'json' | 'csv' | 'doc' | 'docx' }>().catch(() => ({}));

  const project = await env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first<any>();

  if (!project) return c.json({ error: 'not_found' }, 404);

  let stepData: any = {};
  try { stepData = JSON.parse(project.step_data || '{}'); } catch {}

  const requestedFormat = (body.format || 'html').toLowerCase();
  let exportId = generateId();
  let content: string;
  let mimeType: string;
  let fileExt: string;
  let formatName: string;

  if (requestedFormat === 'md' || requestedFormat === 'markdown') {
    content = buildProjectMarkdown(project, stepData);
    mimeType = 'text/markdown; charset=utf-8';
    fileExt = 'md';
    formatName = 'markdown';
  } else if (requestedFormat === 'json') {
    const normalize = (d: any) => d?.output || d;
    const cleanStepData: any = {};
    STEPS.forEach(n => { cleanStepData[`step${n}`] = normalize(stepData[`step${n}`]); });
    content = JSON.stringify({ project: { name: project.name, industry: project.industry, created_at: project.created_at }, step_data: cleanStepData }, null, 2);
    mimeType = 'application/json; charset=utf-8';
    fileExt = 'json';
    formatName = 'json';
  } else if (requestedFormat === 'csv') {
    content = buildProjectCSV(project, stepData);
    mimeType = 'text/csv; charset=utf-8';
    fileExt = 'csv';
    formatName = 'csv';
  } else if (requestedFormat === 'doc' || requestedFormat === 'docx') {
    // HTML-in-DOCX: Word opens .doc (HTML) natively
    const body2 = buildProjectDocx(project, stepData);
    content = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlForDoc(project.name)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 14pt; line-height: 1.6; }
  h1 { font-size: 24pt; color: #1d4ed8; }
  h2 { font-size: 18pt; color: #1e40af; }
  h3 { font-size: 14pt; color: #475569; }
  p, li { font-size: 14pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 6pt; }
  th { background: #eff6ff; }
</style>
</head>
<body>${body2}</body></html>`;
    mimeType = 'application/msword; charset=utf-8';
    fileExt = 'doc';
    formatName = 'docx';
  } else {
    // HTML (default — for browser print to PDF)
    content = buildProjectHTML(project, stepData);
    mimeType = 'text/html; charset=utf-8';
    fileExt = 'html';
    formatName = 'html';
  }

  const r2Key = `exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
  await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });

  await env.DB.prepare(`
    INSERT INTO exports (id, project_id, user_id, format, r2_key, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(exportId, projectId, user.id, formatName, r2Key, content.length, Date.now()).run();

  return c.json({
    ok: true,
    export_id: exportId,
    format: formatName,
    url: `/api/exports/${exportId}`,
    download_url: `/api/exports/${exportId}`,
    note: formatName === 'html' ? 'เปิด URL → กด "Save as PDF" (Cmd/Ctrl+P)' : 'กดดาวน์โหลดจาก URL',
  });
});

// =====================================================
// Tool Save Export (multi-format)
// =====================================================

app.post('/api/tools/saved/:id/export', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const env = c.env;
  const body = await c.req.json<{ format?: 'md' | 'json' | 'pdf' }>().catch(() => ({}));

  const row = await env.DB.prepare(
    'SELECT * FROM tool_saves WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!row) return c.json({ error: 'not_found' }, 404);

  const input = row.input ? JSON.parse(row.input) : {};
  const output = row.output ? JSON.parse(row.output) : {};
  const format = (body.format || 'md').toLowerCase();

  let content: string;
  let mimeType: string;
  let fileExt: string;
  let title = row.title || row.tool_type;

  if (format === 'json') {
    content = JSON.stringify({ title, tool_type: row.tool_type, input, output }, null, 2);
    mimeType = 'application/json; charset=utf-8';
    fileExt = 'json';
  } else if (format === 'pdf') {
    // Canvas PDF — one-page A3 landscape for VPC + BMC + Offer + Objection + Hook
    const canvasHtml = renderCanvasPDF(row.tool_type, title, input, output);
    if (!canvasHtml) {
      return c.json({ error: 'canvas_not_supported', message: 'Canvas PDF ยังไม่รองรับ tool นี้ (รองรับ VPC, BMC, Offer, Objection, Hook)' }, 400);
    }
    content = canvasHtml;
    mimeType = 'text/html; charset=utf-8';
    fileExt = 'html'; // Store as HTML, but format field = pdf for client
  } else {
    // Markdown
    const lines: string[] = [`# ${title}`, '', `**ประเภท:** ${row.tool_type}`, `**สร้างเมื่อ:** ${new Date(row.created_at).toLocaleDateString('th-TH')}`, '', '---', ''];
    lines.push('## Input');
    lines.push('```json');
    lines.push(JSON.stringify(input, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('## Output');
    lines.push('```json');
    lines.push(JSON.stringify(output, null, 2));
    lines.push('```');
    lines.push('');
    content = lines.join('\n');
    mimeType = 'text/markdown; charset=utf-8';
    fileExt = 'md';
  }

  const exportId = generateId();
  const r2Key = `tool-exports/${user.id}/${id}/${exportId}.${fileExt}`;
  await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });

  // Insert into tool_save_exports so GET /api/tool-exports/:id can find it
  // For pdf format, store as 'pdf' in DB so client knows it's a canvas (we store HTML in R2 with .html ext)
  const dbFormat = format; // 'md' | 'json' | 'pdf'
  await env.DB.prepare(`
    INSERT INTO tool_save_exports (id, tool_save_id, user_id, format, r2_key, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(exportId, id, user.id, dbFormat, r2Key, content.length, Date.now()).run();

  return c.json({ ok: true, export_id: exportId, format: dbFormat, url: `/api/tool-exports/${exportId}`, download_url: `/api/tool-exports/${exportId}` });
});

// =====================================================
// Tool Save Export Download (separate from project exports)
// Returns file with Content-Disposition: attachment
// =====================================================
app.get('/api/tool-exports/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const env = c.env;
  const id = c.req.param('id');

  const exp = await env.DB.prepare(
    'SELECT * FROM tool_save_exports WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!exp) return c.json({ error: 'not_found' }, 404);

  const obj = await env.R2.get(exp.r2_key);
  if (!obj) return c.json({ error: 'not_found_in_storage' }, 404);

  const fileSize = (await obj.body?.getSize?.()) ?? 0;

  // For PDF (canvas) format, serve HTML inline so browser can render + print
  if (exp.format === 'pdf') {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header('Content-Disposition', 'inline');
    c.header('Content-Length', String(fileSize));
    c.header('Cache-Control', 'no-cache');
    return c.body(await obj.text());
  }

  // For other formats, force download
  const filename = `${exp.format === 'md' ? 'document' : 'data'}-${id}.${exp.format}`;
  c.header('Content-Type', exp.format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  c.header('Content-Length', String(fileSize));
  c.header('Cache-Control', 'no-cache');

  return c.body(await obj.text());
});

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

// =====================================================
// Step Assets (notes + files + links) — per-step context
// =====================================================

app.get('/api/projects/:id/steps/:step/assets', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const stepNum = parseInt(c.req.param('step'), 10);

  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!project) return c.json({ error: 'not_found' }, 404);

  const rows = await c.env.DB.prepare(`
    SELECT id, kind, title, content, file_name, file_size, mime_type, source, source_id, source_meta, created_at, updated_at
    FROM step_assets
    WHERE project_id = ? AND step_number = ?
    ORDER BY created_at ASC
  `).bind(projectId, stepNum).all();
  return c.json({ assets: rows.results || [] });
});

app.post('/api/projects/:id/steps/:step/assets', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const stepNum = parseInt(c.req.param('step'), 10);
  const body = await c.req.json<{
    kind?: 'note' | 'file' | 'link';
    title?: string;
    content?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    source?: string;
    source_id?: string;
    source_meta?: any;
  }>();

  if (!body.kind) return c.json({ error: 'missing_kind' }, 400);

  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!project) return c.json({ error: 'not_found' }, 404);

  const id = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO step_assets (id, project_id, step_number, kind, title, content, file_name, file_size, mime_type, source, source_id, source_meta, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, projectId, stepNum, body.kind,
    body.title || null,
    body.content || null,
    body.file_name || null,
    body.file_size || null,
    body.mime_type || null,
    body.source || 'user_upload',
    body.source_id || null,
    body.source_meta ? JSON.stringify(body.source_meta) : null,
    now, now
  ).run();

  return c.json({ ok: true, id });
});

app.put('/api/projects/:id/steps/:step/assets/:assetId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const assetId = c.req.param('assetId');
  const body = await c.req.json<{ title?: string; content?: string }>();

  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!project) return c.json({ error: 'not_found' }, 404);

  const updates: string[] = [];
  const values: any[] = [];
  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
  if (body.content !== undefined) { updates.push('content = ?'); values.push(body.content); }
  if (updates.length === 0) return c.json({ ok: true });

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(assetId);
  values.push(projectId);

  await c.env.DB.prepare(
    `UPDATE step_assets SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`
  ).bind(...values).run();

  return c.json({ ok: true });
});

app.delete('/api/projects/:id/steps/:step/assets/:assetId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const assetId = c.req.param('assetId');

  // Verify ownership
  const own = await c.env.DB.prepare(`
    SELECT sa.id FROM step_assets sa
    JOIN projects p ON p.id = sa.project_id
    WHERE sa.id = ? AND sa.project_id = ? AND p.user_id = ?
  `).bind(assetId, projectId, user.id).first();
  if (!own) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM step_assets WHERE id = ?').bind(assetId).run();
  return c.json({ ok: true });
});

/**
 * Upload a text/csv/json context file (stored as content; for binary files use R2)
 * Max 200KB text content
 */
app.post('/api/projects/:id/steps/:step/upload-text', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const stepNum = parseInt(c.req.param('step'), 10);
  const body = await c.req.json<{
    title?: string;
    file_name?: string;
    content?: string;
    mime_type?: string;
  }>();

  if (!body.content || body.content.length > 200_000) {
    return c.json({ error: 'too_large', message: 'ไฟล์ต้องไม่เกิน 200KB' }, 400);
  }

  const own = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!own) return c.json({ error: 'not_found' }, 404);

  const id = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO step_assets (id, project_id, step_number, kind, title, content, file_name, file_size, mime_type, source, created_at, updated_at)
    VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?, 'user_upload', ?, ?)
  `).bind(
    id, projectId, stepNum,
    body.title || body.file_name || 'Uploaded file',
    body.content,
    body.file_name || 'file.txt',
    body.content.length,
    body.mime_type || 'text/plain',
    now, now
  ).run();

  return c.json({ ok: true, id, size: body.content.length });
});

// =====================================================
// Project Links (cross-reference between projects/tools)
// =====================================================

app.get('/api/projects/:id/links', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');

  const own = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!own) return c.json({ error: 'not_found' }, 404);

  const links = await c.env.DB.prepare(`
    SELECT id, target_kind, target_id, link_purpose, step_number, created_at
    FROM project_links
    WHERE project_id = ?
    ORDER BY created_at ASC
  `).bind(projectId).all();

  // Hydrate target details
  const hydrated: any[] = [];
  for (const l of (links.results || []) as any[]) {
    let target: any = null;
    if (l.target_kind === 'project') {
      target = await c.env.DB.prepare(
        'SELECT id, name, kind, industry, updated_at FROM projects WHERE id = ?'
      ).bind(l.target_id).first();
    } else if (l.target_kind === 'tool_save') {
      target = await c.env.DB.prepare(
        'SELECT id, tool_type, title, updated_at FROM tool_saves WHERE id = ? AND user_id = ?'
      ).bind(l.target_id, user.id).first();
    }
    if (target) hydrated.push({ ...l, target });
  }

  return c.json({ links: hydrated });
});

app.post('/api/projects/:id/links', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const body = await c.req.json<{
    target_kind: 'project' | 'tool_save';
    target_id: string;
    link_purpose?: string;
    step_number?: number;
  }>();

  if (!body.target_kind || !body.target_id) {
    return c.json({ error: 'missing_fields' }, 400);
  }

  const own = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!own) return c.json({ error: 'not_found' }, 404);

  // Verify target ownership
  if (body.target_kind === 'project') {
    const t = await c.env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?'
    ).bind(body.target_id, user.id).first();
    if (!t) return c.json({ error: 'target_not_found' }, 404);
  } else {
    const t = await c.env.DB.prepare(
      'SELECT id FROM tool_saves WHERE id = ? AND user_id = ?'
    ).bind(body.target_id, user.id).first();
    if (!t) return c.json({ error: 'target_not_found' }, 404);
  }

  // Also create a step_asset for ease of prompt injection
  const stepNum = body.step_number || 2;
  const assetId = generateId();
  const now = Date.now();

  // Check duplicate
  const existing = await c.env.DB.prepare(`
    SELECT id FROM project_links
    WHERE project_id = ? AND target_kind = ? AND target_id = ? AND step_number = ?
  `).bind(projectId, body.target_kind, body.target_id, stepNum).first();

  if (existing) {
    return c.json({ ok: true, link_id: (existing as any).id, already_exists: true });
  }

  const linkId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO project_links (id, project_id, target_kind, target_id, link_purpose, step_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(linkId, projectId, body.target_kind, body.target_id, body.link_purpose || 'context', stepNum, now).run();

  // Mirror to step_assets for prompt injection
  await c.env.DB.prepare(`
    INSERT INTO step_assets (id, project_id, step_number, kind, title, source, source_id, source_meta, created_at, updated_at)
    VALUES (?, ?, ?, 'link', ?, ?, ?, ?, ?, ?)
  `).bind(
    assetId, projectId, stepNum,
    body.target_kind === 'project' ? 'Linked Project' : 'Linked Tool Result',
    body.target_kind, body.target_id,
    JSON.stringify({ link_purpose: body.link_purpose || 'context' }),
    now, now
  ).run();

  return c.json({ ok: true, link_id: linkId, asset_id: assetId });
});

app.delete('/api/projects/:id/links/:linkId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const projectId = c.req.param('id');
  const linkId = c.req.param('linkId');

  const own = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).bind(projectId, user.id).first();
  if (!own) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare('DELETE FROM project_links WHERE id = ? AND project_id = ?')
    .bind(linkId, projectId).run();

  // Also remove the mirrored step_asset
  await c.env.DB.prepare(`
    DELETE FROM step_assets
    WHERE project_id = ? AND source_id = (
      SELECT target_id FROM project_links WHERE id = ?
    ) AND kind = 'link'
  `).bind(projectId, linkId).run();

  return c.json({ ok: true });
});

// =====================================================
// Promote tool result → separate project
// =====================================================

app.post('/api/tools/saved/:id/promote', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ target_kind?: 'playbook' | 'native' }>().catch(() => ({}));
  const targetKind = body.target_kind || 'playbook'; // default: import into playbook

  const tool = await c.env.DB.prepare(
    'SELECT * FROM tool_saves WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();
  if (!tool) return c.json({ error: 'not_found' }, 404);

  const input = tool.input ? JSON.parse(tool.input) : {};
  const output = tool.output ? JSON.parse(tool.output) : {};

  const projectId = generateId();
  const now = Date.now();

  let kind: string;
  let stepData: any = {};
  let currentStep = 1;

  if (targetKind === 'playbook') {
    // Map tool output to playbook step1-7 (import important content)
    kind = 'playbook';
    stepData = mapToolToPlaybook(tool.tool_type, input, output);
    // Mark steps 1-3 as auto-filled (so user can review/edit)
    const hasStep1 = stepData.step1 && Object.keys(stepData.step1).length > 0;
    const hasStep2 = stepData.step2 && (Array.isArray(stepData.step2.personas) ? stepData.step2.personas.length > 0 : Object.keys(stepData.step2).length > 0);
    const hasStep3 = stepData.step3 && ((stepData.step3.pain_points?.length || 0) > 0 || (stepData.step3.journey?.length || 0) > 0);
    const hasStep4 = stepData.step4 && Object.keys(stepData.step4).length > 0;
    currentStep = hasStep4 ? 5 : (hasStep3 ? 4 : (hasStep2 ? 3 : (hasStep1 ? 2 : 1)));
  } else {
    // Native (standalone) — just put output in step_data
    kind = ({ pain_generator: 'pain_points', brand_voice: 'brand_voice', persona_builder: 'persona', competitor_analysis: 'competitor_analysis', jtbd_generator: 'jtbd_generator', value_proposition_canvas: 'value_proposition_canvas', business_model_canvas: 'business_model_canvas', million_dollar_offer: 'million_dollar_offer', objection_handler: 'objection_handler', hook_library: 'hook_library' } as any)[tool.tool_type] || 'playbook';
    if (kind === 'brand_voice') stepData = { brand_voice: output };
    else if (kind === 'pain_points') stepData = { pain_points: output };
    else if (kind === 'persona') stepData = { persona: output };
    else if (kind === 'competitor_analysis') stepData = { competitor_analysis: output };
    else if (kind === 'jtbd_generator') stepData = { jtbd_generator: output };
    else if (kind === 'value_proposition_canvas') stepData = { value_proposition_canvas: output };
    else if (kind === 'business_model_canvas') stepData = { business_model_canvas: output };
    else if (kind === 'million_dollar_offer') stepData = { million_dollar_offer: output };
    else if (kind === 'objection_handler') stepData = { objection_handler: output };
    else if (kind === 'hook_library') stepData = { hook_library: output };
  }

  await c.env.DB.prepare(`
    INSERT INTO projects (id, user_id, name, industry, current_step, status, locale, step_data, kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', 'th', ?, ?, ?, ?)
  `).bind(
    projectId, user.id, tool.title || `${kind} project`,
    input.industry || null,
    currentStep,
    JSON.stringify(stepData),
    kind,
    now, now
  ).run();

  return c.json({ ok: true, project_id: projectId, kind, target_kind: targetKind, steps_imported: Object.keys(stepData) });
});

/**
 * Map tool output → playbook step1-7 (import important content)
 */
function mapToolToPlaybook(toolType: string, input: any, output: any): any {
  const stepData: any = {};

  if (toolType === 'pain_generator') {
    // Pain Point → Step 1 (Business DNA), Step 2 (Persona), Step 3 (Journey)
    const topOpportunity = output.pain_points?.find((p: any) => p.your_opportunity);
    const painList = output.pain_points || [];
    const note = `[Imported from Pain Point analysis]\n${output.summary || ''}`;

    // Step 1: pre-fill INPUT form (so user sees populated form)
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: '',
        customer_age: '',
        customer_job: '',
        customer_income: '',
        pain_point_1: painList[0]?.title || '',
        pain_point_2: painList[1]?.title || '',
        pain_point_3: painList[2]?.title || '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: topOpportunity?.your_opportunity || '',
        price_range: '',
        goal: output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: topOpportunity?.your_opportunity || output.summary || '',
        uvp: topOpportunity?.your_opportunity || '',
        target_audience: output.persona_insight || '',
        voice_tone: output.summary || '',
        anti_positioning: 'ลูกค้าที่ไม่มี pain point นี้',
        reasoning: note.slice(0, 200),
      },
      _imported_from: 'pain_point',
    };

    // Step 2: pre-fill personas
    stepData.step2 = {
      input: {
        user_notes: note,
      },
      output: {
        personas: [
          {
            name: 'Persona (จาก Pain Insight)',
            tag: 'Derived from pain analysis',
            demographics: { age: '-', job: '-', income: '-', location: input.industry ? 'ตลาด ' + input.industry : '-' },
            psychographics: { values: '-', interests: '-', fears: '-', aspirations: '-' },
            pain_points: painList.slice(0, 5).map((p: any) => p.title),
            preferred_channels: [],
            key_quotes: [],
            best_message: topOpportunity?.your_opportunity || '',
            best_offer: '',
          },
        ],
      },
      _imported_from: 'pain_point',
    };

    // Step 3: pre-fill journey + pain points
    stepData.step3 = {
      input: {
        user_notes: note,
      },
      output: {
        journey: painList.map((p: any) => ({
          stage: p.rank ? `Pain #${p.rank}` : 'pain',
          pain: p.title,
          solution: p.your_opportunity || '',
        })),
        pain_points: painList.map((p: any) => ({
          stage: 'purchase',
          pain: p.title,
          severity: p.severity,
          frequency: p.frequency,
          solution: p.your_opportunity || '',
        })),
        emotion_curve: { description: output.summary || '' },
      },
      _imported_from: 'pain_point',
    };
  } else if (toolType === 'brand_voice') {
    // Brand Voice → Step 1 (Business DNA) — pre-fill input
    const dim = output.voice_dimensions || {};
    const vocab = output.vocabulary || {};
    const note = `[Imported from Brand Voice]\n${output.voice_summary || ''}`;
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: '',
        customer_age: '',
        customer_job: '',
        customer_income: '',
        pain_point_1: '',
        pain_point_2: '',
        pain_point_3: '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: '',
        price_range: '',
        goal: '',
        user_notes: note,
      },
      output: {
        positioning: output.voice_summary || '',
        uvp: output.voice_summary || '',
        target_audience: 'กลุ่มเป้าหมายของแบรนด์',
        voice_tone: [output.personality_archetype, output.tone, ...(output.tone_keywords || [])].filter(Boolean).join(' / '),
        anti_positioning: '',
        reasoning: note.slice(0, 200),
        voice_dimensions: dim,
        brand_vocabulary: vocab,
        sample_phrases: output.sample_phrases || {},
        content_examples: output.content_examples || {},
      },
      _imported_from: 'brand_voice',
    };
  } else if (toolType === 'persona_builder') {
    // Persona → Step 2 (Customer Persona) — pre-fill personas
    const note = `[Imported from Persona Builder]\n${output.personas?.length || 0} personas`;
    stepData.step2 = {
      input: { user_notes: note },
      output: {
        personas: (output.personas || []).map((p: any) => ({
          name: p.name,
          tag: p.tag,
          demographics: p.demographics,
          psychographics: p.psychographics,
          pain_points: p.pain_points || [],
          needs: p.needs || [],
          preferred_channels: p.preferred_channels || [],
          key_quotes: [],
          best_message: p.best_message || '',
          best_offer: p.best_offer || '',
          size_estimate: p.size_estimate || '',
        })),
      },
      _imported_from: 'persona',
    };
  } else if (toolType === 'competitor_analysis') {
    // Competitor Analysis → Step 1 (Business DNA with competitors + white space)
    // and Step 4 (Positioning with competitive frame)
    const competitors = output.competitors || [];
    const gaps = output.market_gaps || [];
    const ws = output.white_space || {};
    const strat = output.recommended_strategy || {};
    const note = `[Imported from Competitor Analysis]\n${output.summary || ''}`;

    // Step 1: pre-fill INPUT form (form already has competitor_1/2/3)
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: input.location || '',
        customer_age: '',
        customer_job: '',
        customer_income: '',
        pain_point_1: '',
        pain_point_2: '',
        pain_point_3: '',
        competitor_1: competitors[0]?.name || '',
        competitor_2: competitors[1]?.name || '',
        competitor_3: competitors[2]?.name || '',
        differentiation: ws.uvp || output.differentiation || '',
        price_range: competitors[0]?.price_range || '',
        goal: strat.now || output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: ws.positioning || output.summary || '',
        uvp: ws.uvp || '',
        target_audience: 'กลุ่มเป้าหมายของแบรนด์',
        voice_tone: '',
        anti_positioning: ws.anti_positioning || 'ลูกค้าที่อยู่ในตลาดที่คู่แข่งครองอยู่แล้ว',
        reasoning: note.slice(0, 200),
        competitors: competitors,
        market_gaps: gaps,
        white_space: ws,
        recommended_strategy: strat,
      },
      _imported_from: 'competitor_analysis',
    };

    // Step 4: positioning (richer data with competitive frame)
    stepData.step4 = {
      input: {
        user_notes: note,
        competitor_1: competitors[0]?.name || '',
        competitor_2: competitors[1]?.name || '',
        competitor_3: competitors[2]?.name || '',
        price_position: competitors[0]?.price_range || '',
        goal: strat.now || output.summary || '',
      },
      output: {
        positioning_statement: ws.positioning || '',
        positioning_one_liner: ws.uvp || '',
        uvp_bullets: gaps.slice(0, 5).map((g: any) => g.your_advantage || g.gap).filter(Boolean),
        tagline_options: [ws.key_message, ws.positioning].filter(Boolean),
        competitive_frame: {
          vs_competitor_1: competitors[0] ? `เรา ${ws.uvp || 'different'} / เขา ${competitors[0].positioning || '-'}` : '',
          vs_competitor_2: competitors[1] ? `เรา ${ws.uvp || 'different'} / เขา ${competitors[1].positioning || '-'}` : '',
          vs_competitor_3: competitors[2] ? `เรา ${ws.uvp || 'different'} / เขา ${competitors[2].positioning || '-'}` : '',
        },
        proof_points: gaps.map((g: any) => g.evidence).filter(Boolean).slice(0, 3),
        elevator_pitch: [ws.positioning, ws.uvp].filter(Boolean).join(' — '),
      },
      _imported_from: 'competitor_analysis',
    };

    // Step 2: add a derived persona based on market gaps (so step 2 has content)
    if (gaps.length > 0) {
      stepData.step2 = {
        input: { user_notes: note },
        output: {
          personas: [
            {
              name: 'Persona (จาก Competitor Gap)',
              tag: 'Derived from market gap analysis',
              demographics: { age: '-', job: '-', income: '-', location: input.location || input.industry || '-', family: '-' },
              psychographics: { values: '-', interests: '-', fears: '-', aspirations: '-' },
              pain_points: gaps.map((g: any) => g.gap),
              preferred_channels: [],
              key_quotes: [],
              best_message: ws.key_message || ws.positioning || '',
              best_offer: '',
            },
          ],
        },
        _imported_from: 'competitor_analysis',
      };
    }
  } else if (toolType === 'jtbd_generator') {
    // JTBD → Step 1 (positioning around the job), Step 2 (persona with job), Step 4 (positioning with jobs/pains/gains)
    const pj = output.primary_job || {};
    const dims = pj.dimensions || {};
    const related = output.related_jobs || [];
    const forces = output.forces_of_progress || {};
    const outcomes = output.desired_outcomes || [];
    const timeline = output.customer_decision_timeline || [];
    const triggers = output.triggers || [];
    const insights = output.deep_research_insights || {};
    const note = `[Imported from JTBD Generator]\n${output.summary || ''}`;

    // Step 1: pre-fill INPUT + OUTPUT (positioning built around the job)
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: input.location || '',
        customer_age: input.customer_age || '',
        customer_job: input.customer_job || '',
        customer_income: input.customer_income || '',
        pain_point_1: dims.functional || '',
        pain_point_2: dims.emotional || '',
        pain_point_3: related[0]?.job || '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: output.answer_to_core_question || pj.job_statement || '',
        price_range: input.price_range || '',
        goal: pj.expected_outcome || output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: pj.job_statement || '',
        uvp: output.answer_to_core_question || '',
        target_audience: input.target_audience_resolved || input.target_audience || 'กลุ่มเป้าหมาย',
        voice_tone: '',
        anti_positioning: '',
        reasoning: note.slice(0, 200),
        primary_job: pj,
        related_jobs: related,
      },
      _imported_from: 'jtbd_generator',
    };

    // Step 2: persona derived from the job (functional + emotional + social)
    if (pj.job_statement) {
      stepData.step2 = {
        input: { user_notes: note },
        output: {
          personas: [
            {
              name: 'Persona (จาก JTBD)',
              tag: 'Derived from job analysis',
              demographics: { age: input.customer_age || '-', job: input.customer_job || '-', income: input.customer_income || '-', location: input.location || '-', family: '-' },
              psychographics: { values: dims.emotional || '-', interests: '-', fears: forces.anxiety?.[0]?.force || '-', aspirations: pj.expected_outcome || '-' },
              pain_points: [
                dims.functional || '',
                ...related.slice(0, 2).map((r: any) => r.job).filter(Boolean),
              ].filter(Boolean),
              needs: outcomes.slice(0, 3).map((o: any) => o.outcome).filter(Boolean),
              preferred_channels: [],
              key_quotes: [],
              best_message: pj.motivation || '',
              best_offer: '',
            },
          ],
        },
        _imported_from: 'jtbd_generator',
      };
    }

    // Step 4: positioning (with job + pains + gains + forces + outcomes)
    stepData.step4 = {
      input: {
        user_notes: note,
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        price_position: input.price_range || '',
        goal: pj.expected_outcome || output.summary || '',
      },
      output: {
        positioning_statement: pj.job_statement || '',
        positioning_one_liner: output.answer_to_core_question || '',
        uvp_bullets: outcomes
          .filter((o: any) => o.opportunity_score >= 7)
          .slice(0, 5)
          .map((o: any) => o.outcome),
        tagline_options: [pj.motivation, pj.expected_outcome].filter(Boolean),
        competitive_frame: {
          vs_status_quo: forces.verdict || '',
        },
        proof_points: outcomes.slice(0, 3).map((o: any) => o.why).filter(Boolean),
        elevator_pitch: pj.job_statement || '',
        jtbd: {
          primary_job: pj,
          forces: forces,
          outcomes: outcomes,
          timeline: timeline,
          triggers: triggers,
          insights: insights,
        },
      },
      _imported_from: 'jtbd_generator',
    };
  } else if (toolType === 'value_proposition_canvas') {
    // VPC → Step 1 (positioning + products/services), Step 2 (persona from profile), Step 4 (positioning with full VP), Step 5 (content from value map)
    const cp = output.customer_profile || {};
    const vm = output.value_map || {};
    const fa = output.fit_analysis || {};
    const note = `[Imported from Value Proposition Canvas]\nFit score: ${fa.overall_fit_score || '-'}/10 — ${fa.fit_verdict || ''}`;
    const topPains = (cp.pains || []).slice(0, 3);
    const topGains = (cp.gains || []).slice(0, 3);
    const topRelievers = (vm.pain_relievers || []).slice(0, 3);
    const topCreators = (vm.gain_creators || []).slice(0, 3);

    // Step 1: pre-fill + positioning (built around the value proposition)
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: input.location || '',
        customer_age: input.customer_age || '',
        customer_job: input.customer_job || '',
        customer_income: input.customer_income || '',
        pain_point_1: topPains[0]?.pain || '',
        pain_point_2: topPains[1]?.pain || '',
        pain_point_3: topPains[2]?.pain || '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: output.value_proposition_statement || input.differentiation || '',
        price_range: input.price_range || '',
        goal: topGains[0]?.gain || output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: output.value_proposition_statement || output.summary || '',
        uvp: output.value_proposition_statement || '',
        target_audience: output.customer_segment?.name || input.target_audience || 'กลุ่มเป้าหมาย',
        voice_tone: '',
        anti_positioning: '',
        reasoning: note.slice(0, 200),
        customer_profile: cp,
        value_map: vm,
        fit_analysis: fa,
        elevator_pitch: output.elevator_pitch || '',
      },
      _imported_from: 'value_proposition_canvas',
    };

    // Step 2: persona from customer profile (jobs + gains → needs)
    if (cp.jobs?.length) {
      stepData.step2 = {
        input: { user_notes: note },
        output: {
          personas: [
            {
              name: output.customer_segment?.name || 'Persona (จาก VPC)',
              tag: 'Derived from customer profile',
              demographics: { age: input.customer_age || '-', job: input.customer_job || '-', income: input.customer_income || '-', location: input.location || '-', family: '-' },
              psychographics: {
                values: topGains.find((g: any) => g.category === 'required' || g.category === 'expected')?.gain || '-',
                interests: '-',
                fears: topPains.find((p: any) => p.category === 'risk')?.pain || '-',
                aspirations: topGains.find((g: any) => g.category === 'desired' || g.category === 'unexpected')?.gain || '-',
              },
              pain_points: topPains.map((p: any) => p.pain).filter(Boolean),
              needs: topGains.map((g: any) => g.gain).filter(Boolean),
              preferred_channels: [],
              key_quotes: [],
              best_message: output.value_proposition_statement || '',
              best_offer: (vm.products_services?.[0]?.name) || '',
            },
          ],
        },
        _imported_from: 'value_proposition_canvas',
      };
    }

    // Step 4: positioning (full VPC with value proposition + fit analysis)
    stepData.step4 = {
      input: {
        user_notes: note,
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        price_position: input.price_range || '',
        goal: topGains[0]?.gain || output.summary || '',
      },
      output: {
        positioning_statement: output.value_proposition_statement || '',
        positioning_one_liner: output.elevator_pitch || '',
        uvp_bullets: [
          ...topRelievers.map((r: any) => r.reliever),
          ...topCreators.map((c: any) => c.creator),
        ].slice(0, 5),
        tagline_options: [
          output.value_proposition_statement,
          output.elevator_pitch,
        ].filter(Boolean),
        competitive_frame: {
          vs_status_quo: fa.fit_verdict || '',
          fit_score: fa.overall_fit_score || 0,
        },
        proof_points: [
          ...topRelievers.map((r: any) => `[${r.pattern}] ${r.reliever}`),
          ...topCreators.map((c: any) => `[${c.pattern}] ${c.creator}`),
        ].slice(0, 3),
        elevator_pitch: output.elevator_pitch || '',
        vpc: {
          customer_profile: cp,
          value_map: vm,
          fit_analysis: fa,
        },
      },
      _imported_from: 'value_proposition_canvas',
    };

    // Step 5: content calendar (seeded with value props + customer jobs to talk about)
    stepData.step5 = {
      input: {
        user_notes: note + '\n\nValue Map:\n' + (vm.products_services || []).map((p: any) => `- ${p.name}`).join('\n'),
      },
      output: {
        content_themes: [
          ...(topPains.map((p: any) => ({ theme: `Pain: ${p.pain}`, priority: p.intensity }))),
          ...(topGains.map((g: any) => ({ theme: `Gain: ${g.gain}`, priority: g.relevance }))),
          ...(topRelievers.map((r: any) => ({ theme: `Solution: ${r.reliever}`, priority: r.intensity }))),
        ],
      },
      _imported_from: 'value_proposition_canvas',
    };
  } else if (toolType === 'business_model_canvas') {
    // BMC → Step 1 (positioning), Step 2 (persona from primary segment), Step 4 (positioning with full BMC), Step 5 (content), Step 6 (channel plan from BMC channels), Step 7 (revenue + key metrics)
    const cs = output.customer_segments || [];
    const vps = output.value_propositions || [];
    const channels = output.channels || [];
    const relationships = output.customer_relationships || [];
    const revenues = output.revenue_streams || [];
    const resources = output.key_resources || [];
    const activities = output.key_activities || [];
    const partnerships = output.key_partnerships || [];
    const costs = output.cost_structure || {};
    const primarySeg = cs.find((s: any) => s.priority === 'primary') || cs[0] || {};
    const primaryVP = vps[0] || {};
    const note = `[Imported from Business Model Canvas]\nBusiness Model Pattern: ${output.business_model_pattern || '-'}\nMargin Profile: ${costs.estimated_margin_profile || '-'}`;

    // Step 1: positioning from BMC summary
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: input.location || '',
        pain_point_1: primarySeg.key_characteristic || primarySeg.description || '',
        pain_point_2: '',
        pain_point_3: '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: primaryVP.vp_statement || output.summary || '',
        price_range: input.price_range || '',
        goal: output.executive_insight || output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: output.summary || '',
        uvp: primaryVP.vp_statement || '',
        target_audience: primarySeg.name || input.target_audience || 'กลุ่มเป้าหมาย',
        voice_tone: '',
        anti_positioning: '',
        reasoning: note.slice(0, 200),
        business_model_pattern: output.business_model_pattern || '',
        customer_segments: cs,
        value_propositions: vps,
      },
      _imported_from: 'business_model_canvas',
    };

    // Step 2: persona from primary segment
    if (cs.length > 0) {
      stepData.step2 = {
        input: { user_notes: note },
        output: {
          personas: [
            {
              name: primarySeg.name || 'Persona (จาก BMC primary segment)',
              tag: 'Derived from primary customer segment',
              demographics: {
                age: '-', job: '-', income: '-',
                location: input.location || '-', family: '-',
              },
              psychographics: {
                values: primarySeg.key_characteristic || '-',
                interests: '-',
                fears: '-',
                aspirations: primarySeg.description || '-',
              },
              pain_points: [],
              needs: [primarySeg.description, primarySeg.key_characteristic].filter(Boolean),
              preferred_channels: channels.slice(0, 3).map((ch: any) => ch.channel_name),
              key_quotes: [],
              best_message: primaryVP.vp_statement || '',
              best_offer: primaryVP.vp_title || '',
            },
          ],
        },
        _imported_from: 'business_model_canvas',
      };
    }

    // Step 4: positioning with full BMC
    stepData.step4 = {
      input: {
        user_notes: note,
        competitor_1: partnerships[0]?.partner_type || '',
        competitor_2: partnerships[1]?.partner_type || '',
        competitor_3: partnerships[2]?.partner_type || '',
        price_position: input.price_range || '',
        goal: primaryVP.vp_statement || output.summary || '',
      },
      output: {
        positioning_statement: primaryVP.vp_statement || output.summary || '',
        positioning_one_liner: output.executive_insight || '',
        uvp_bullets: vps.slice(0, 5).map((v: any) => v.vp_title || v.vp_statement),
        tagline_options: [
          primaryVP.vp_statement,
          output.executive_insight,
          output.summary,
        ].filter(Boolean),
        competitive_frame: {
          vs_status_quo: output.business_model_pattern || '',
        },
        proof_points: revenues.slice(0, 3).map((r: any) => r.description).filter(Boolean),
        elevator_pitch: output.executive_insight || '',
        bmc: {
          customer_segments: cs,
          value_propositions: vps,
          channels: channels,
          customer_relationships: relationships,
          revenue_streams: revenues,
          key_resources: resources,
          key_activities: activities,
          key_partnerships: partnerships,
          cost_structure: costs,
          business_model_pattern: output.business_model_pattern || '',
          swot: output.swot_summary || {},
        },
      },
      _imported_from: 'business_model_canvas',
    };

    // Step 5: content calendar seeded with value props + customer themes
    stepData.step5 = {
      input: {
        user_notes: note + '\n\nValue Propositions:\n' + vps.slice(0, 3).map((v: any) => `- ${v.vp_title}`).join('\n'),
      },
      output: {
        content_themes: [
          ...vps.slice(0, 3).map((v: any) => ({ theme: `VP: ${v.vp_title}`, priority: 'high' })),
          ...cs.slice(0, 2).map((s: any) => ({ theme: `Segment: ${s.name}`, priority: s.priority })),
          ...(output.swot_summary?.opportunities || []).slice(0, 2).map((o: string) => ({ theme: `Opportunity: ${o}`, priority: 'high' })),
        ],
      },
      _imported_from: 'business_model_canvas',
    };

    // Step 6: marketing workflow / channel plan
    stepData.step6 = {
      input: {
        user_notes: note + '\n\nChannels from BMC:\n' + channels.map((ch: any) => `- [${ch.phase}] ${ch.channel_name} (${ch.effectiveness})`).join('\n'),
      },
      output: {
        channel_plan: channels.map((ch: any) => ({
          phase: ch.phase,
          channel: ch.channel_name,
          type: ch.type,
          effectiveness: ch.effectiveness,
          tactics: ch.notes || '',
        })),
        relationship_strategy: relationships.map((r: any) => ({
          segment: r.segment,
          type: r.type,
          motivation: r.motivation,
          example: r.example || '',
        })),
      },
      _imported_from: 'business_model_canvas',
    };

    // Step 7: revenue + key metrics from BMC cost/revenue structure
    stepData.step7 = {
      input: {
        user_notes: note + '\n\nRevenue Streams:\n' + revenues.map((r: any) => `- ${r.description} (${r.price_range})`).join('\n'),
      },
      output: {
        revenue_summary: {
          total_streams: revenues.length,
          primary_stream: revenues[0]?.description || '-',
          pricing_model: revenues[0]?.pricing_model || '-',
          price_range: revenues[0]?.price_range || '-',
        },
        cost_summary: {
          model: costs.model || '-',
          margin_profile: costs.estimated_margin_profile || '-',
          top_fixed_costs: (costs.major_fixed_costs || []).slice(0, 3).map((c: any) => c.description),
          top_variable_costs: (costs.major_variable_costs || []).slice(0, 3).map((c: any) => c.description),
          economies_of_scale: costs.economies_of_scale || false,
          economies_of_scope: costs.economies_of_scope || false,
        },
        key_assumptions: (output.key_assumptions || []).map((a: any) => ({
          assumption: a.assumption,
          risk_level: a.risk_level,
          how_to_test: a.how_to_test,
        })),
        validation_questions: output.validation_questions || [],
        kpi_recommendations: [
          { metric: 'Customer Acquisition Cost (CAC)', target: '< ราคาขายเฉลี่ย ÷ 3' },
          { metric: 'Gross Margin', target: costs.estimated_margin_profile === 'high (>30%)' ? '> 30%' : costs.estimated_margin_profile === 'low (<10%)' ? '> 10%' : '> 20%' },
          { metric: 'Retention Rate (6mo)', target: '> 40%' },
          { metric: 'LTV/CAC Ratio', target: '> 3' },
        ],
      },
      _imported_from: 'business_model_canvas',
    };
  } else if (toolType === 'million_dollar_offer') {
    // Million Dollar Offer → Step 1 (positioning with offer name), Step 4 (positioning with VP/offer), Step 7 (revenue metric with pricing)
    const ve = output.value_equation_audit || {};
    const dream = output.dream_outcome || {};
    const pricing = output.pricing || {};
    const guarantee = output.guarantee || {};
    const offerName = output.offer_name || {};
    const valueStack = output.value_stack || [];
    const note = `[Imported from Million Dollar Offer]
Offer Name: ${offerName.full_name || '-'}
Value-to-Price Ratio: ${pricing.value_to_price_ratio || '-'}`;

    // Step 1: positioning with offer name
    stepData.step1 = {
      input: {
        business_name: input.business_name || '',
        business_type: input.business_type_resolved || input.business_type || '',
        industry: input.industry_resolved || input.industry || '',
        location: input.location || '',
        pain_point_1: ve.binding_constraint || '',
        pain_point_2: '',
        pain_point_3: '',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        differentiation: offerName.full_name || dream.specific_description || '',
        price_range: pricing.recommended_price || '',
        goal: output.what_makes_it_unbeatable || output.summary || '',
        user_notes: note,
      },
      output: {
        positioning: offerName.full_name || output.summary || '',
        uvp: dream.specific_description || '',
        target_audience: output.starving_crowd?.who || input.target_audience || '',
        voice_tone: '',
        anti_positioning: '',
        reasoning: note.slice(0, 200),
        offer_name: offerName,
        dream_outcome: dream,
        value_stack_total: output.trim_stack_summary?.total_perceived_value || '',
      },
      _imported_from: 'million_dollar_offer',
    };

    // Step 4: positioning with full offer details
    stepData.step4 = {
      input: {
        user_notes: note + '\n\nValue Stack:\n' + valueStack.map((v: any) => `- ${v.name} (${v.perceived_value})`).join('\n'),
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        price_position: pricing.recommended_price || '',
        goal: offerName.full_name || '',
      },
      output: {
        positioning_statement: offerName.full_name || dream.specific_description || '',
        positioning_one_liner: output.what_makes_it_unbeatable || '',
        uvp_bullets: valueStack.slice(0, 5).map((v: any) => `${v.name} (${v.perceived_value})`),
        tagline_options: [
          offerName.full_name,
          offerName.alternatives?.[0],
          offerName.alternatives?.[1],
        ].filter(Boolean),
        competitive_frame: {
          vs_status_quo: `Value-to-price ${pricing.value_to_price_ratio || '?'}`,
        },
        proof_points: valueStack.filter((v: any) => v.cost_to_deliver === 'low' && v.perceived_value).map((v: any) => `${v.name} (${v.perceived_value})`),
        elevator_pitch: dream.specific_description || '',
        offer: {
          value_equation: ve,
          dream_outcome: dream,
          value_stack: valueStack,
          pricing: pricing,
          guarantee: guarantee,
          offer_name: offerName,
          what_makes_it_unbeatable: output.what_makes_it_unbeatable,
        },
      },
      _imported_from: 'million_dollar_offer',
    };

    // Step 7: revenue + pricing metrics
    stepData.step7 = {
      input: {
        user_notes: note,
      },
      output: {
        revenue_summary: {
          recommended_price: pricing.recommended_price || '-',
          value_to_price_ratio: pricing.value_to_price_ratio || '-',
          payment_options: (pricing.payment_options || []).length,
          anchor_price: pricing.anchor_price || '-',
        },
        pricing_strategy: {
          rationale: pricing.pricing_rationale || '',
          payment_structures: pricing.payment_options || [],
        },
        value_delivery: {
          total_perceived_value: output.trim_stack_summary?.total_perceived_value || '-',
          components_count: valueStack.length,
          high_value_low_cost: output.trim_stack_summary?.kept_high_value_low_cost || [],
        },
        risk_reversal: {
          guarantee_type: guarantee.type || '-',
          guarantee_name: guarantee.name || '-',
          duration: guarantee.duration || '-',
        },
        kpi_recommendations: [
          { metric: 'Conversion Rate', target: 'เพิ่มขึ้น 10-40% จากการปรับ offer 1 lever' },
          { metric: 'Average Order Value (AOV)', target: 'เพิ่มขึ้น 2-3x จาก value stack' },
          { metric: 'Customer Lifetime Value (CLV)', target: 'เพิ่มจาก bonus + retention' },
          { metric: 'Refund Rate', target: '< 5% (ถ้า guarantee ดี)' },
        ],
      },
      _imported_from: 'million_dollar_offer',
    };
  } else if (toolType === 'objection_handler') {
    // Objection Handler → Step 4 (positioning with FAQ), Step 5 (content themes from FAQs), Step 6 (workflow with objection handling steps)
    const objections = output.objections || [];
    const faqs = output.faq_top_5 || [];
    const doDont = output.do_dont || {};
    const note = `[Imported from Objection Handler]
Top Objections: ${objections.length} | FAQ: ${faqs.length}`;

    // Step 4: positioning with FAQ answers
    const topObj = objections[0] || {};
    const topFAQ = faqs[0] || {};
    stepData.step4 = {
      input: {
        user_notes: note,
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        price_position: input.price_range || '',
        goal: topObj.objection || 'จัดการข้อโต้แย้งลูกค้า',
      },
      output: {
        positioning_statement: topObj.reframe_strategy || 'จัดการข้อโต้แย้งด้วยหลักฐาน + ความเข้าใจ',
        positioning_one_liner: output.summary || '',
        uvp_bullets: objections.slice(0, 5).map((o: any) => `จัดการ "${o.objection}" ด้วย ${o.reframe_strategy}`),
        tagline_options: [
          output.summary?.slice(0, 100),
          `จัดการ ${objections.length} objections ที่ลูกค้าถามบ่อย`,
        ].filter(Boolean),
        competitive_frame: {
          vs_status_quo: 'LAER + Reframing',
        },
        proof_points: objections.slice(0, 3).map((o: any) => o.evidence_to_provide?.[0]).filter(Boolean),
        elevator_pitch: faqs[0]?.a || '',
        objections: objections,
        faqs: faqs,
      },
      _imported_from: 'objection_handler',
    };

    // Step 5: content themes (FAQ → content)
    stepData.step5 = {
      input: {
        user_notes: note + '\n\nFAQ topics:\n' + faqs.map((f: any) => `- ${f.q}`).join('\n'),
      },
      output: {
        content_themes: [
          ...faqs.map((f: any) => ({ theme: `FAQ: ${f.q}`, priority: 'high' })),
          ...objections.slice(0, 3).map((o: any) => ({ theme: `Objection: ${o.objection}`, priority: 'high' })),
        ],
      },
      _imported_from: 'objection_handler',
    };

    // Step 6: marketing workflow with objection handling flow
    stepData.step6 = {
      input: {
        user_notes: note,
      },
      output: {
        objection_handling_playbook: objections.map((o: any) => ({
          objection: o.objection,
          category: o.category,
          what_customer_says: o.what_customer_says,
          reframe_strategy: o.reframe_strategy,
          response_script: o.response_script,
          evidence: o.evidence_to_provide,
          bridge: o.bridge_to_close,
        })),
        faq_knowledge_base: faqs,
        do_dont: doDont,
        common_patterns: output.common_patterns || [],
      },
      _imported_from: 'objection_handler',
    };
  } else if (toolType === 'hook_library') {
    // Hook Library → Step 5 (content themes from hooks), Step 6 (workflow with content calendar)
    const cats = output.hook_categories || [];
    const platforms = output.platform_specific || {};
    const headlines = output.headlines_5 || [];
    const note = `[Imported from Hook Library]
Categories: ${cats.length} | Headlines: ${headlines.length}`;

    // Step 5: content themes from hooks
    const allHooks: any[] = [];
    for (const c of cats) {
      for (const ex of (c.examples || [])) {
        allHooks.push({ category: c.name, hook: ex.hook, cta: ex.cta });
      }
    }
    stepData.step5 = {
      input: {
        user_notes: note,
      },
      output: {
        content_themes: allHooks.slice(0, 15).map((h: any) => ({
          theme: `[${h.category}] ${h.hook}`,
          priority: 'high',
          cta: h.cta,
        })),
        hook_library: {
          categories: cats,
          platform_specific: platforms,
          headlines: headlines,
        },
      },
      _imported_from: 'hook_library',
    };

    // Step 6: marketing workflow with content distribution
    stepData.step6 = {
      input: {
        user_notes: note,
      },
      output: {
        content_distribution: {
          facebook: platforms.facebook || [],
          instagram: platforms.instagram || [],
          youtube: platforms.youtube || [],
          tiktok: platforms.tiktok || [],
          email: platforms.email || [],
          landing_page: platforms.landing_page || [],
        },
        a_b_test_variants: headlines,
        ab_testing_tips: output.ab_testing_tips || [],
      },
      _imported_from: 'hook_library',
    };
  }

  // Add business context to all step_data
  if (input.business_name) {
    stepData._meta = {
      business_name: input.business_name,
      industry: input.industry || input.industry_resolved,
      imported_at: Date.now(),
      source_tool: toolType,
    };
  }

  return stepData;
}

// (GET/POST /api/projects and GET /api/projects/:id now live in one place,
// near the top of this file — see the note there. This used to be a second,
// dead-code copy that never ran.)

// =====================================================
// Presentation Tool Routes
// =====================================================
createPresentationRoutes(app);

// =====================================================
// Payments (Stripe PromptPay)
// =====================================================
app.route('/', paymentsRoutes);

// =====================================================
// 404 / Errors
// =====================================================
app.notFound((c) => c.json({ error: 'not_found', message: `Route ${c.req.method} ${c.req.path} not found` }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal_error', message: err.message || 'Something went wrong' }, 500);
});

export default app;
