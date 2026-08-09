import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { getUser, requireAuth, requireAdmin } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';
import { addCredits, deductCredits, calculateCredits } from './lib/credit';
import { createBrandContextSnapshot, getBrandSnapshotObject, formatBrandContextBlock } from './lib/creative/brandContext';
import { callMinimax, extractJsonFromAny } from './lib/minimax';
import {
  MAX_EXISTING_HOOKS,
  callSeriesGeneration,
  getTemplateForUser,
  getVisibleTemplates,
  resolvePlatforms,
  resolveSlots,
  serializeSeries,
  serializeSeriesTemplate,
  callVisualSlotGeneration,
  validateSeriesInput,
  type ContentSeriesRow,
  type ContentSeriesTemplateRow,
} from './lib/creative/contentSeries';
import { resolveFramework } from './lib/creative/frameworks';
import { buildSalesPostPrompt, resolveIncludedBlocks, validateSalesPostInput, type SalesPostInput } from './lib/creative/salesPost';

const contentSeriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

contentSeriesRoutes.use('/api/content-series', requireAuth, requireFeature);
contentSeriesRoutes.use('/api/content-series/*', requireAuth, requireFeature);

async function requireFeature(c: any, next: any) {
  if (c.env.CONTENT_SERIES_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Content Series Generator is not enabled' }, 404);
  }
  await next();
}

function parseJsonBody(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function contentItemHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(sortJson(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortJson(v)]));
  }
  return value;
}

// =====================================================
// Templates — admin templates are global (owner_user_id NULL, visible to
// everyone); user templates are private to their creator.
// =====================================================

contentSeriesRoutes.get('/api/content-series/templates', async (c) => {
  const user = getUser(c)!;
  const rows = await getVisibleTemplates(c.env, user.id);
  return c.json({ templates: rows.map(serializeSeriesTemplate) });
});

contentSeriesRoutes.post('/api/content-series/templates', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    name?: string;
    description?: string;
    slots?: unknown;
    default_platforms?: unknown;
    owner_type?: string;
  }>();

  if (!body.name?.trim()) return c.json({ error: 'validation_error', errors: ['name_required'] }, 400);
  if (body.slots !== undefined && !Array.isArray(body.slots)) {
    return c.json({ error: 'validation_error', errors: ['slots_must_be_array'] }, 400);
  }
  if (body.default_platforms !== undefined && !Array.isArray(body.default_platforms)) {
    return c.json({ error: 'validation_error', errors: ['default_platforms_must_be_array'] }, 400);
  }

  let ownerType: 'admin' | 'user' = 'user';
  if (body.owner_type === 'admin') {
    const full = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(user.id).first<{ role: string | null }>();
    if (full?.role !== 'admin') return c.json({ error: 'forbidden', message: 'Admin access required to create a global template' }, 403);
    ownerType = 'admin';
  }

  const id = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO content_series_templates (
      id, owner_type, owner_user_id, name, description, slots_json,
      default_platforms_json, is_active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id,
    ownerType,
    ownerType === 'admin' ? null : user.id,
    body.name.trim(),
    body.description || '',
    JSON.stringify(body.slots || []),
    JSON.stringify(body.default_platforms || []),
    now,
    now,
  ).run();

  const row = await c.env.DB.prepare('SELECT * FROM content_series_templates WHERE id = ?').bind(id).first<ContentSeriesTemplateRow>();
  return c.json(serializeSeriesTemplate(row!), 201);
});

contentSeriesRoutes.put('/api/content-series/templates/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM content_series_templates WHERE id = ?').bind(id).first<ContentSeriesTemplateRow>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const isOwner = existing.owner_type === 'user' && existing.owner_user_id === user.id;
  let isAdmin = false;
  if (existing.owner_type === 'admin') {
    const full = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(user.id).first<{ role: string | null }>();
    isAdmin = full?.role === 'admin';
  }
  if (!isOwner && !isAdmin) return c.json({ error: 'forbidden' }, 403);

  const body = await c.req.json<{
    name?: string;
    description?: string;
    slots?: unknown;
    default_platforms?: unknown;
    is_active?: boolean;
  }>();
  if (body.slots !== undefined && !Array.isArray(body.slots)) {
    return c.json({ error: 'validation_error', errors: ['slots_must_be_array'] }, 400);
  }
  if (body.default_platforms !== undefined && !Array.isArray(body.default_platforms)) {
    return c.json({ error: 'validation_error', errors: ['default_platforms_must_be_array'] }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE content_series_templates
    SET name = ?, description = ?, slots_json = ?, default_platforms_json = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    body.name?.trim() || existing.name,
    body.description ?? existing.description,
    JSON.stringify(body.slots ?? parseJsonBody(existing.slots_json, [])),
    JSON.stringify(body.default_platforms ?? parseJsonBody(existing.default_platforms_json, [])),
    body.is_active === undefined ? existing.is_active : (body.is_active ? 1 : 0),
    Date.now(),
    id,
  ).run();

  const row = await c.env.DB.prepare('SELECT * FROM content_series_templates WHERE id = ?').bind(id).first<ContentSeriesTemplateRow>();
  return c.json(serializeSeriesTemplate(row!));
});

