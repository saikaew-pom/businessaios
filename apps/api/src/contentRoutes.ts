import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { calculateCredits, deductCredits, addCredits } from './lib/credit';
import { callMinimax, estimateCost, extractJsonFromAny } from './lib/minimax';
import { assembleVisualPrompt, buildVisualSlotPrompt, type VisualSlots } from './lib/creative/visualPrompt';
import { formatBrandContextBlock, getBrandSnapshotObject } from './lib/creative/brandContext';
import { getUser, requireAuth } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';

const contentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

contentRoutes.use('/api/content-items', requireAuth, requireEmbeddedFeature);
contentRoutes.use('/api/content-items/*', requireAuth, requireEmbeddedFeature);
contentRoutes.use('/api/projects/:id/content-items/*', requireAuth, requireEmbeddedFeature);
contentRoutes.use('/api/creative-requests/*', requireAuth, requireEmbeddedFeature);

contentRoutes.get('/api/content-items', async (c) => {
  const user = getUser(c)!;
  const status = c.req.query('status') || '';
  const projectId = c.req.query('project_id') || '';
  // scheduled_from/scheduled_to (ms epoch, inclusive/exclusive) let the
  // content calendar ask for exactly one visible month at a time instead of
  // relying on the 100-row cap, which would silently drop items once a user
  // has more than 100 scheduled items in their history.
  const scheduledFrom = Number(c.req.query('scheduled_from') || 0);
  const scheduledTo = Number(c.req.query('scheduled_to') || 0);
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 50)));
  const conditions = ['ci.user_id = ?'];
  const values: unknown[] = [user.id];
  if (status) {
    conditions.push('ci.status = ?');
    values.push(status);
  }
  if (projectId) {
    conditions.push('ci.project_id = ?');
    values.push(projectId);
  }
  if (Number.isFinite(scheduledFrom) && scheduledFrom > 0) {
    conditions.push('ci.scheduled_at >= ?');
    values.push(scheduledFrom);
  }
  if (Number.isFinite(scheduledTo) && scheduledTo > 0) {
    conditions.push('ci.scheduled_at < ?');
    values.push(scheduledTo);
  }
  values.push(limit);

  const rows = await c.env.DB.prepare(`
    SELECT ci.*, p.name as project_name,
      (
        SELECT al.asset_id FROM asset_links al
        WHERE al.content_item_id = ci.id AND al.is_primary = 1
        ORDER BY al.version DESC LIMIT 1
      ) as primary_asset_id
    FROM content_items ci
    LEFT JOIN projects p ON p.id = ci.project_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY COALESCE(ci.scheduled_at, ci.updated_at) ASC, ci.created_at DESC
    LIMIT ?
  `).bind(...values).all<any>();

  return c.json({ items: (rows.results || []).map(serializeContentItem) });
});

// Single-item lookup, ownership-scoped. Needed because a "focus" deep link
// (e.g. Works' "ส่งไป Calendar" button linking to /calendar?focus=<id>) can
// point at an item scheduled outside whatever month-range the calendar's
// list query currently covers, so the calendar can't rely on finding it in
// an already-fetched list the way /works and /inbox do.
contentRoutes.get('/api/content-items/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT ci.*, p.name as project_name,
      (
        SELECT al.asset_id FROM asset_links al
        WHERE al.content_item_id = ci.id AND al.is_primary = 1
        ORDER BY al.version DESC LIMIT 1
      ) as primary_asset_id
    FROM content_items ci
    LEFT JOIN projects p ON p.id = ci.project_id
    WHERE ci.id = ? AND ci.user_id = ?
  `).bind(id, user.id).first<any>();
  if (!row) return c.json({ error: 'content_item_not_found' }, 404);
  return c.json({ item: serializeContentItem(row) });
});

contentRoutes.post('/api/projects/:id/content-items/materialize-step5', async (c) => {
  const user = getUser(c)!;
  const projectId = c.req.param('id');
  const project = await c.env.DB.prepare('SELECT id, user_id, step_data FROM projects WHERE id = ? AND user_id = ?')
    .bind(projectId, user.id).first<{ id: string; user_id: string; step_data: string }>();
  if (!project) return c.json({ error: 'project_not_found' }, 404);

  const stepData = parseJson(project.step_data, {});
  const calendar = extractCalendar(stepData);
  if (!calendar.length) return c.json({ materialized: 0, items: [] });

  const now = Date.now();
  const items = [];
  for (const [index, post] of calendar.entries()) {
    const sourceHash = await contentHash({
      project_id: projectId,
      step: 5,
      day: post.day ?? null,
      platform: post.platform ?? null,
      format: post.format ?? null,
      hook: post.hook ?? null,
      caption: post.caption ?? null,
    });
    const existing = await c.env.DB.prepare(`
      SELECT id FROM content_items
      WHERE user_id = ? AND project_id = ? AND source_type = 'project_step5_calendar' AND source_hash = ?
    `).bind(user.id, projectId, sourceHash).first<{ id: string }>();
    const title = String(post.hook || post.caption || `Content ${index + 1}`).slice(0, 160);
    if (existing) {
      await c.env.DB.prepare(`
        UPDATE content_items
        SET title = ?, platform = ?, format = ?, pillar = ?, hook = ?, caption = ?,
            cta = ?, hashtags_json = ?, visual_suggestion = ?, expected_engagement = ?,
            metadata_json = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        title,
        String(post.platform || '').toLowerCase(),
        String(post.format || '').toLowerCase(),
        String(post.pillar || '').toLowerCase(),
        String(post.hook || ''),
        String(post.caption || ''),
        String(post.cta || ''),
        JSON.stringify(Array.isArray(post.hashtags) ? post.hashtags : []),
        String(post.visual_suggestion || ''),
        String(post.expected_engagement || ''),
        JSON.stringify({ day: post.day ?? index + 1, source_index: index, original_post: post }),
        now,
        existing.id,
        user.id,
      ).run();
      items.push(existing.id);
    } else {
      const id = generateId();
      await c.env.DB.prepare(`
        INSERT INTO content_items (
          id, user_id, project_id, source_type, source_id, source_hash,
          title, platform, format, pillar, hook, caption, cta, hashtags_json,
          visual_suggestion, expected_engagement, status, metadata_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, 'project_step5_calendar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?)
      `).bind(
        id,
        user.id,
        projectId,
        projectId,
        sourceHash,
        title,
        String(post.platform || '').toLowerCase(),
        String(post.format || '').toLowerCase(),
        String(post.pillar || '').toLowerCase(),
        String(post.hook || ''),
        String(post.caption || ''),
        String(post.cta || ''),
        JSON.stringify(Array.isArray(post.hashtags) ? post.hashtags : []),
        String(post.visual_suggestion || ''),
        String(post.expected_engagement || ''),
        JSON.stringify({ day: post.day ?? index + 1, source_index: index, original_post: post }),
        now,
        now,
      ).run();
      await logContentEvent(c.env, user.id, projectId, id, user.id, 'materialized', null, 'pending_review', null, { source: 'step5' });
      items.push(id);
    }
  }
  const result = await listContentItemsByIds(c.env, user.id, items);
  return c.json({ materialized: items.length, items: result.map(serializeContentItem) });
});

