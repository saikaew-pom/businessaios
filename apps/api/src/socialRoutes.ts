import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { getUser, requireAuth } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';

const socialRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

socialRoutes.use('/api/social/*', requireAuth, requireSocialPublishingFeature);

socialRoutes.get('/api/social/capabilities', async (c) => {
  return c.json({
    mode: 'scaffold',
    direct_publishing_ready: false,
    providers: [
      providerCapability(c.env, 'meta', 'Facebook / Instagram', Boolean(c.env.META_APP_ID && c.env.META_APP_SECRET), ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish']),
      providerCapability(c.env, 'tiktok', 'TikTok', Boolean(c.env.TIKTOK_CLIENT_KEY && c.env.TIKTOK_CLIENT_SECRET), ['video.upload', 'video.publish']),
      providerCapability(c.env, 'line', 'LINE OA', Boolean(c.env.LINE_CHANNEL_SECRET && c.env.LINE_CHANNEL_ACCESS_TOKEN), ['message.write']),
    ],
    note: 'Direct publishing requires provider credentials, OAuth consent, and platform app review before publish adapters are enabled.',
  });
});

socialRoutes.get('/api/social/accounts', async (c) => {
  const user = getUser(c)!;
  const rows = await c.env.DB.prepare(`
    SELECT id, project_id, provider, provider_account_id, provider_parent_id, display_name,
      metadata_json, scopes_json, token_expires_at, connection_status,
      last_verified_at, created_at, updated_at
    FROM social_accounts
    WHERE user_id = ?
    ORDER BY provider ASC, updated_at DESC
  `).bind(user.id).all<any>();
  return c.json({ accounts: (rows.results || []).map(serializeAccount) });
});

socialRoutes.post('/api/social/accounts/manual', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{ provider?: string; display_name?: string; provider_account_id?: string; project_id?: string | null }>();
  const provider = normalizeProvider(body.provider || '');
  if (!provider) return c.json({ error: 'provider_required' }, 400);
  const displayName = (body.display_name || '').trim().slice(0, 120);
  if (!displayName) return c.json({ error: 'display_name_required' }, 400);
  const providerAccountId = (body.provider_account_id || `manual:${provider}:${displayName.toLowerCase()}`).slice(0, 160);
  const now = Date.now();
  const id = generateId();
  await c.env.DB.prepare(`
    INSERT INTO social_accounts (
      id, user_id, project_id, provider, provider_account_id, display_name,
      metadata_json, scopes_json, connection_status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'manual', ?, ?)
    ON CONFLICT(user_id, provider, provider_account_id) DO UPDATE SET
      display_name = excluded.display_name,
      connection_status = 'manual',
      updated_at = excluded.updated_at
  `).bind(
    id,
    user.id,
    body.project_id || null,
    provider,
    providerAccountId,
    displayName,
    JSON.stringify({ mode: 'manual_publish_ack' }),
    now,
    now,
  ).run();
  return c.json({ ok: true });
});

