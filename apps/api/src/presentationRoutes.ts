/**
 * Presentation Tool API Routes
 * 9-step wizard for AI Presentation Builder
 */

import { Hono } from 'hono';
import { callMinimax, estimateCost, extractJsonFromAny } from './lib/minimax';
import { deductCredits, addCredits, calculateCredits } from './lib/credit';
import { getColorTheme, COLOR_THEMES, PRESENTATION_OBJECTIVES, COMMUNICATION_STYLES, AUDIENCE_CONCERNS, SLIDE_TYPES, LAYOUT_PATTERNS, CHART_TYPES, frameworkVariantForObjective } from './lib/presentationPresets';
import {
  PRESENTATION_PROMPTS,
  STEP_CREDIT_COSTS,
  STEP_NAMES_TH,
  AUTOFILL_PROMPTS,
  type PresentationStepInput,
} from './lib/presentationPrompts';
import {
  buildPresentationHTML,
  buildPresentationMarkdown,
  buildPresentationJSON,
  buildPresentationCSV,
  buildPresentationPPTX,
  buildGoogleSheetExport,
  type PresentationExportData,
} from './lib/presentationExport';
import type { Context } from 'hono';
import { getGeneration } from './lib/media/generations';
import { readAssetObject } from './lib/media/assets';

const generateId = () => 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

interface Bindings {
  DB: D1Database;
  R2: R2Bucket;
  MINIMAX_API_KEY: string;
  MINIMAX_GROUP_ID: string;
  MINIMAX_MODEL: string;
  SESSION_SECRET?: string;
  [key: string]: any;
}