contentRoutes.post('/api/content-items/:id/transition', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const body = await c.req.json<{
    action?: string;
    reason?: string;
    scheduled_at?: number | null;
    timezone?: string;
    manual_publish_url?: string;
  }>();
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);

  const now = Date.now();
  const action = body.action || '';
  const update: Record<string, unknown> = { updated_at: now };
  let toStatus = item.status;
  if (action === 'approve') {
    if (!['draft', 'pending_review', 'rejected'].includes(item.status)) return c.json({ error: 'invalid_transition' }, 409);
    toStatus = 'approved';
    update.approved_at = now;
    update.approved_by = user.id;
  } else if (action === 'reject') {
    if (!['draft', 'pending_review', 'approved'].includes(item.status)) return c.json({ error: 'invalid_transition' }, 409);
    toStatus = 'rejected';
    update.rejected_at = now;
    update.rejected_by = user.id;
    update.rejection_reason = (body.reason || '').slice(0, 500);
  } else if (action === 'schedule') {
    if (item.status !== 'approved') return c.json({ error: 'approval_required' }, 409);
    const scheduledAt = Number(body.scheduled_at || 0);
    if (!Number.isFinite(scheduledAt) || scheduledAt <= now) return c.json({ error: 'invalid_schedule_time' }, 400);
    toStatus = 'scheduled';
    update.scheduled_at = scheduledAt;
    update.timezone = (body.timezone || 'Asia/Bangkok').slice(0, 80);
  } else if (action === 'unschedule') {
    if (item.status !== 'scheduled') return c.json({ error: 'invalid_transition' }, 409);
    toStatus = 'approved';
    update.scheduled_at = null;
    update.timezone = null;
  } else if (action === 'reschedule') {
    // Move an already-scheduled item to a new date, or schedule an approved
    // item — without forcing an unschedule→schedule round trip. This is what
    // the content calendar's drag-to-move and "send to calendar" both call.
    if (!['approved', 'scheduled'].includes(item.status)) return c.json({ error: 'approval_required' }, 409);
    const scheduledAt = Number(body.scheduled_at || 0);
    if (!Number.isFinite(scheduledAt) || scheduledAt <= now) return c.json({ error: 'invalid_schedule_time' }, 400);
    toStatus = 'scheduled';
    update.scheduled_at = scheduledAt;
    update.timezone = (body.timezone || item.timezone || 'Asia/Bangkok').slice(0, 80);
  } else if (action === 'revert_to_draft') {
    // Pull a piece back into editing. Reachable from any non-terminal review
    // state (published/archived are terminal). Clears every downstream state
    // marker — approval, rejection, and any schedule — so the item is a clean
    // draft again, not an "approved-but-actually-draft" hybrid.
    if (!['pending_review', 'approved', 'scheduled', 'rejected'].includes(item.status)) {
      return c.json({ error: 'invalid_transition' }, 409);
    }
    toStatus = 'draft';
    update.scheduled_at = null;
    update.timezone = null;
    update.approved_at = null;
    update.approved_by = null;
    update.rejected_at = null;
    update.rejected_by = null;
    update.rejection_reason = null;
  } else if (action === 'manual_publish_ack') {
    if (!['approved', 'scheduled'].includes(item.status)) return c.json({ error: 'approval_required' }, 409);
    toStatus = 'published';
    update.published_ack_at = now;
    update.published_ack_by = user.id;
    update.manual_publish_url = (body.manual_publish_url || '').slice(0, 500);
  } else if (action === 'archive') {
    toStatus = 'archived';
    update.archived_at = now;
  } else {
    return c.json({ error: 'unknown_action' }, 400);
  }

  update.status = toStatus;
  await updateContentItem(c.env, user.id, id, update);
  await logContentEvent(c.env, user.id, item.project_id, id, user.id, action, item.status, toStatus, body.reason || null, {
    scheduled_at: body.scheduled_at,
    manual_publish_url: body.manual_publish_url ? '[provided]' : undefined,
  });
  return c.json({ item: serializeContentItem((await getContentItem(c.env, user.id, id))!) });
});

