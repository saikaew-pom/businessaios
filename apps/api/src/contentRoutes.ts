import { Hono } from 'hono';
import { generateId } from './lib/crypto';
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