const BASE64_CHUNK_SIZE = 8192;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * Slides can reference an in-flight or completed AI image generation via
 * media_suggestion.generation_id (attached by the Step 7 UI's "generate
 * image" button, persisted through the ordinary PUT /step/7 save path).
 * Export needs the actual bytes, not just the reference, and must never fail
 * the whole export over one slide's image — an unfinished, cancelled, or
 * cross-user generation_id just falls back to the existing text placeholder.
 */
export async function resolveSlideImages(env: any, userId: string, blueprint: any): Promise<any> {
  if (!blueprint?.slides?.length) return blueprint;
  const slides = await Promise.all(blueprint.slides.map(async (slide: any) => {
    const generationId = slide?.media_suggestion?.generation_id;
    if (!generationId) return slide;
    try {
      const generation = await getGeneration(env, userId, generationId);
      if (!generation || generation.status !== 'completed') return slide;
      const asset = await env.DB.prepare(
        `SELECT * FROM media_assets WHERE generation_id = ? AND lifecycle_status = 'active' ORDER BY created_at ASC LIMIT 1`
      ).bind(generationId).first();
      if (!asset || asset.user_id !== userId) return slide;
      const object = await readAssetObject(env, asset);
      if (!object) return slide;
      const bytes = new Uint8Array(await object.arrayBuffer());
      return {
        ...slide,
        media_suggestion: {
          ...slide.media_suggestion,
          resolved_image_base64: bytesToBase64(bytes),
          resolved_image_mime: asset.mime_type,
        },
      };
    } catch {
      return slide;
    }
  }));
  return { ...blueprint, slides };
}

export function createPresentationRoutes(app: any) {
  // =====================================================
  // AUTH HELPERS (lightweight — reuse pattern from main)
  // =====================================================
  const requireAuth = async (c: any, next: () => Promise<void>) => {
    // Read session cookie (HttpOnly)
    const cookieHeader = c.req.header('Cookie') || '';
    const match = cookieHeader.match(/session=([^;]+)/);
    const sessionToken = match ? match[1] : null;
    if (!sessionToken) return c.json({ error: 'unauthorized' }, 401);

    // Look up session in DB
    const session: any = await c.env.DB.prepare(
      'SELECT s.id, s.user_id, s.expires_at, u.id as u_id, u.email, u.role, u.email_verified, u.credits FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?'
    ).bind(sessionToken, Date.now()).first();
    if (!session) return c.json({ error: 'unauthorized' }, 401);

    c.set('user', {
      id: session.user_id,
      email: session.email,
      role: session.role,
      email_verified: session.email_verified,
      credits: session.credits,
    });
    await next();
  };

  // =====================================================
  // GET /api/presentation/presets
  // Return all presets (themes, objectives, styles, etc.)
  // =====================================================
  app.get('/api/presentation/presets', async (c: any) => {
    return c.json({
      color_themes: COLOR_THEMES,
      objectives: PRESENTATION_OBJECTIVES,
      communication_styles: COMMUNICATION_STYLES,
      audience_concerns: AUDIENCE_CONCERNS,
      slide_types: SLIDE_TYPES,
      layout_patterns: LAYOUT_PATTERNS,
      chart_types: CHART_TYPES,
      step_names: STEP_NAMES_TH,
      step_credit_costs: STEP_CREDIT_COSTS,
    });
  });

  // =====================================================
  // LIST PROJECTS
  // =====================================================
  app.get('/api/presentation/projects', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const status = c.req.query('status') || 'draft';
    const rows = await c.env.DB.prepare(`
      SELECT p.id, p.title, p.objective, p.target_slides, p.time_minutes, p.color_theme,
             p.status, p.current_step, p.created_at, p.updated_at,
             (SELECT COUNT(*) FROM presentation_steps s WHERE s.project_id = p.id AND s.status = 'done') as steps_completed
      FROM presentation_projects p
      WHERE p.user_id = ? AND p.status = ?
      ORDER BY p.updated_at DESC
    `).bind(user.id, status).all();
    return c.json({ projects: rows.results || [] });
  });

  // =====================================================
  // CREATE PROJECT
  // =====================================================
  app.post('/api/presentation/projects', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const body = await c.req.json() as any;

    if (!body.title?.trim()) return c.json({ error: 'title_required', message: 'กรุณาใส่หัวข้อ' }, 400);
    if (!['informative', 'persuasive', 'story'].includes(body.objective || '')) {
      return c.json({ error: 'invalid_objective' }, 400);
    }

    const frameworkVariant = frameworkVariantForObjective(body.objective);

    const id = generateId();
    const now = Date.now();
    await c.env.DB.prepare(`
      INSERT INTO presentation_projects
      (id, user_id, title, objective, framework_variant, target_slides, time_minutes, language, color_theme, status, current_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?)
    `).bind(
      id, user.id, body.title.trim(), body.objective, frameworkVariant,
      body.target_slides || 10, body.time_minutes || 15,
      body.language || 'th', body.color_theme || 'business_blue',
      now, now
    ).run();

    return c.json({ ok: true, project: { id, title: body.title, objective: body.objective, framework_variant: frameworkVariant, current_step: 1 } });
  });

  // =====================================================
  // GET PROJECT (with all step data)
  // =====================================================
  app.get('/api/presentation/projects/:id', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const id = c.req.param('id');
    const project = await c.env.DB.prepare(
      'SELECT * FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    const steps = await c.env.DB.prepare(
      'SELECT step_number, status, framework_variant, output_json, custom_system_prompt, updated_at FROM presentation_steps WHERE project_id = ? ORDER BY step_number'
    ).bind(id).all();

    return c.json({ project, steps: steps.results || [] });
  });

  // =====================================================
  // UPDATE PROJECT (settings + step inputs)
  // =====================================================
  app.put('/api/presentation/projects/:id', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const id = c.req.param('id');
    const body = await c.req.json() as any;

    const project: any = await c.env.DB.prepare(
      'SELECT id, objective FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    const updates: string[] = [];
    const values: any[] = [];
    if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
    if (body.target_slides !== undefined) { updates.push('target_slides = ?'); values.push(body.target_slides); }
    if (body.time_minutes !== undefined) { updates.push('time_minutes = ?'); values.push(body.time_minutes); }
    if (body.color_theme !== undefined) { updates.push('color_theme = ?'); values.push(body.color_theme); }
    if (body.language !== undefined) { updates.push('language = ?'); values.push(body.language); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
    if (body.prompt_overrides !== undefined) { updates.push('prompt_overrides = ?'); values.push(JSON.stringify(body.prompt_overrides)); }
    if (body.objective !== undefined) {
      if (!['informative', 'persuasive', 'story'].includes(body.objective)) {
        return c.json({ error: 'invalid_objective' }, 400);
      }
      updates.push('objective = ?');
      values.push(body.objective);
      // framework_variant is a pure function of objective — keep it in sync
      // whenever objective changes, same formula as project creation.
      updates.push('framework_variant = ?');
      values.push(frameworkVariantForObjective(body.objective));
    }

    if (updates.length === 0) return c.json({ ok: true });

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);
    values.push(user.id);

    await c.env.DB.prepare(`UPDATE presentation_projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...values).run();
    return c.json({ ok: true });
  });

  // =====================================================
  // DELETE PROJECT (soft delete)
  // =====================================================
  app.delete('/api/presentation/projects/:id', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const id = c.req.param('id');
    await c.env.DB.prepare(
      'UPDATE presentation_projects SET status = "archived" WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).run();
    return c.json({ ok: true });
  });

  // =====================================================
  // GENERATE STEP
  // =====================================================
  app.post('/api/presentation/projects/:id/generate/:step', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const projectId = c.req.param('id');
    const stepNum = parseInt(c.req.param('step'), 10);

    if (!projectId || isNaN(stepNum) || stepNum < 1 || stepNum > 9) {
      return c.json({ error: 'invalid_step', message: 'Step ต้องเป็น 1-9' }, 400);
    }

    const env = c.env;
    const project = await env.DB.prepare(
      'SELECT * FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(projectId, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    if (project.email_verified === 0) {
      return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
    }

    const requiredCredits = STEP_CREDIT_COSTS[stepNum] || 0;
    const userCheck: any = await env.DB.prepare('SELECT credits FROM users WHERE id = ?')
      .bind(user.id).first();
    if ((userCheck?.credits || 0) < requiredCredits) {
      return c.json({
        error: 'insufficient_credits',
        message: `เครดิตไม่เพียงพอ (ต้องการ ${requiredCredits} credits)`,
        balance: userCheck?.credits || 0,
      }, 402);
    }

    const body = await c.req.json() as any;
    const input: PresentationStepInput = { ...(body.input || {}) };

    // Load all step outputs as context
    const allSteps = await env.DB.prepare(
      'SELECT step_number, output_json FROM presentation_steps WHERE project_id = ? AND status = ?'
    ).bind(projectId, 'done').all();
    const stepData: Record<string, any> = {};
    for (const s of (allSteps.results || [])) {
      try {
        stepData[`step${s.step_number}`] = JSON.parse(s.output_json || '{}');
      } catch {}
    }

    // Inject context from project
    input.title = input.title || project.title;
    input.objective = input.objective || project.objective;
    input.target_slides = input.target_slides || project.target_slides;
    input.time_minutes = input.time_minutes || project.time_minutes;
    input.color_theme = input.color_theme || project.color_theme;
    // `project.framework_variant` is the authoritative, currently-persisted
    // value — it is kept in sync with `project.objective` both at creation
    // and on every PUT edit (see the objective branch above), and migration
    // 018 backfills it for rows that predate the column, so it should always
    // be present. It MUST win over `stepData.step1?.framework_variant`: that
    // value is a cached copy inside step 1's own `output_json`, written the
    // last time step 1 was generated/saved — if the user edits `objective`
    // on an existing project (Step 1 already has a 'done' row) and resubmits
    // Step 1, this generate call is itself the one writing a fresh step 1
    // row, but `stepData.step1` here still reflects the OLD row from BEFORE
    // this request, so trusting it first would silently re-persist the
    // stale pre-edit framework forever — the objective edit would never
    // actually take effect for this or any later step's generation, with no
    // error surfaced anywhere. `stepData.step1?.framework_variant` is kept
    // only as a defensive fallback for the unlikely case the column is
    // somehow null, and the objective-derived call is the final fallback.
    input.framework_variant = project.framework_variant
      || stepData.step1?.framework_variant
      || frameworkVariantForObjective(project.objective);

    // Inject previous step outputs
    if (stepNum >= 3) {
      input.audience_persona = stepData.step2?.persona_card;
      if (stepData.step2?.concerns_responses) input.concerns_responses = stepData.step2.concerns_responses;
    }
    if (stepNum >= 4) input.atr = stepData.step3;
    if (stepNum >= 5) {
      input.atr = stepData.step3;
      input.must_have = stepData.step5?.must_have;
      input.maybe = stepData.step5?.maybe;
    }
    if (stepNum >= 6) {
      input.audience_persona = stepData.step2?.persona_card;
      input.atr = stepData.step3;
      input.must_have = stepData.step5?.must_have;
      input.maybe = stepData.step5?.maybe;
    }
    if (stepNum >= 7) {
      input.outline = stepData.step6;
      if (stepNum >= 8) input.blueprint = stepData.step7;
    }
    if (stepNum >= 8) {
      input.outline = stepData.step6;
      input.blueprint = stepData.step7;
      input.audience_persona = stepData.step2?.persona_card;
      input.concerns_responses = stepData.step2?.concerns_responses;
    }

    const template = PRESENTATION_PROMPTS[stepNum];
    if (requiredCredits > 0) {
      // Steps with AI generation
      const { system: defaultSystem, user: userMsg } = template.buildPrompt(input);
      const finalSystem = body.custom_system_prompt
        ? `${defaultSystem}\n\n--- USER OVERRIDE ---\n${body.custom_system_prompt}\n\n⚠️ ห้าม reasoning — ตอบ JSON object ใน content field เท่านั้น`
        : defaultSystem + '\n\n🚫 ห้าม reasoning — ตอบ JSON object ใน content field เท่านั้น';

      // `input.framework_variant` (set above, prioritizing the persisted
      // `project.framework_variant` column) already has the correct value —
      // D1 rejects `undefined` as a bind parameter outright, which is why
      // the fallback chain above always resolves to a real string.
      const frameworkVariant = input.framework_variant;

      // Reserve credits BEFORE calling the AI (and before claiming the step
      // row, see below) — same reserve-then-reconcile pattern used
      // elsewhere in this codebase (see index.ts step generation): estimate
      // on the worst case (full max_tokens), refund the difference once
      // real usage is known. This replaces deducting AFTER the call with no
      // reservation, which let a step be delivered and marked done even
      // when the real (post-hoc) cost couldn't be charged — the user got
      // the content for free/underpaid with no error surfaced anywhere.
      // Doing this BEFORE the row claim (rather than after) means a user
      // without enough credits is rejected without presentation_steps being
      // touched at all — no phantom row with `input_json` set but no real
      // output, which would otherwise make the frontend's step indicator
      // (which treats "has input_json OR output_json" as done) show a false
      // checkmark for a generation that never actually ran.
      const genId = generateId();
      const estPromptTokens = Math.ceil((finalSystem.length + userMsg.length) / 3);
      const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: template.maxTokens });
      const reservation = await deductCredits(env, user.id, reserveCredits, 'presentation_generation_reserve', genId);
      if (!reservation.ok) {
        return c.json({
          error: 'insufficient_credits',
          message: `เครดิตไม่เพียงพอ (ต้องการประมาณ ${reserveCredits} credits)`,
          balance: reservation.balance,
        }, 402);
      }

      // Claim the step row atomically in ONE statement instead of
      // "SELECT existing row, check its status, then INSERT/UPDATE" —
      // a separate read-then-write is not atomic: two requests racing
      // (double-click, two open tabs) can BOTH read "no active generation"
      // before either one's write commits, so both proceed, both call the
      // AI, and whichever's completion UPDATE runs first gets silently
      // orphaned by `ON CONFLICT DO UPDATE` keeping the *other* request's
      // row id (0 rows affected, no error — the exact bug this whole fix is
      // meant to close). The `WHERE` clause on the conflict action makes
      // SQLite evaluate "is this row actively generating and still fresh?"
      // as part of the same atomic statement, so only one racing request
      // can ever have `changes > 0` — the loser refunds its reservation
      // immediately below instead of ever calling the AI.
      const stepId = generateId();
      const claimResult = await env.DB.prepare(`
        INSERT INTO presentation_steps
          (id, project_id, step_number, input_json, status, framework_variant, custom_system_prompt, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'generating', ?, ?, ?, ?)
        ON CONFLICT(project_id, step_number) DO UPDATE SET
          input_json = excluded.input_json,
          status = 'generating',
          framework_variant = excluded.framework_variant,
          custom_system_prompt = excluded.custom_system_prompt,
          updated_at = excluded.updated_at
        WHERE presentation_steps.status != 'generating' OR presentation_steps.updated_at < ?
      `).bind(stepId, projectId, stepNum, JSON.stringify(input),
        frameworkVariant, body.custom_system_prompt || null, Date.now(), Date.now(), Date.now() - 120_000).run();

      if (claimResult.meta.changes === 0) {
        // Another request already holds an active (< 120s old) 'generating'
        // claim on this exact step — refund the reservation we just made
        // (we're not going to use it) and reject.
        const refund = await addCredits(env, user.id, reserveCredits, 'presentation_generation_refund', { referenceId: genId, note: 'Lost the race for this step to a concurrent request' });
        return c.json({ error: 'generation_in_progress', message: 'ขั้นตอนนี้กำลังสร้างอยู่ กรุณารอสักครู่', credits_remaining: refund.ok ? refund.balance : undefined }, 409);
      }

      // We won the claim, but if the conflict branch fired (an existing row
      // in 'done'/'error'/'pending' status was reclaimed), the row's real id
      // is the ORIGINAL row's id, not our candidate `stepId` — the ON
      // CONFLICT UPDATE never touches the `id` column. Re-read it now; this
      // is race-free because we just atomically marked it 'generating' with
      // a fresh timestamp, so any other request's own claim attempt will
      // fail the same WHERE check until we finish or 120s pass.
      const claimedStep: any = await env.DB.prepare(
        'SELECT id FROM presentation_steps WHERE project_id = ? AND step_number = ?'
      ).bind(projectId, stepNum).first();
      const actualStepId = claimedStep?.id || stepId;

      const startTime = Date.now();
      let result;
      try {
        result = await callMinimax(
          { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
          [
            { role: 'system', content: finalSystem },
            { role: 'user', content: userMsg + '\n\n[ตอบ JSON object ใน content field เท่านั้น]' },
          ],
          { maxTokens: template.maxTokens, temperature: 0.7, jsonMode: true }
        );
      } catch (err: any) {
        // Restore 'done' (not 'error') if this row already had completed
        // output from an earlier successful generation — a failed
        // regeneration attempt must not drop an already-done step out of
        // the `status = 'done'` context filter used for later steps.
        await env.DB.prepare(
          "UPDATE presentation_steps SET status = CASE WHEN output_json IS NOT NULL THEN 'done' ELSE 'error' END, error = ?, updated_at = ? WHERE id = ?"
        ).bind(err.message, Date.now(), actualStepId).run();
        const refund = await addCredits(env, user.id, reserveCredits, 'presentation_generation_refund', { referenceId: genId, note: 'AI call failed' });
        return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
      }

      let output: any;
      try {
        output = extractJsonFromAny(result.content, result.reasoning);
      } catch (err: any) {
        await env.DB.prepare(
          "UPDATE presentation_steps SET status = CASE WHEN output_json IS NOT NULL THEN 'done' ELSE 'error' END, error = ?, updated_at = ? WHERE id = ?"
        ).bind(`parse_error: ${err.message}`, Date.now(), actualStepId).run();
        const refund = await addCredits(env, user.id, reserveCredits, 'presentation_generation_refund', { referenceId: genId, note: 'AI returned unparseable output' });
        return c.json({
          error: 'parse_error',
          message: 'AI returned invalid JSON',
          raw: result.content.slice(0, 500),
          reasoning: result.reasoning.slice(0, 500),
          credits_remaining: refund.ok ? refund.balance : undefined,
        }, 500);
      }

      const durationMs = Date.now() - startTime;
      const costUsd = estimateCost(result.usage);
      const creditsUsed = calculateCredits(result.usage);

      // Update step
      await env.DB.prepare(`
        UPDATE presentation_steps
        SET output_json = ?, status = 'done', tokens_used = ?, cost_usd = ?, duration_ms = ?, updated_at = ?
        WHERE id = ?
      `).bind(JSON.stringify(output), result.usage?.total_tokens || 0, costUsd, durationMs, Date.now(), actualStepId).run();

      // Update project current_step
      const nextStep = Math.min(stepNum + 1, 9);
      await env.DB.prepare(
        'UPDATE presentation_projects SET current_step = ?, updated_at = ? WHERE id = ?'
      ).bind(Math.max(nextStep, project.current_step), Date.now(), projectId).run();

      // True-up: refund the unused portion of the reservation, or charge
      // the (rare) overage if real usage exceeded the worst-case estimate.
      let finalBalance = reservation.balance;
      if (creditsUsed < reserveCredits) {
        const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'presentation_generation_refund', { referenceId: genId, note: 'Reserved more than actual usage' });
        if (refund.ok) finalBalance = refund.balance;
      } else if (creditsUsed > reserveCredits) {
        const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'presentation_generation_true_up', genId);
        if (extra.ok) finalBalance = extra.balance;
      }

      return c.json({
        ok: true,
        step: stepNum,
        output,
        meta: {
          duration_ms: durationMs,
          tokens: result.usage,
          cost_usd: costUsd,
          credits_used: creditsUsed,
          credits_remaining: finalBalance,
        },
      });
    } else {
      // Step 1, 4, 9 — no AI, just save input. Upsert by natural key
      // (project_id, step_number) rather than `INSERT OR REPLACE` with a
      // fresh id every time, so the row's id stays stable across saves.
      const existingStep: any = await env.DB.prepare(
        'SELECT id FROM presentation_steps WHERE project_id = ? AND step_number = ?'
      ).bind(projectId, stepNum).first();
      const stepId = existingStep?.id || generateId();
      await env.DB.prepare(`
        INSERT INTO presentation_steps
          (id, project_id, step_number, input_json, output_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'done', ?, ?)
        ON CONFLICT(project_id, step_number) DO UPDATE SET
          input_json = excluded.input_json,
          output_json = excluded.output_json,
          status = 'done',
          updated_at = excluded.updated_at
      `).bind(stepId, projectId, stepNum, JSON.stringify(input), JSON.stringify(input), Date.now(), Date.now()).run();

      // Update project current_step
      const nextStep = Math.min(stepNum + 1, 9);
      await env.DB.prepare(
        'UPDATE presentation_projects SET current_step = ?, updated_at = ? WHERE id = ?'
      ).bind(Math.max(nextStep, project.current_step), Date.now(), projectId).run();

      return c.json({ ok: true, step: stepNum, output: input, meta: { credits_used: 0, credits_remaining: userCheck?.credits || 0 } });
    }
  });

  // =====================================================
  // AUTOFILL STEP (Steps 1-3 only) — draft the step's OWN input fields from
  // whatever context exists so far, for the user to review/edit before
  // actually saving/generating. Advisory only: unlike /generate, this never
  // writes to presentation_steps — it just returns a suggestion.
  // =====================================================
  app.post('/api/presentation/projects/:id/autofill/:step', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const projectId = c.req.param('id');
    const stepNum = parseInt(c.req.param('step'), 10);

    if (!AUTOFILL_PROMPTS[stepNum]) {
      return c.json({ error: 'invalid_step', message: 'Autofill รองรับเฉพาะ Step 1-3' }, 400);
    }

    const env = c.env;
    const project: any = await env.DB.prepare(
      'SELECT * FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(projectId, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    const body = await c.req.json().catch(() => ({})) as any;
    const input: PresentationStepInput = { ...(body.input || {}) };
    input.title = input.title || project.title;
    input.objective = input.objective || project.objective;

    if (stepNum === 3 && !input.audience_persona) {
      const step2: any = await env.DB.prepare(
        "SELECT output_json FROM presentation_steps WHERE project_id = ? AND step_number = 2 AND status = 'done'"
      ).bind(projectId).first();
      if (step2) {
        try {
          input.audience_persona = JSON.parse(step2.output_json || '{}').persona_card;
        } catch {}
      }
    }

    const template = AUTOFILL_PROMPTS[stepNum];
    const { system, user: userMsg } = template.buildPrompt(input);

    const genId = generateId();
    const estPromptTokens = Math.ceil((system.length + userMsg.length) / 3);
    const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: template.maxTokens });
    const reservation = await deductCredits(env, user.id, reserveCredits, 'presentation_autofill_reserve', genId);
    if (!reservation.ok) {
      return c.json({
        error: 'insufficient_credits',
        message: `เครดิตไม่เพียงพอ (ต้องการประมาณ ${reserveCredits} credits)`,
        balance: reservation.balance,
      }, 402);
    }

    let result;
    try {
      result = await callMinimax(
        { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
        [
          { role: 'system', content: system + '\n\n🚫 ห้าม reasoning — ตอบ JSON object เท่านั้นใน content field' },
          { role: 'user', content: userMsg + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น]' },
        ],
        { maxTokens: template.maxTokens, temperature: 0.8, jsonMode: true }
      );
    } catch (err: any) {
      const refund = await addCredits(env, user.id, reserveCredits, 'presentation_autofill_refund', { referenceId: genId, note: 'AI call failed' });
      return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
    }

    let suggestion: any;
    try {
      suggestion = extractJsonFromAny(result.content, result.reasoning);
    } catch (err: any) {
      const refund = await addCredits(env, user.id, reserveCredits, 'presentation_autofill_refund', { referenceId: genId, note: 'AI returned unparseable output' });
      return c.json({
        error: 'parse_error',
        message: 'AI returned invalid JSON',
        credits_remaining: refund.ok ? refund.balance : undefined,
      }, 500);
    }

    const creditsUsed = calculateCredits(result.usage);
    let finalBalance = reservation.balance;
    if (creditsUsed < reserveCredits) {
      const refund = await addCredits(env, user.id, reserveCredits - creditsUsed, 'presentation_autofill_refund', { referenceId: genId, note: 'Reserved more than actual usage' });
      if (refund.ok) finalBalance = refund.balance;
    } else if (creditsUsed > reserveCredits) {
      const extra = await deductCredits(env, user.id, creditsUsed - reserveCredits, 'presentation_autofill_true_up', genId);
      if (extra.ok) finalBalance = extra.balance;
    }

    // A hallucinated communication_style/concern id must never reach the
    // frontend as if it were a real, selectable option.
    if (stepNum === 2) {
      const validStyles = new Set<string>(COMMUNICATION_STYLES.map((s) => s.id));
      const validConcerns = new Set<string>(AUDIENCE_CONCERNS.map((cn) => cn.id));
      suggestion.communication_styles = Array.isArray(suggestion.communication_styles)
        ? suggestion.communication_styles.filter((id: string) => validStyles.has(id))
        : [];
      suggestion.audience_concerns = Array.isArray(suggestion.audience_concerns)
        ? suggestion.audience_concerns.filter((id: string) => validConcerns.has(id))
        : [];
    }
    if (stepNum === 1 && !['informative', 'persuasive', 'story'].includes(suggestion.objective)) {
      suggestion.objective = input.objective || 'informative';
    }

    return c.json({
      ok: true,
      step: stepNum,
      suggestion,
      meta: { credits_used: creditsUsed, credits_remaining: finalBalance },
    });
  });

  // =====================================================
  // SAVE STEP INPUT (without AI generation)
  // =====================================================
  app.put('/api/presentation/projects/:id/step/:step', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const projectId = c.req.param('id');
    const stepNum = parseInt(c.req.param('step'), 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 9) {
      return c.json({ error: 'invalid_step' }, 400);
    }

    const project = await c.env.DB.prepare(
      'SELECT id FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(projectId, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    const body = await c.req.json() as any;
    const existing = await c.env.DB.prepare(
      'SELECT id FROM presentation_steps WHERE project_id = ? AND step_number = ?'
    ).bind(projectId, stepNum).first();

    if (existing) {
      const updates: string[] = [];
      const values: any[] = [];
      if (body.input !== undefined) { updates.push('input_json = ?'); values.push(JSON.stringify(body.input)); }
      if (body.output !== undefined) { updates.push('output_json = ?'); values.push(JSON.stringify(body.output)); }
      if (body.custom_system_prompt !== undefined) { updates.push('custom_system_prompt = ?'); values.push(body.custom_system_prompt); }
      if (updates.length === 0) return c.json({ ok: true });
      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(existing.id);
      await c.env.DB.prepare(`UPDATE presentation_steps SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO presentation_steps (id, project_id, step_number, input_json, output_json, custom_system_prompt, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        generateId(), projectId, stepNum,
        body.input ? JSON.stringify(body.input) : null,
        body.output ? JSON.stringify(body.output) : null,
        body.custom_system_prompt || null,
        Date.now(), Date.now()
      ).run();
    }

    await c.env.DB.prepare(
      'UPDATE presentation_projects SET updated_at = ? WHERE id = ?'
    ).bind(Date.now(), projectId).run();

    return c.json({ ok: true });
  });

  // =====================================================
  // EXPORT PRESENTATION
  // =====================================================
  app.post('/api/presentation/projects/:id/export', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const projectId = c.req.param('id');
    const body = await c.req.json() as any;
    const format = body.format || 'html';

    const env = c.env;
    const project = await env.DB.prepare(
      'SELECT * FROM presentation_projects WHERE id = ? AND user_id = ?'
    ).bind(projectId, user.id).first();
    if (!project) return c.json({ error: 'not_found' }, 404);

    // Load all step outputs
    const stepRows = await env.DB.prepare(
      'SELECT step_number, output_json FROM presentation_steps WHERE project_id = ? AND status = ?'
    ).bind(projectId, 'done').all();
    const stepData: Record<string, any> = {};
    for (const s of (stepRows.results || [])) {
      try { stepData[`step${s.step_number}`] = JSON.parse(s.output_json || '{}'); } catch {}
    }

    const outline = stepData.step6 || {};
    const blueprint = await resolveSlideImages(env, user.id, stepData.step7 || {});
    const notes = stepData.step8 || {};

    if (!outline.outline && !blueprint.slides) {
      return c.json({ error: 'no_outline', message: 'ต้อง generate Step 6 ก่อน export' }, 400);
    }

    const colorTheme = getColorTheme(project.color_theme || 'business_blue');
    const exportData: PresentationExportData = {
      project: { id: project.id, title: project.title, objective: project.objective },
      outline: outline.outline ? outline : { framework: 'scqa_minto', outline: [] },
      blueprint,
      notes,
      colorTheme,
    };

    let content: ArrayBuffer | string;
    let mimeType: string;
    let fileExt: string;
    let r2Key: string;
    const exportId = generateId();

    if (format === 'pptx') {
      // PPTX — server-side via PptxGenJS
      if (!exportData.outline.outline.length) {
        return c.json({ error: 'no_outline', message: 'ต้อง generate Step 6 ก่อน export PPTX' }, 400);
      }
      content = await buildPresentationPPTX(exportData);
      mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      fileExt = 'pptx';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    } else if (format === 'gsheet') {
      // Google Sheet — returns CSV + URL
      const gs = buildGoogleSheetExport(exportData);
      const payload = JSON.stringify({
        csv: gs.csv,
        google_sheets_url: gs.googleSheetsUrl,
        rows_added: gs.rowsAdded,
        instructions: '1) คลิก "Open in Google Sheets" 2) ไปที่ File > Import > Upload เลือกไฟล์ CSV นี้',
      });
      content = payload;
      mimeType = 'application/json; charset=utf-8';
      fileExt = 'json';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.gsheet.json`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    } else if (format === 'md' || format === 'markdown') {
      content = buildPresentationMarkdown(exportData);
      mimeType = 'text/markdown; charset=utf-8';
      fileExt = 'md';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    } else if (format === 'json') {
      content = buildPresentationJSON(exportData);
      mimeType = 'application/json; charset=utf-8';
      fileExt = 'json';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    } else if (format === 'csv') {
      content = buildPresentationCSV(exportData);
      mimeType = 'text/csv; charset=utf-8';
      fileExt = 'csv';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    } else {
      // HTML default
      content = buildPresentationHTML(exportData);
      mimeType = 'text/html; charset=utf-8';
      fileExt = 'html';
      r2Key = `presentation-exports/${user.id}/${projectId}/${exportId}.${fileExt}`;
      await env.R2.put(r2Key, content, { httpMetadata: { contentType: mimeType } });
    }

    const fileSize = typeof content === 'string' ? content.length : content.byteLength;
    await env.DB.prepare(`
      INSERT INTO presentation_exports (id, project_id, user_id, format, r2_key, file_size, slide_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(exportId, projectId, user.id, format, r2Key, fileSize, exportData.outline.outline?.length || 0, Date.now()).run();

    return c.json({
      ok: true,
      export_id: exportId,
      format,
      url: `/api/presentation/exports/${exportId}`,
      size: fileSize,
      note: format === 'html' ? 'เปิด URL → Cmd/Ctrl+P → Save as PDF' : format === 'gsheet' ? 'ดาวน์โหลด CSV แล้ว import ใน Google Sheets' : 'กดดาวน์โหลด',
    });
  });

  // =====================================================
  // DOWNLOAD EXPORT
  // =====================================================
  app.get('/api/presentation/exports/:id', requireAuth, async (c: any) => {
    const user = c.get('user')!;
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(
      'SELECT * FROM presentation_exports WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first();
    if (!row) return c.json({ error: 'not_found' }, 404);

    const obj = await c.env.R2.get(row.r2_key);
    if (!obj) return c.json({ error: 'file_missing' }, 404);

    const headers: Record<string, string> = {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    };
    if (row.format === 'pptx') {
      headers['Content-Disposition'] = `attachment; filename="${row.project_id}.pptx"`;
    } else if (row.format === 'md') {
      headers['Content-Disposition'] = `attachment; filename="${row.project_id}.md"`;
    } else if (row.format === 'csv') {
      headers['Content-Disposition'] = `attachment; filename="${row.project_id}.csv"`;
    } else if (row.format === 'json') {
      headers['Content-Disposition'] = `attachment; filename="${row.project_id}.json"`;
    }
    return new Response(obj.body, { headers });
  });
}