// Edit a content item's authored fields (title/caption/hook/etc). Status,
// ownership, scheduling, and provenance are deliberately NOT editable here —
// those move only through /transition, so a stray PATCH can never smuggle an
// item into 'approved' or reassign it to another user. Free (no credits).
const EDITABLE_TEXT_FIELDS = ['title', 'platform', 'format', 'pillar', 'hook', 'caption', 'cta', 'visual_suggestion', 'expected_engagement'] as const;

contentRoutes.patch('/api/content-items/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);

  const parsed = await c.req.json<unknown>().catch(() => ({}));
  const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_TEXT_FIELDS) {
    const value = body[field];
    if (typeof value === 'string') {
      update[field] = value.slice(0, field === 'title' ? 160 : 5000);
    }
  }
  if (Array.isArray(body.hashtags)) {
    update.hashtags_json = JSON.stringify(
      body.hashtags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 120)).slice(0, 60),
    );
  }
  if (!Object.keys(update).length) return c.json({ error: 'no_editable_fields' }, 400);

  update.updated_at = Date.now();
  await updateContentItem(c.env, user.id, id, update);
  await logContentEvent(c.env, user.id, item.project_id, id, user.id, 'content_edited', item.status, item.status, null, {
    fields: Object.keys(update).filter((k) => k !== 'updated_at'),
  });
  return c.json({ item: serializeContentItem((await getContentItem(c.env, user.id, id))!) });
});

// AI-regenerate a single authored field (Hook/Caption/CTA/Hashtags/Visual
// suggestion) from the editor — the "✨" button next to each field. Unlike
// PATCH above this is a real paid MiniMax call, so it follows the same
// reserve → refund/true-up credit pattern used by
// /api/compositions/generate-copy and /api/brand-kits/:id/smart-writing.
// The item id is only used for ownership/auth scoping — the actual context
// sent to the model is whatever the client currently has in the editor
// (including unsaved edits to OTHER fields), not a re-fetch from the DB, so
// regenerating Caption after just typing a new Hook (without saving first)
// stays consistent with what the user is looking at.
const REGEN_FIELD_RULES: Record<string, string> = {
  hook: 'Hook (ประโยคเปิด/คำถามชวนคิดที่ดึงความสนใจ) 1 ประโยค ไม่เกิน 100 ตัวอักษร',
  caption: 'Caption เนื้อหาโพสต์ภาษาไทย 3-5 บรรทัด',
  cta: 'CTA (คำกระตุ้นให้ทำอะไรต่อ) 1 ประโยคสั้น ๆ ไม่เกิน 60 ตัวอักษร',
  hashtags: 'Hashtag ที่เกี่ยวข้อง 3-5 ตัว แต่ละตัวขึ้นต้นด้วย # ไม่มีช่องว่างในแต่ละแท็ก',
  visual_suggestion: 'คำอธิบายภาพประกอบ 1 บรรทัด บรรยายเฉพาะฉาก องค์ประกอบภาพ แสง สี และบรรยากาศ ห้ามระบุตัวอักษร ข้อความ ป้าย ปุ่มมีข้อความ โลโก้ หรือราคาในภาพเด็ดขาด (จะใส่หัวข้อ/CTA ทีหลังด้วยเครื่องมือแยกต่างหาก)',
};
// Content Playbook ขั้นที่ 5 — "ปุ่มป้ายยาย่อ" ("ปิดจบแบบขายเนียน ๆ"): appends
// one short soft-sell paragraph to an EXISTING post (any framework — How-to/
// เรื่องเล่า/Mindset per the plan) rather than rewriting the whole caption,
// so it gets its own prompt builder below instead of REGEN_FIELD_RULES'
// generic "rewrite this field" template. Not in REGEN_FIELD_RULES itself —
// REGEN_FIELDS below still lists it so the route's field-validity check
// accepts it.
const SALES_CLOSER_FIELD = 'sales_closer';
const REGEN_FIELDS = [...Object.keys(REGEN_FIELD_RULES), SALES_CLOSER_FIELD];