contentSeriesRoutes.delete('/api/content-series/templates/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM content_series_templates WHERE id = ?').bind(id).first<ContentSeriesTemplateRow>();
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const isOwner = existing.owner_type === 'user' && existing.owner_user_id === user.id;
  let isAdmin = false;
  if (existing.owner_type === 'admin') {
    const full = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(user.id).first<{ role: string | null }>();
    isAdmin = full?.role === 'admin';
  }
  if (!isOwner && !isAdmin) return c.json({ error: 'forbidden' }, 403);

  await c.env.DB.prepare('UPDATE content_series_templates SET is_active = 0, updated_at = ? WHERE id = ?').bind(Date.now(), id).run();
  return c.json({ ok: true });
});

// =====================================================
// Series generation
// =====================================================

contentSeriesRoutes.get('/api/content-series', async (c) => {
  const user = getUser(c)!;
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 30)));
  const rows = await c.env.DB.prepare(`
    SELECT * FROM content_series WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `).bind(user.id, limit).all<ContentSeriesRow>();
  return c.json({ series: (rows.results || []).map(serializeSeries) });
});

contentSeriesRoutes.get('/api/content-series/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const series = await c.env.DB.prepare('SELECT * FROM content_series WHERE id = ? AND user_id = ?').bind(id, user.id).first<ContentSeriesRow>();
  if (!series) return c.json({ error: 'not_found' }, 404);
  const items = await c.env.DB.prepare(`
    SELECT * FROM content_items WHERE series_id = ? AND user_id = ? ORDER BY series_slot_index ASC
  `).bind(id, user.id).all<any>();
  return c.json({
    series: serializeSeries(series),
    items: (items.results || []).map((row: any) => ({
      ...row,
      hashtags: parseJsonBody(row.hashtags_json, []),
      metadata: parseJsonBody(row.metadata_json, {}),
      hashtags_json: undefined,
      metadata_json: undefined,
    })),
  });
});

