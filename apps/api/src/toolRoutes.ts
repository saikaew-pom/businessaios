/**
 * Standalone AI Tools — 10 single-shot generators (pain-generator,
 * brand-voice, persona-builder, competitor-analysis, jtbd-generator,
 * value-proposition-canvas, business-model-canvas, million-dollar-offer,
 * objection-handler, hook-library).
 *
 * Extracted out of index.ts (M1 refactor, 2026-07-29) — same
 * createXRoutes(app) pattern as presentationRoutes.ts/paymentsRoutes.ts.
 *
 * Each follows the identical reserve-credits-before-AI-call /
 * refund-or-true-up-after pattern as /api/projects/:id/generate/:step in
 * index.ts (see docs/AUDIT.md — these had the same non-atomic-credit and
 * dead-email-gate bugs, copy-pasted, fixed 2026-07-29).
 */
import type { Hono } from 'hono';
import { requireAuth, rateLimit } from './lib/middleware';
import { generateId } from './lib/crypto';
import { calculateCredits, deductCredits, addCredits } from './lib/credit';
import { callMinimax, extractJsonFromAny, estimateCost } from './lib/minimax';
import {
  painGeneratorPrompt, brandVoicePrompt, personaBuilderPrompt,
  competitorAnalysisPrompt, jtbdGeneratorPrompt, valuePropositionCanvasPrompt,
  bmcGeneratorPrompt, millionDollarOfferPrompt, objectionHandlerPrompt,
  hookLibraryPrompt,
} from './lib/prompts';
import type { Bindings, Variables } from './lib/types';

export function createToolRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {

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

  // Email verification gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = painGeneratorPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    console.error('Pain generator error:', err);
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    console.error('Pain parse error:', err.message);
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Save to usage table
  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'pain_generator', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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

  // Email verification gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = brandVoicePrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    console.error('Brand voice error:', err);
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'brand_voice', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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

  // Email verification gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = personaBuilderPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'persona_builder', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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

  // Email verification gate
  const u = await env.DB.prepare('SELECT email_verified, credits FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number; credits: number }>();
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = competitorAnalysisPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'competitor_analysis', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = jtbdGeneratorPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 10000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'jtbd_generator', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = valuePropositionCanvasPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  // Bumped 10000 -> 14000: messaging_hierarchy/application_guide fields added
  // to the prompt pushed real usage to 78% of the old ceiling (7780/10000
  // tokens on a real test generation) — too close for comfort.
  const toolRunId = generateId();
  const toolMaxTokens = 14000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'value_proposition_canvas', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = bmcGeneratorPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'business_model_canvas', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = millionDollarOfferPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'million_dollar_offer', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = objectionHandlerPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  // Bumped 16000 -> 20000: the explore_question/second_response fields added
  // to the prompt pushed real usage to 88% of the old ceiling (7 objections,
  // 14104/16000 tokens) — too close for comfort at 8 objections.
  const toolRunId = generateId();
  const toolMaxTokens = 20000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.7, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'objection_handler', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
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
  if (u && u.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const startTime = Date.now();
  const { system, user: userMsg } = hookLibraryPrompt.buildPrompt(input);

  // Reserve credits before calling the AI (atomic; refunded/trued-up below
  // once real usage is known) — same pattern as /api/projects/:id/generate/:step.
  const toolRunId = generateId();
  const toolMaxTokens = 16000;
  const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: toolMaxTokens });
  const reservation = await deductCredits(env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON ใน content field เท่านั้น' },
        { role: 'user', content: userMsg + '\n\n[ตอบ JSON object เท่านั้น]' },
      ],
      { maxTokens: toolMaxTokens, temperature: 0.8, jsonMode: true }
    );
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    const refund = await addCredits(env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      reasoning: result.reasoning.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  // Best-effort usage log — if this write fails, still return the AI
  // output the user already paid for rather than losing it (and the
  // credits already reserved) over a logging-table write error.
  try {
    await env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'hook_library', JSON.stringify(input), JSON.stringify(output), env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0, result.usage?.total_tokens || 0,
      estimateCost(result.usage), Date.now() - startTime, Date.now()
    ).run();
  } catch (err: any) {
    console.error('Failed to save tool_run (non-fatal):', err);
  }

  // Reconcile the reservation against actual usage (refund or true-up)
  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

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
      credits_remaining: finalBalance,
    },
  });
});

}