function buildSalesCloserPrompt(context: RegenerateContext, brandContextBlock: string) {
  const system = `คุณคือนักการตลาดคอนเทนต์มืออาชีพสำหรับธุรกิจไทย งานของคุณคือเขียนย่อหน้าปิดท้ายแบบขายเนียน ๆ (soft-sell) 1-2 ประโยคสั้น ๆ ต่อท้ายโพสต์ที่ให้มาด้านล่าง — ไม่ใช่เขียนโพสต์ใหม่ทั้งหมด
เขียนให้ตรงกับตัวตนแบรนด์ด้านล่าง โทน "ชวนดู/ชวนคุย" ไม่ใช่ "ยัดเยียดขาย"
⚠️ ห้ามแต่งข้อเท็จจริง (ราคา/โปรโมชั่น/การันตี) ที่ไม่มีอยู่ในโพสต์เดิม — ถ้าโพสต์เดิมไม่มีราคา/โปรอยู่แล้ว ให้ปิดด้วยคำชวนทักแชท/สอบถามทั่วไปแทน
⚠️ ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด

ตอบเป็น JSON object เท่านั้น: {"value": "..."}`;

  const user = [
    brandContextBlock,
    '',
    '# โพสต์เดิมที่จะปิดท้าย',
    context.hook ? `Hook: ${context.hook}` : '',
    context.caption ? `Caption: ${context.caption}` : '',
    context.cta ? `CTA เดิม: ${context.cta}` : '',
  ].filter(Boolean).join('\n');

  return { system, user };
}

type RegenerateContext = {
  title?: string; platform?: string; format?: string; pillar?: string;
  hook?: string; caption?: string; cta?: string; hashtags?: string[]; visual_suggestion?: string;
};