contentSeriesRoutes.post('/api/content-series', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    topic?: string;
    requested_count?: number;
    cadence_days?: number;
    start_date?: number;
    template_id?: string | null;
    brand_profile_id?: string | null;
    project_id?: string | null;
    platforms?: string[];
    topic_id?: string | null;
  }>();

  const input = {
    topic: body.topic?.trim() || '',
    requested_count: Number(body.requested_count),
    cadence_days: body.cadence_days,
    start_date: body.start_date,
    template_id: body.template_id || null,
    brand_profile_id: body.brand_profile_id || null,
    project_id: body.project_id || null,
    platforms: body.platforms,
    // Content Playbook ขั้นที่ 2 (Topic Picker) — optional link back to the
    // content_topics row this series was generated from, so it can be
    // marked "used" only once generation actually succeeds (not just
    // tapped-then-abandoned). Doesn't change validateSeriesInput at all:
    // this is pure bookkeeping, never required.
    topic_id: body.topic_id || null,
  };
  const validation = validateSeriesInput(input);
  if (!validation.ok) return c.json({ error: 'validation_error', errors: validation.errors }, 400);

  let template = null;
  if (input.template_id) {
    template = await getTemplateForUser(c.env, user.id, input.template_id);
    if (!template) return c.json({ error: 'template_not_found' }, 404);
  }

  // Ownership-scoped, same as every other cross-resource reference in this
  // codebase — without the user_id check a caller could stamp their series
  // (and every content item it generates) with someone else's project id.
  if (input.project_id) {
    const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .bind(input.project_id, user.id).first();
    if (!project) return c.json({ error: 'project_not_found' }, 404);
  }

  const snapshot = await createBrandContextSnapshot(c.env, user.id, input.brand_profile_id);
  const slots = resolveSlots(template);
  const platforms = resolvePlatforms(template, input.platforms);
  const cadenceDays = input.cadence_days || 1;
  const startDate = input.start_date || Date.now();

  // What this business has already published/planned, so the new batch takes
  // fresh angles instead of rewriting the same posts. Scoped to the project
  // when there is one (that's the boundary the user filters by everywhere
  // else); otherwise to the user's own unassigned content, so the two don't
  // bleed into each other. Hooks only — they carry the angle, and captions
  // would bloat the prompt for no extra signal.
  //
  // `project_id IS ?` (not `= ?`) so a NULL binding means "the unassigned
  // ones" rather than the never-true `= NULL`. Verified against the real D1
  // binding layer, not just the node:sqlite test shim: bound with JS null it
  // returns exactly the NULL-project rows, where `= ?` returns none.
  // `input.project_id` is normalised to `string | null` above and
  // validateSeriesInput rejects other types — D1 throws D1_TYPE_ERROR on
  // `undefined`.
  //
  // buildSeriesPrompt sanitises and caps these before they reach the model;
  // this LIMIT only keeps the read itself bounded.
  // Archived items are excluded: archiving is how a user throws a post away,
  // so treating it as "already covered" would permanently block that angle
  // from ever being written again. Rejected items are deliberately still
  // counted — those are angles the user wants reworked, not abandoned, and
  // regenerating the same one is exactly what they'd be complaining about.
  const existingHookRows = await c.env.DB.prepare(`
    SELECT hook FROM content_items
    WHERE user_id = ? AND hook != '' AND project_id IS ? AND status != 'archived'
    ORDER BY created_at DESC
    LIMIT ${MAX_EXISTING_HOOKS}
  `).bind(user.id, input.project_id).all<{ hook: string }>();
  const existingHooks = (existingHookRows.results || []).map((r) => r.hook).filter(Boolean);

  const seriesId = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO content_series (
      id, user_id, project_id, template_id, brand_profile_id, brand_snapshot_id, topic,
      requested_count, cadence_days, start_date, platforms_json, status,
      generated_count, credits_used, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating', 0, 0, ?, ?)
  `).bind(
    seriesId,
    user.id,
    input.project_id,
    input.template_id,
    input.brand_profile_id,
    snapshot.id,
    input.topic,
    input.requested_count,
    cadenceDays,
    startDate,
    JSON.stringify(platforms),
    now,
    now,
  ).run();

  // Reserve-then-reconcile credit flow (same pattern as the wizard's
  // step-generation route in index.ts): estimate up front, refund/true-up
  // after we know the real MiniMax usage.
  const estReserve = Math.max(1, Math.ceil(input.requested_count * 8));
  const reservation = await deductCredits(c.env, user.id, estReserve, 'content_series_reserve', seriesId);
  if (!reservation.ok) {
    await c.env.DB.prepare(`UPDATE content_series SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`)
      .bind('insufficient_credits', Date.now(), seriesId).run();
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: estReserve }, 402);
  }

  let generation;
  try {
    generation = await callSeriesGeneration(c.env, {
      topic: input.topic,
      count: input.requested_count,
      slots,
      platforms,
      brandSnapshot: snapshot.snapshot,
      existingHooks,
    });
  } catch (err: any) {
    const refund = await addCredits(c.env, user.id, estReserve, 'content_series_refund', { referenceId: seriesId, note: 'generation failed' });
    await c.env.DB.prepare(`UPDATE content_series SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`)
      .bind(String(err.message || err).slice(0, 500), Date.now(), seriesId).run();
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  // Second pass: real art direction for each post's image, from its copy.
  // Never throws — the copy above is already generated and paid for, so a
  // failure here degrades each affected post to the copy pass's own one-line
  // visual_suggestion rather than losing the series.
  const wantedItems = generation.items.slice(0, input.requested_count);
  // `generation.items` is unvalidated model output, so an element can be null
  // even though the type says otherwise. Optional-chain it: an unguarded throw
  // here would land BEFORE the true-up below and cost the user the entire
  // reservation, where the same bad item previously only broke the insert loop
  // after the refund had already run.
  const visual = await callVisualSlotGeneration(c.env, wantedItems.map((item, index) => ({
    index,
    hook: item?.hook,
    caption: item?.caption,
    cta: item?.cta,
    platform: item?.platform,
    pillar: item?.pillar,
  })));

  // Charged as part of the same series, so the true-up below covers both
  // passes and the user sees one credit figure for one action.
  const totalCreditsUsed = generation.creditsUsed + visual.creditsUsed;

  // True-up: refund unused reservation, or charge the (rare) overage.
  if (totalCreditsUsed < estReserve) {
    await addCredits(c.env, user.id, estReserve - totalCreditsUsed, 'content_series_refund', { referenceId: seriesId, note: 'reserved more than actual usage' });
  } else if (totalCreditsUsed > estReserve) {
    await deductCredits(c.env, user.id, totalCreditsUsed - estReserve, 'content_series_true_up', seriesId);
  }

  const createdIds: string[] = [];
  for (const [index, rawItem] of wantedItems.entries()) {
    const slotIndex = Number.isInteger(rawItem.slot_index) ? rawItem.slot_index : index;
    const slot = slots[slotIndex % slots.length] || {};
    const scheduledAt = startDate + Math.round(index * cadenceDays * 86_400_000);
    const sourceHash = await contentItemHash({ series_id: seriesId, slot_index: index, hook: rawItem.hook, caption: rawItem.caption });
    const itemId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO content_items (
        id, user_id, project_id, source_type, source_id, source_hash,
        title, platform, format, pillar, hook, caption, cta, hashtags_json,
        visual_suggestion, expected_engagement, status, metadata_json,
        series_id, series_slot_index, scheduled_at, created_at, updated_at
      )
      VALUES (?, ?, ?, 'content_series', ?, ?, ?, ?, 'post', ?, ?, ?, ?, ?, ?, '', 'pending_review', ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      user.id,
      // Inherit the series' project so these items are scoped the same way
      // Project Step 5 items already are. Was hardcoded NULL, which is what
      // made /works and /calendar mix every project together.
      input.project_id,
      seriesId,
      sourceHash,
      String(rawItem.hook || rawItem.caption || `${input.topic} #${index + 1}`).slice(0, 160),
      String(rawItem.platform || platforms[index % platforms.length] || '').toLowerCase(),
      String(rawItem.pillar || slot.pillar || '').toLowerCase(),
      String(rawItem.hook || ''),
      String(rawItem.caption || ''),
      String(rawItem.cta || ''),
      JSON.stringify(Array.isArray(rawItem.hashtags) ? rawItem.hashtags : []),
      visual.prompts.get(index) || String(rawItem.visual_suggestion || ''),
      JSON.stringify({
        series_id: seriesId,
        slot_index: index,
        // `slot` above was already picked via `slotIndex` (the model's own
        // reported slot_index, falling back to array position). Resolving
        // the framework from that same `slot.pillar` but against `index`
        // (plain array position) mixes two different index bases: whenever
        // the model returns items out of slot_index order, this would
        // compute a framework for a *different* rotation position than the
        // one `slot.pillar` was actually selected for, storing a framework
        // in metadata_json that neither matches the prompt's instruction nor
        // the pillar it's paired with. Use `slotIndex` here too so both
        // halves of this lookup agree.
        slot: { ...slot, framework: resolveFramework(slot.pillar, slotIndex, slot.framework) },
        headline_angles: Array.isArray(rawItem.headline_angles) ? rawItem.headline_angles : [],
      }),
      seriesId,
      index,
      scheduledAt,
      now,
      now,
    ).run();
    createdIds.push(itemId);
  }

  // MiniMax is instructed to return exactly requested_count items, but never
  // trust that blindly — if it returns fewer, the series is genuinely
  // incomplete and must not be reported as a plain "completed" success.
  const finalStatus = createdIds.length < input.requested_count ? 'partial' : 'completed';
  await c.env.DB.prepare(`
    UPDATE content_series
    SET status = ?, generated_count = ?, credits_used = ?, updated_at = ?
    WHERE id = ?
  `).bind(finalStatus, createdIds.length, totalCreditsUsed, Date.now(), seriesId).run();

  if (input.topic_id) {
    try {
      await c.env.DB.prepare(`
        UPDATE content_topics SET status = 'used', used_series_id = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(seriesId, Date.now(), input.topic_id, user.id).run();
    } catch (err) {
      console.error('Failed to mark content_topics as used (non-fatal):', err);
    }
  }

  const series = await c.env.DB.prepare('SELECT * FROM content_series WHERE id = ?').bind(seriesId).first<ContentSeriesRow>();
  const items = await c.env.DB.prepare(`
    SELECT * FROM content_items WHERE id IN (${createdIds.map(() => '?').join(',')})
    ORDER BY series_slot_index ASC
  `).bind(...createdIds).all<any>();
  return c.json({
    series: serializeSeries(series!),
    items: (items.results || []).map((row: any) => ({
      ...row,
      hashtags: parseJsonBody(row.hashtags_json, []),
      metadata: parseJsonBody(row.metadata_json, {}),
      hashtags_json: undefined,
      metadata_json: undefined,
    })),
  }, 201);
});

// =====================================================
// Sales post — ขั้นที่ 5, a deliberately separate flow from the pillar/
// framework generator above: ONE post, ONE MiniMax call, no batch/series row,
// because a sales post's facts (price/promo/guarantee/channel) are supplied
// by the caller and must never be invented — see salesPost.ts's doc comment.
// =====================================================

contentSeriesRoutes.post('/api/content-series/sales-post', async (c) => {
  const user = getUser(c)!;
  // The body is untrusted JSON, not yet a `SalesPostInput` — validate types
  // and lengths BEFORE calling .trim()/.toLowerCase() on anything. A
  // hand-rolled client sending e.g. `price: 100` (a number) instead of a
  // string used to throw inside `.trim()` here and escape as a raw 500 from
  // the global error handler, the same class of gap `validateSeriesInput`'s
  // `project_id_must_be_string` check exists to close for the sibling route.
  const body = await c.req.json<Record<string, unknown>>();
  const validation = validateSalesPostInput(body);
  if (!validation.ok) return c.json({ error: 'validation_error', errors: validation.errors }, 400);

  const input: SalesPostInput = {
    topic: (body.topic as string).trim(),
    price: (body.price as string | undefined)?.trim() || undefined,
    promo: (body.promo as string | undefined)?.trim() || undefined,
    guarantee: (body.guarantee as string | undefined)?.trim() || undefined,
    channel: (body.channel as string | undefined)?.trim() || undefined,
    social_proof: (body.social_proof as string | undefined)?.trim() || undefined,
  };

  const projectId = (body.project_id as string | null | undefined) || null;
  if (projectId) {
    const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .bind(projectId, user.id).first();
    if (!project) return c.json({ error: 'project_not_found' }, 404);
  }

  const platform = ((body.platform as string | undefined) || 'facebook').toLowerCase();
  const brandProfileId = (body.brand_profile_id as string | null | undefined) ?? undefined;
  const brandSnapshot = await getBrandSnapshotObject(c.env, user.id, brandProfileId);
  const brandContextBlock = formatBrandContextBlock(brandSnapshot);
  const personaComplaints = (brandSnapshot as any)?.persona?.complaints;
  const { system, user: userPrompt } = buildSalesPostPrompt({ input, platform, brandContextBlock, personaComplaints });

  const toolRunId = generateId();
  // Measured live, not guessed: MiniMax-M3 spends an unbounded, highly
  // variable amount of this budget on internal reasoning before writing any
  // content at all (same instability documented at contentSeries.ts's
  // MAX_SERIES_COUNT) — observed reasoning alone running anywhere from ~1k to
  // over 16k characters across otherwise-identical calls to this route, well
  // past contentSeries.ts's own proven-safe 6900 for its hardest case (a full
  // 7-post batch). A single but rule-dense 15-block post apparently invites
  // more of this reasoning than a short single-pillar post does. This is not
  // fully eliminable by raising the ceiling further — it's an inherent
  // MiniMax-M3 trait already accepted elsewhere in this codebase rather than
  // solved — so the real safety net is the refund path below, not this
  // number; this value is sized generously against what's been observed, not
  // as a guarantee.
  const maxTokens = 14000;
  const estPromptTokens = Math.ceil((system.length + userPrompt.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxTokens });
  const reservation = await deductCredits(c.env, user.id, reserveCredits, 'sales_post_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result;
  let parsed: any;
  try {
    result = await callMinimax(
      { apiKey: c.env.MINIMAX_API_KEY, groupId: c.env.MINIMAX_GROUP_ID, model: c.env.MINIMAX_MODEL },
      [
        { role: 'system', content: system + '\n\n🚫 ห้าม reasoning หรือคิดออกเสียง — ตอบ JSON object เท่านั้นใน content field' },
        { role: 'user', content: userPrompt + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น ไม่ต้องคิดออกเสียง ไม่ต้องอธิบาย]' },
      ],
      { maxTokens, temperature: 0.8, jsonMode: true },
    );
    // extractJsonFromAny throws when it can't find a JSON object in either
    // field — must stay inside this try, or a parse failure would escape to
    // the global error handler with the reservation above never refunded
    // (the exact bug caught live-testing this route: a genuinely malformed
    // model response left the user's credits deducted with nothing to show
    // for it).
    parsed = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    await addCredits(c.env, user.id, reserveCredits, 'sales_post_refund', { referenceId: toolRunId, note: 'generation failed' });
    return c.json({ error: 'ai_error', message: err.message }, 500);
  }

  // Caught live-testing this route: MiniMax occasionally writes full,
  // legitimate hook/cta/visual_suggestion fields but a bare "..." for
  // caption — the one field this whole flow exists to get right. A
  // present-but-degenerate string passes `!parsed?.caption`, so guard on
  // length too rather than trusting "the field exists" as "the field is real
  // copy". 30 chars is well below any real Thai sentence, but well above a
  // stub ellipsis or a single word.
  if (!parsed?.caption || String(parsed.caption).trim().length < 30) {
    await addCredits(c.env, user.id, reserveCredits, 'sales_post_refund', { referenceId: toolRunId, note: 'empty output' });
    return c.json({ error: 'ai_error', message: 'sales_post_generation_empty_output' }, 500);
  }

  const creditsUsed = calculateCredits(result.usage);
  if (creditsUsed < reserveCredits) {
    await addCredits(c.env, user.id, reserveCredits - creditsUsed, 'sales_post_refund', { referenceId: toolRunId, note: 'reserved more than actual usage' });
  } else if (creditsUsed > reserveCredits) {
    await deductCredits(c.env, user.id, creditsUsed - reserveCredits, 'sales_post_true_up', toolRunId);
  }

  const itemId = generateId();
  const now = Date.now();
  // Everything above this point is covered by a refund path on failure (the
  // generation try/catch, then the explicit empty-output check). From here
  // the user has already been charged `creditsUsed` net (reserve minus
  // refund, or plus true-up) — an uncaught throw from the INSERT or the
  // follow-up SELECT (a D1 hiccup, a constraint violation) would otherwise
  // escape to the global error handler with that amount deducted and no
  // content_items row to show for it, the same failure mode Bug A was.
  // source_hash is derived from `toolRunId` (a fresh generateId() per
  // request), so the table's UNIQUE(user_id, project_id, source_type,
  // source_hash) constraint can't realistically collide here — the risk this
  // guards is a transient D1 error, not a duplicate key.
  try {
    const sourceHash = await contentItemHash({ topic: input.topic, tool_run_id: toolRunId });
    await c.env.DB.prepare(`
      INSERT INTO content_items (
        id, user_id, project_id, source_type, source_id, source_hash,
        title, platform, format, pillar, hook, caption, cta, hashtags_json,
        visual_suggestion, expected_engagement, status, metadata_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'sales_post', ?, ?, ?, ?, 'post', 'conversion', ?, ?, ?, ?, ?, '', 'pending_review', ?, ?, ?)
    `).bind(
      itemId,
      user.id,
      projectId,
      toolRunId,
      sourceHash,
      String(parsed.hook || input.topic).slice(0, 160),
      platform,
      String(parsed.hook || ''),
      String(parsed.caption || ''),
      String(parsed.cta || ''),
      JSON.stringify(Array.isArray(parsed.hashtags) ? parsed.hashtags : []),
      String(parsed.visual_suggestion || ''),
      JSON.stringify({ sales_post: true, input, included_blocks: resolveIncludedBlocks(input).map((b) => b.label) }),
      now,
      now,
    ).run();

    const row = await c.env.DB.prepare('SELECT * FROM content_items WHERE id = ?').bind(itemId).first<any>();
    return c.json({
      item: {
        ...row,
        hashtags: parseJsonBody(row.hashtags_json, []),
        metadata: parseJsonBody(row.metadata_json, {}),
        hashtags_json: undefined,
        metadata_json: undefined,
      },
      credits_used: creditsUsed,
    }, 201);
  } catch (err: any) {
    await addCredits(c.env, user.id, creditsUsed, 'sales_post_refund', { referenceId: toolRunId, note: 'persist failed' });
    return c.json({ error: 'db_error', message: err.message }, 500);
  }
});

export default contentSeriesRoutes;
