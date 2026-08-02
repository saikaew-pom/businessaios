import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { getUser, requireAuth, requireAdmin } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';
import { addCredits, deductCredits } from './lib/credit';
import { createBrandContextSnapshot } from './lib/creative/brandContext';
import {
  callSeriesGeneration,
  getTemplateForUser,
  getVisibleTemplates,
  resolvePlatforms,
  resolveSlots,
  serializeSeries,
  serializeSeriesTemplate,
  validateSeriesInput,
  type ContentSeriesRow,
  type ContentSeriesTemplateRow,
} from './lib/creative/contentSeries';

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
    platforms?: string[];
  }>();

  const input = {
    topic: body.topic?.trim() || '',
    requested_count: Number(body.requested_count),
    cadence_days: body.cadence_days,
    start_date: body.start_date,
    template_id: body.template_id || null,
    brand_profile_id: body.brand_profile_id || null,
    platforms: body.platforms,
  };
  const validation = validateSeriesInput(input);
  if (!validation.ok) return c.json({ error: 'validation_error', errors: validation.errors }, 400);

  let template = null;
  if (input.template_id) {
    template = await getTemplateForUser(c.env, user.id, input.template_id);
    if (!template) return c.json({ error: 'template_not_found' }, 404);
  }

  const snapshot = await createBrandContextSnapshot(c.env, user.id, input.brand_profile_id);
  const slots = resolveSlots(template);
  const platforms = resolvePlatforms(template, input.platforms);
  const cadenceDays = input.cadence_days || 1;
  const startDate = input.start_date || Date.now();

  const seriesId = generateId();
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO content_series (
      id, user_id, template_id, brand_profile_id, brand_snapshot_id, topic,
      requested_count, cadence_days, start_date, platforms_json, status,
      generated_count, credits_used, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating', 0, 0, ?, ?)
  `).bind(
    seriesId,
    user.id,
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
    });
  } catch (err: any) {
    const refund = await addCredits(c.env, user.id, estReserve, 'content_series_refund', { referenceId: seriesId, note: 'generation failed' });
    await c.env.DB.prepare(`UPDATE content_series SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`)
      .bind(String(err.message || err).slice(0, 500), Date.now(), seriesId).run();
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  // True-up: refund unused reservation, or charge the (rare) overage.
  if (generation.creditsUsed < estReserve) {
    await addCredits(c.env, user.id, estReserve - generation.creditsUsed, 'content_series_refund', { referenceId: seriesId, note: 'reserved more than actual usage' });
  } else if (generation.creditsUsed > estReserve) {
    await deductCredits(c.env, user.id, generation.creditsUsed - estReserve, 'content_series_true_up', seriesId);
  }

  const createdIds: string[] = [];
  for (const [index, rawItem] of generation.items.slice(0, input.requested_count).entries()) {
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
      VALUES (?, ?, NULL, 'content_series', ?, ?, ?, ?, 'post', ?, ?, ?, ?, ?, ?, '', 'pending_review', ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      user.id,
      seriesId,
      sourceHash,
      String(rawItem.hook || rawItem.caption || `${input.topic} #${index + 1}`).slice(0, 160),
      String(rawItem.platform || platforms[index % platforms.length] || '').toLowerCase(),
      String(rawItem.pillar || slot.pillar || '').toLowerCase(),
      String(rawItem.hook || ''),
      String(rawItem.caption || ''),
      String(rawItem.cta || ''),
      JSON.stringify(Array.isArray(rawItem.hashtags) ? rawItem.hashtags : []),
      String(rawItem.visual_suggestion || ''),
      JSON.stringify({ series_id: seriesId, slot_index: index, slot }),
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
  `).bind(finalStatus, createdIds.length, generation.creditsUsed, Date.now(), seriesId).run();

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

export default contentSeriesRoutes;