function buildRegenerateFieldPrompt(field: string, context: RegenerateContext, brandContextBlock: string, direction?: string) {
  const isArray = field === 'hashtags';
  const system = `คุณคือนักการตลาดคอนเทนต์มืออาชีพสำหรับธุรกิจไทย งานของคุณคือเขียน "${field}" ใหม่ให้กับโพสต์โซเชียลมีเดีย 1 ชิ้น ให้เข้ากับบริบทของโพสต์ทั้งหมดที่ให้มา แต่งใหม่ ไม่ใช่แค่ปรับคำเดิมเล็กน้อย
เขียนให้ตรงกับตัวตนแบรนด์และลูกค้าตัวแทนด้านล่าง ไม่ใช่เขียนแบบทั่วไปที่ใช้กับธุรกิจไหนก็ได้

กติกา: ${REGEN_FIELD_RULES[field]}
${direction ? `\n⚠️ บอกทิศจากผู้ใช้ (ต้องทำตาม): ${direction}\n` : ''}
ตอบเป็น JSON object เท่านั้น: {"value": ${isArray ? '["...", "..."]' : '"..."'}}`;

  const user = [
    brandContextBlock,
    '',
    '# โพสต์นี้',
    context.title ? `หัวข้อ: ${context.title}` : '',
    context.platform ? `Platform: ${context.platform}` : '',
    context.format ? `Format: ${context.format}` : '',
    context.pillar ? `Pillar: ${context.pillar}` : '',
    field !== 'hook' && context.hook ? `Hook ปัจจุบัน: ${context.hook}` : '',
    field !== 'caption' && context.caption ? `Caption ปัจจุบัน: ${context.caption}` : '',
    field !== 'cta' && context.cta ? `CTA ปัจจุบัน: ${context.cta}` : '',
    field !== 'visual_suggestion' && context.visual_suggestion ? `Visual suggestion ปัจจุบัน: ${context.visual_suggestion}` : '',
    field !== 'hashtags' && context.hashtags?.length ? `Hashtags ปัจจุบัน: ${context.hashtags.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return { system, user };
}

contentRoutes.post('/api/content-items/:id/regenerate-field', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);

  const account = await c.env.DB.prepare('SELECT email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number }>();
  if (account && account.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const body: { field?: string; context?: RegenerateContext; direction?: string } = await c.req.json<{ field?: string; context?: RegenerateContext; direction?: string }>().catch(() => ({}));
  const field = body.field || '';
  if (!REGEN_FIELDS.includes(field)) {
    return c.json({ error: 'validation_error', message: 'field ไม่ถูกต้อง', errors: ['invalid_field'] }, 400);
  }
  const context: RegenerateContext = body.context && typeof body.context === 'object' ? body.context : {};
  // Content Playbook ขั้นที่ 6 "✨ บอกทิศ" — a short tone/emotion steer, not
  // free-form prose (matches the plan's own "ตัด 8 มิติเต็มทิ้ง" intent: a
  // couple of enumerated chip labels joined together, never a paragraph).
  const direction = typeof body.direction === 'string' ? body.direction.trim().slice(0, 100) : undefined;

  // The bug this fixes: this call used to know nothing about the brand at
  // all, so the model wrote generic copy with no identity behind it. Resolve
  // the item's own series → brand profile first (what it was actually
  // generated with); fall back to the user's active profile if the item has
  // no series or the series has no brand profile attached.
  let brandProfileId: string | null = null;
  if (item.series_id) {
    const series = await c.env.DB.prepare('SELECT brand_profile_id FROM content_series WHERE id = ? AND user_id = ?')
      .bind(item.series_id, user.id).first<{ brand_profile_id: string | null }>();
    brandProfileId = series?.brand_profile_id || null;
  }
  const brandSnapshot = await getBrandSnapshotObject(c.env, user.id, brandProfileId);
  const brandContextBlock = formatBrandContextBlock(brandSnapshot);

  const toolRunId = generateId();
  const startTime = Date.now();
  // visual_suggestion goes through a different pipeline than the other
  // fields: instead of asking for finished prose, it asks for structured
  // slots and assembles the art direction deterministically afterwards.
  // See lib/creative/visualPrompt.ts for why.
  const isVisual = field === 'visual_suggestion';
  const isSalesCloser = field === SALES_CLOSER_FIELD;
  const { system, user: userPrompt } = isVisual
    ? buildVisualSlotPrompt(context)
    : isSalesCloser
      ? buildSalesCloserPrompt(context, brandContextBlock)
      : buildRegenerateFieldPrompt(field, context, brandContextBlock, direction);
  // MiniMax-M3 spends tokens on an internal reasoning trace before writing
  // the final answer, and the reasoning length is NOT proportional to how
  // small the final answer is — 2000 was tried first and still truncated
  // (finish_reason: 'length', reasoningLength: 3542, empty content) on a
  // live test with this exact route. 12000 matches the budget already
  // proven reliable elsewhere in this codebase for the same reasoning-model
  // behavior (toolRoutes.ts). Only the actual tokens used are billed — this
  // just raises the ceiling the reserve is calculated against, refunded down
  // to real usage afterward.
  const maxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + userPrompt.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxTokens });
  const reservation = await deductCredits(c.env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  try {
    result = await callMinimax(
      { apiKey: c.env.MINIMAX_API_KEY, groupId: c.env.MINIMAX_GROUP_ID, model: c.env.MINIMAX_MODEL },
      [
        { role: 'system', content: system },
        { role: 'user', content: `${userPrompt}\n\nตอบเป็น JSON object เท่านั้น ห้าม markdown ห้ามคำอธิบายเพิ่ม` },
      ],
      { maxTokens, temperature: 0.85, jsonMode: true },
    );
  } catch (err: any) {
    console.error('Regenerate field error:', err);
    const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: 'สร้างเนื้อหาไม่สำเร็จ', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let parsed: { value?: unknown };
  try {
    parsed = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    console.error('Regenerate field parse error:', err);
    const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({ error: 'parse_error', message: 'AI ตอบกลับไม่ถูกต้อง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let value: string | string[];
  if (isVisual) {
    // The model returns slots, not the finished string — assembling here is
    // what makes the output good regardless of how well the model writes.
    // Every slot falls back to a default inside assembleVisualPrompt, so the
    // only genuinely unusable response is one that isn't an object at all.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned wrong slot shape' });
      return c.json({ error: 'parse_error', message: 'AI ตอบกลับไม่ถูกต้อง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
    }
    value = assembleVisualPrompt(parsed as Partial<VisualSlots>);
  } else if (field === 'hashtags') {
    const arr = Array.isArray(parsed.value) ? parsed.value : [];
    value = arr.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean).slice(0, 8);
    if (!value.length) {
      const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned empty hashtags' });
      return c.json({ error: 'parse_error', message: 'AI ไม่ได้ส่ง hashtags กลับมา', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
    }
  } else {
    // parsed.value must actually be a string here — a reasoning model in
    // JSON mode can drift from the requested shape (e.g. hand back an array
    // or object for a scalar field). String(parsed.value) would silently
    // turn an array into a comma-joined mess ("a,b") or an object into
    // "[object Object]" and save that as if it were valid copy, instead of
    // rejecting like the hashtags branch above already does for its own
    // shape mismatch (string instead of array). Require the right type
    // before coercing so both shapes fail the same way: cleanly refunded,
    // not silently corrupted.
    if (typeof parsed.value !== 'string') {
      const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned wrong value type' });
      return c.json({ error: 'parse_error', message: 'AI ตอบกลับไม่ถูกต้อง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
    }
    value = parsed.value.trim().slice(0, field === 'caption' ? 2000 : 300);
    if (!value) {
      const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned empty value' });
      return c.json({ error: 'parse_error', message: 'AI ไม่ได้ส่งข้อความกลับมา', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
    }
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'content_item_regenerate_field',
      JSON.stringify({ content_item_id: id, field }),
      JSON.stringify({ value }),
      c.env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0,
      result.usage?.completion_tokens || 0,
      result.usage?.total_tokens || 0,
      estimateCost(result.usage),
      Date.now() - startTime,
      Date.now(),
    ).run();
  } catch (err) {
    console.error('Failed to save regenerate-field tool_run (non-fatal):', err);
  }

  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(c.env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(c.env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

  return c.json({ ok: true, field, value, credits_remaining: finalBalance });
});

// Content Playbook ขั้นที่ 6 — "ปุ่ม ตรวจ 60 วิ": AI checks only the 4 items
// the plan itself says are actually checkable by a model (พาดหัว 1 ไอเดีย /
// CTA เดียว / คำเคลม trace ถึงข้อมูลโปรไฟล์ / ตรงเสียงแบรนด์) — the other 2
// of the checklist's 6 items (อ่านออกเสียงลื่นไหม, โปร/ราคาเป็นเรื่องจริงไหม)
// are plain reminder text in the frontend, never sent here, since no model
// can verify "is this promo real" or "does this sound natural out loud."
export const CHECKLIST_KEYS = ['headline_one_idea', 'single_cta', 'claims_grounded', 'brand_voice_match'] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

function buildChecklistPrompt(context: RegenerateContext, brandContextBlock: string) {
  const system = `คุณคือบรรณาธิการที่ตรวจโพสต์โซเชียลมีเดียก่อนเผยแพร่ให้ธุรกิจไทย ตรวจ 4 ข้อนี้เท่านั้นแบบตรงไปตรงมา ไม่ต้องชม ไม่ต้องแนะนำเพิ่มถ้าผ่านแล้ว
1. headline_one_idea: ประโยคเปิด (hook) พูดถึงไอเดียเดียว ไม่ยัดหลายประเด็นจนสับสน
2. single_cta: มีคำชวนทำอะไรต่อ (CTA) ทางเดียวชัดเจน ไม่ชวนทำหลายอย่างพร้อมกัน
3. claims_grounded: ข้อมูล/คำเคลมทุกอย่างในโพสต์ (ราคา ตัวเลข คุณสมบัติ) ต้องตรงกับข้อมูลแบรนด์ที่ให้มาเท่านั้น — ถ้าโพสต์อ้างอะไรที่ไม่มีในข้อมูลแบรนด์เลย ถือว่าไม่ผ่าน
4. brand_voice_match: โทนของโพสต์ตรงกับโทนเสียงแบรนด์ที่ให้มา

ตอบเป็น JSON object เท่านั้น รูปแบบนี้เป๊ะ ๆ:
{"headline_one_idea": {"pass": true, "note": "เหตุผลสั้น ๆ 1 ประโยค"}, "single_cta": {"pass": true, "note": "..."}, "claims_grounded": {"pass": true, "note": "..."}, "brand_voice_match": {"pass": true, "note": "..."}}`;

  const user = [
    brandContextBlock,
    '',
    '# โพสต์ที่จะตรวจ',
    context.hook ? `Hook: ${context.hook}` : '',
    context.caption ? `Caption: ${context.caption}` : '',
    context.cta ? `CTA: ${context.cta}` : '',
  ].filter(Boolean).join('\n');

  return { system, user };
}

contentRoutes.post('/api/content-items/:id/checklist-check', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);

  const account = await c.env.DB.prepare('SELECT email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number }>();
  if (account && account.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const body: { context?: RegenerateContext } = await c.req.json<{ context?: RegenerateContext }>().catch(() => ({}));
  const context: RegenerateContext = body.context && typeof body.context === 'object' ? body.context : {};

  let brandProfileId: string | null = null;
  if (item.series_id) {
    const series = await c.env.DB.prepare('SELECT brand_profile_id FROM content_series WHERE id = ? AND user_id = ?')
      .bind(item.series_id, user.id).first<{ brand_profile_id: string | null }>();
    brandProfileId = series?.brand_profile_id || null;
  }
  const brandSnapshot = await getBrandSnapshotObject(c.env, user.id, brandProfileId);
  const brandContextBlock = formatBrandContextBlock(brandSnapshot);

  const toolRunId = generateId();
  const startTime = Date.now();
  const { system, user: userPrompt } = buildChecklistPrompt(context, brandContextBlock);
  // Same reasoning-overhead trait documented throughout this codebase
  // (contentSeries.ts's MAX_SERIES_COUNT comment, the sales-post route's
  // maxTokens) — a short structured-JSON answer still needs a generous
  // ceiling because MiniMax-M3's internal reasoning before that answer is
  // highly variable and NOT proportional to how short the final output is.
  const maxTokens = 8000;
  const estPromptTokens = Math.ceil((system.length + userPrompt.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxTokens });
  const reservation = await deductCredits(c.env, user.id, reserveCredits, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reserveCredits }, 402);
  }

  let result: Awaited<ReturnType<typeof callMinimax>>;
  let parsed: any;
  try {
    result = await callMinimax(
      { apiKey: c.env.MINIMAX_API_KEY, groupId: c.env.MINIMAX_GROUP_ID, model: c.env.MINIMAX_MODEL },
      [
        { role: 'system', content: system },
        { role: 'user', content: `${userPrompt}\n\nตอบเป็น JSON object เท่านั้น ห้าม markdown ห้ามคำอธิบายเพิ่ม` },
      ],
      { maxTokens, temperature: 0.3, jsonMode: true },
    );
    parsed = extractJsonFromAny(result.content, result.reasoning);
  } catch (err: any) {
    console.error('Checklist check error:', err);
    const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: 'ตรวจไม่สำเร็จ ลองอีกครั้ง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  const results: Record<string, { pass: boolean; note: string }> = {};
  for (const key of CHECKLIST_KEYS) {
    const entry = parsed?.[key];
    // Never trust the model's shape blindly — a missing/malformed key
    // degrades to an "unsure" result rather than crashing or silently
    // showing nothing for that item, matching the never-throw-after-payment
    // convention used by every other post-generation parse in this codebase.
    results[key] = entry && typeof entry === 'object'
      ? { pass: entry.pass === true, note: typeof entry.note === 'string' ? entry.note.slice(0, 300) : '' }
      : { pass: false, note: 'ตรวจข้อนี้ไม่สำเร็จ ลองใหม่อีกครั้ง' };
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'content_item_checklist_check',
      JSON.stringify({ content_item_id: id }),
      JSON.stringify(results),
      c.env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0,
      result.usage?.completion_tokens || 0,
      result.usage?.total_tokens || 0,
      estimateCost(result.usage),
      Date.now() - startTime,
      Date.now(),
    ).run();
  } catch (err) {
    console.error('Failed to save checklist-check tool_run (non-fatal):', err);
  }

  const creditsUsed = calculateCredits(result.usage);
  let finalBalance = reservation.balance;
  if (creditsUsed < reserveCredits) {
    const refund = await addCredits(c.env, user.id, reserveCredits - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reserveCredits) {
    const extra = await deductCredits(c.env, user.id, creditsUsed - reserveCredits, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

  return c.json({ ok: true, results, credits_remaining: finalBalance });
});

contentRoutes.post('/api/content-items/:id/assets', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const body = await c.req.json<{ asset_id?: string; link_role?: string; is_primary?: boolean }>();
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);
  if (!body.asset_id) return c.json({ error: 'asset_id_required' }, 400);
  const asset = await c.env.DB.prepare("SELECT id, generation_id FROM media_assets WHERE id = ? AND user_id = ? AND lifecycle_status = 'active'")
    .bind(body.asset_id, user.id).first<{ id: string; generation_id: string | null }>();
  if (!asset) return c.json({ error: 'asset_not_found' }, 404);
  const linkId = await attachAssetToContentItem(c.env, {
    userId: user.id,
    projectId: item.project_id,
    contentItemId: id,
    assetId: body.asset_id,
    generationId: asset.generation_id,
    linkRole: body.link_role || 'primary',
    isPrimary: body.is_primary !== false,
  });
  await logContentEvent(c.env, user.id, item.project_id, id, user.id, 'asset_attached', item.status, item.status, null, { asset_id: body.asset_id });
  return c.json({ ok: true, link_id: linkId });
});

// Fulfill a creative request: link the just-generated asset back to the
// content item that requested it, and mark the request completed. This is the
// connective tissue between Creative Studio and the Works pipeline — a request
// is created when the user clicks "Create Creative" on a content item, then
// Studio calls this once its generation lands so the asset shows up on the
// content card. Keyed by the request (not the content item) so Studio only has
// to remember the one id it was handed.
contentRoutes.post('/api/creative-requests/:id/fulfill', async (c) => {
  const user = getUser(c)!;
  const requestId = c.req.param('id');
  const body = await c.req.json<{ asset_id?: string }>().catch(() => ({} as { asset_id?: string }));
  if (!body.asset_id) return c.json({ error: 'asset_id_required' }, 400);

  const request = await c.env.DB.prepare('SELECT * FROM creative_requests WHERE id = ? AND user_id = ?')
    .bind(requestId, user.id).first<any>();
  if (!request) return c.json({ error: 'creative_request_not_found' }, 404);
  if (!request.content_item_id) return c.json({ error: 'request_has_no_content_item' }, 400);

  const item = await getContentItem(c.env, user.id, request.content_item_id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);

  // Idempotency guard: a request can be fulfilled twice in practice — e.g. two
  // overlapping Studio poll ticks (the pending flag only clears after the
  // first call's promise resolves) or two browser tabs racing on the same
  // generation. Once completed, replaying the call must not insert another
  // asset_link or bump the version again; return the existing link instead of
  // silently duplicating it.
  if (request.status === 'completed') {
    const existingLink = await c.env.DB.prepare(`
      SELECT id FROM asset_links WHERE creative_request_id = ? AND user_id = ?
      ORDER BY version DESC LIMIT 1
    `).bind(requestId, user.id).first<{ id: string }>();
    return c.json({
      ok: true,
      link_id: existingLink?.id || null,
      content_item: serializeContentItem(item),
      return_route: request.return_route || `/works?focus=${item.id}`,
    });
  }

  const asset = await c.env.DB.prepare("SELECT id, generation_id FROM media_assets WHERE id = ? AND user_id = ? AND lifecycle_status = 'active'")
    .bind(body.asset_id, user.id).first<{ id: string; generation_id: string | null }>();
  if (!asset) return c.json({ error: 'asset_not_found' }, 404);

  const now = Date.now();
  const linkId = await attachAssetToContentItem(c.env, {
    userId: user.id,
    projectId: item.project_id,
    contentItemId: item.id,
    assetId: body.asset_id,
    generationId: asset.generation_id,
    creativeRequestId: requestId,
    linkRole: 'primary',
    isPrimary: true,
  });
  await c.env.DB.prepare('UPDATE creative_requests SET status = ?, generation_id = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind('completed', asset.generation_id, now, requestId, user.id).run();
  await logContentEvent(c.env, user.id, item.project_id, item.id, user.id, 'creative_fulfilled', item.status, item.status, null, {
    creative_request_id: requestId, asset_id: body.asset_id,
  });
  return c.json({
    ok: true,
    link_id: linkId,
    content_item: serializeContentItem((await getContentItem(c.env, user.id, item.id))!),
    return_route: request.return_route || `/works?focus=${item.id}`,
  });
});

contentRoutes.post('/api/content-items/:id/creative-requests', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const item = await getContentItem(c.env, user.id, id);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);
  const now = Date.now();
  const requestId = generateId();
  const brief = {
    platform: item.platform,
    format: item.format,
    hook: item.hook,
    caption: item.caption,
    cta: item.cta,
    visual_suggestion: item.visual_suggestion,
  };
  await c.env.DB.prepare(`
    INSERT INTO creative_requests (
      id, user_id, project_id, content_item_id, source_type,
      source_snapshot_json, brief_json, status, return_route, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'content_item', ?, ?, 'draft', ?, ?, ?)
  `).bind(
    requestId,
    user.id,
    item.project_id,
    id,
    JSON.stringify(serializeContentItem(item)),
    JSON.stringify(brief),
    `/works?focus=${id}`,
    now,
    now,
  ).run();
  await logContentEvent(c.env, user.id, item.project_id, id, user.id, 'creative_request_created', item.status, item.status, null, { creative_request_id: requestId });
  return c.json({ ok: true, creative_request_id: requestId, brief });
});

async function requireEmbeddedFeature(c: any, next: any) {
  if (c.env.CREATIVE_EMBEDDED_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Creative Embedded Workspace is not enabled' }, 404);
  }
  await next();
}

function extractCalendar(stepData: any): any[] {
  const output = stepData?.step5?.output || stepData?.step5;
  return Array.isArray(output?.calendar) ? output.calendar : [];
}

/**
 * Link an asset to a content item, demoting the current primary (if any) and
 * bumping `version` so the newest attach always sorts first — both
 * `/assets` (manual attach) and `/creative-requests/:id/fulfill` (Studio
 * auto-attach on generation completion) go through this so "swap the
 * creative and save" behaves the same regardless of which path created it.
 */
async function attachAssetToContentItem(env: Pick<Bindings, 'DB'>, args: {
  userId: string;
  projectId: string | null;
  contentItemId: string;
  assetId: string;
  generationId: string | null;
  creativeRequestId?: string;
  linkRole: string;
  isPrimary: boolean;
}) {
  const now = Date.now();
  if (args.isPrimary) {
    await env.DB.prepare('UPDATE asset_links SET is_primary = 0, updated_at = ? WHERE content_item_id = ? AND user_id = ?')
      .bind(now, args.contentItemId, args.userId).run();
  }
  const maxVersion = await env.DB.prepare('SELECT COALESCE(MAX(version), 0) as v FROM asset_links WHERE content_item_id = ? AND user_id = ?')
    .bind(args.contentItemId, args.userId).first<{ v: number }>();
  const linkId = generateId();
  await env.DB.prepare(`
    INSERT INTO asset_links (
      id, user_id, project_id, content_item_id, creative_request_id, generation_id, asset_id,
      link_role, is_primary, version, metadata_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
  `).bind(
    linkId,
    args.userId,
    args.projectId,
    args.contentItemId,
    args.creativeRequestId || null,
    args.generationId,
    args.assetId,
    args.linkRole,
    args.isPrimary ? 1 : 0,
    (maxVersion?.v || 0) + 1,
    now,
    now,
  ).run();
  return linkId;
}

async function getContentItem(env: Pick<Bindings, 'DB'>, userId: string, id: string) {
  return env.DB.prepare('SELECT * FROM content_items WHERE id = ? AND user_id = ?')
    .bind(id, userId).first<any>();
}

async function listContentItemsByIds(env: Pick<Bindings, 'DB'>, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT * FROM content_items WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(userId, ...ids).all<any>();
  return rows.results || [];
}

async function updateContentItem(env: Pick<Bindings, 'DB'>, userId: string, id: string, updates: Record<string, unknown>) {
  const entries = Object.entries(updates);
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  await env.DB.prepare(`UPDATE content_items SET ${setClause} WHERE id = ? AND user_id = ?`)
    .bind(...entries.map(([, value]) => value), id, userId).run();
}

async function logContentEvent(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  projectId: string | null,
  contentItemId: string,
  actorUserId: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  reason: string | null,
  details: Record<string, unknown>,
) {
  await env.DB.prepare(`
    INSERT INTO content_item_events (
      id, user_id, project_id, content_item_id, actor_user_id, event_type,
      from_status, to_status, reason, details_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(),
    userId,
    projectId,
    contentItemId,
    actorUserId,
    eventType,
    fromStatus,
    toStatus,
    reason,
    JSON.stringify(details),
    Date.now(),
  ).run();
}

function serializeContentItem(row: any) {
  return {
    ...row,
    hashtags: parseJson(row.hashtags_json, []),
    metadata: parseJson(row.metadata_json, {}),
    hashtags_json: undefined,
    metadata_json: undefined,
  };
}

function parseJson(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function contentHash(value: unknown) {
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

export default contentRoutes;