socialRoutes.post('/api/social/publications', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    content_item_id?: string;
    social_account_id?: string;
    scheduled_at?: number | null;
    timezone?: string;
    idempotency_key?: string;
  }>();
  if (!body.content_item_id || !body.social_account_id) return c.json({ error: 'missing_fields' }, 400);
  const [item, account] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM content_items WHERE id = ? AND user_id = ?').bind(body.content_item_id, user.id).first<any>(),
    c.env.DB.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?').bind(body.social_account_id, user.id).first<any>(),
  ]);
  if (!item) return c.json({ error: 'content_item_not_found' }, 404);
  if (!account) return c.json({ error: 'social_account_not_found' }, 404);
  if (!['approved', 'scheduled'].includes(item.status)) return c.json({ error: 'approval_required' }, 409);

  const now = Date.now();
  const id = generateId();
  const idempotencyKey = (body.idempotency_key || `${item.id}:${account.id}:${body.scheduled_at || 'manual'}`).slice(0, 180);
  const status = 'needs_manual_publish';
  await c.env.DB.prepare(`
    INSERT INTO social_publications (
      id, user_id, project_id, content_item_id, social_account_id, provider,
      payload_snapshot_json, asset_snapshot_json, idempotency_key, scheduled_at,
      timezone, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, idempotency_key) DO NOTHING
  `).bind(
    id,
    user.id,
    item.project_id,
    item.id,
    account.id,
    account.provider,
    JSON.stringify({
      title: item.title,
      caption: item.caption,
      cta: item.cta,
      hashtags: parseJson(item.hashtags_json, []),
      platform: item.platform,
      format: item.format,
    }),
    JSON.stringify([]),
    idempotencyKey,
    body.scheduled_at || item.scheduled_at || null,
    body.timezone || item.timezone || 'Asia/Bangkok',
    status,
    now,
    now,
  ).run();

  return c.json({ ok: true, status, note: 'Manual publishing record created. Use manual ack after posting on the platform.' });
});

socialRoutes.post('/api/social/publications/:id/manual-ack', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const body = await c.req.json<{ remote_post_url?: string; remote_post_id?: string }>();
  const now = Date.now();
  const publication = await c.env.DB.prepare('SELECT * FROM social_publications WHERE id = ? AND user_id = ?')
    .bind(id, user.id).first<any>();
  if (!publication) return c.json({ error: 'publication_not_found' }, 404);
  await c.env.DB.prepare(`
    UPDATE social_publications
    SET status = 'published', remote_post_url = ?, remote_post_id = ?, published_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    (body.remote_post_url || '').slice(0, 500),
    (body.remote_post_id || '').slice(0, 160),
    now,
    now,
    id,
    user.id,
  ).run();
  await c.env.DB.prepare(`
    UPDATE content_items
    SET status = 'published', published_ack_at = ?, published_ack_by = ?, manual_publish_url = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    now,
    user.id,
    (body.remote_post_url || '').slice(0, 500),
    now,
    publication.content_item_id,
    user.id,
  ).run();
  return c.json({ ok: true });
});

socialRoutes.post('/api/social/webhooks/:provider', async (c) => {
  const provider = normalizeProvider(c.req.param('provider'));
  if (!provider) return c.json({ error: 'provider_required' }, 400);
  const payload = await c.req.text();
  const payloadHash = await sha256(payload);
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO social_publish_events (
      id, provider, payload_hash, signature_verified, normalized_outcome,
      details_json, received_at
    )
    VALUES (?, ?, ?, 0, 'received_unverified', ?, ?)
    ON CONFLICT(provider, payload_hash) DO NOTHING
  `).bind(generateId(), provider, payloadHash, JSON.stringify({ length: payload.length }), now).run();
  return c.json({ ok: true, accepted: true });
});

async function requireSocialPublishingFeature(c: any, next: any) {
  if (c.env.SOCIAL_PUBLISHING_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Social Publishing is not enabled' }, 404);
  }
  await next();
}

function providerCapability(_env: Bindings, id: string, label: string, configured: boolean, requiredScopes: string[]) {
  return {
    id,
    label,
    configured,
    direct_publish_enabled: false,
    required_scopes: requiredScopes,
    setup_state: configured ? 'credentials_present_adapter_locked' : 'credentials_missing',
  };
}

function normalizeProvider(value: string) {
  const provider = value.toLowerCase().trim();
  return ['meta', 'facebook', 'instagram'].includes(provider)
    ? 'meta'
    : ['tiktok', 'line'].includes(provider)
      ? provider
      : '';
}

function serializeAccount(row: any) {
  return {
    ...row,
    metadata: parseJson(row.metadata_json, {}),
    scopes: parseJson(row.scopes_json, []),
    metadata_json: undefined,
    scopes_json: undefined,
  };
}

function parseJson(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default socialRoutes;
