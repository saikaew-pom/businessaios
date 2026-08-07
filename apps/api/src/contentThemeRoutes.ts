import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { getUser, requireAuth } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';
import { addCredits, deductCredits, calculateCredits } from './lib/credit';
import { getBrandProfile, getActiveBrandProfile, getBrandSnapshotObject } from './lib/creative/brandContext';
import {
  callThemeSuggestion,
  callTopicSuggestion,
  serializeTheme,
  serializeTopic,
  type ContentThemeRow,
  type ContentTopicRow,
} from './lib/creative/contentThemes';

const contentThemeRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Same feature area as content-series (ideation feeds directly into it) —
// reuses its flag rather than adding a new one.
async function requireFeature(c: any, next: any) {
  if (c.env.CONTENT_SERIES_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Content Series Generator is not enabled' }, 404);
  }
  await next();
}

contentThemeRoutes.use('/api/content-themes', requireAuth, requireFeature);
contentThemeRoutes.use('/api/content-themes/*', requireAuth, requireFeature);
contentThemeRoutes.use('/api/content-topics/*', requireAuth, requireFeature);

async function resolveBrandProfileId(env: Pick<Bindings, 'DB'>, userId: string, requested: string | null | undefined) {
  if (requested) {
    const profile = await getBrandProfile(env, userId, requested);
    return profile?.id || null;
  }
  const active = await getActiveBrandProfile(env, userId);
  return active?.id || null;
}

// -----------------------------------------------------------------------
// Themes
// -----------------------------------------------------------------------

contentThemeRoutes.get('/api/content-themes', async (c) => {
  const user = getUser(c)!;
  const brandProfileId = await resolveBrandProfileId(c.env, user.id, c.req.query('brand_profile_id'));
  if (!brandProfileId) return c.json({ themes: [] });

  const rows = await c.env.DB.prepare(`
    SELECT * FROM content_themes WHERE user_id = ? AND brand_profile_id = ? AND status != 'dismissed'
    ORDER BY status DESC, created_at DESC
  `).bind(user.id, brandProfileId).all<ContentThemeRow>();
  return c.json({ themes: (rows.results || []).map(serializeTheme) });
});

contentThemeRoutes.post('/api/content-themes/suggest', async (c) => {
  const user = getUser(c)!;
  const body: { brand_profile_id?: string } = await c.req.json<{ brand_profile_id?: string }>().catch(() => ({}));
  const brandProfileId = await resolveBrandProfileId(c.env, user.id, body.brand_profile_id);
  if (!brandProfileId) return c.json({ error: 'brand_profile_required', message: 'กรุณาสร้าง Brand Profile ก่อน' }, 400);

  const account = await c.env.DB.prepare('SELECT email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number }>();
  if (account && account.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const toolRunId = generateId();
  const snapshot = await getBrandSnapshotObject(c.env, user.id, brandProfileId);

  // Estimate a reserve before the call (same shape as every other reserve
  // here). Must track callThemeSuggestion's actual maxTokens (currently
  // 4000) — this hardcoded estimate, not callThemeSuggestion's own returned
  // `reserveCredits`, is what the true-up math below actually compares
  // against.
  const reservationEstimate = calculateCredits({ prompt_tokens: 800, completion_tokens: 4000 });
  const reservation = await deductCredits(c.env, user.id, reservationEstimate, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reservationEstimate }, 402);
  }

  let result: Awaited<ReturnType<typeof callThemeSuggestion>>;
  try {
    result = await callThemeSuggestion(c.env, snapshot);
  } catch (err: any) {
    console.error('Theme suggestion error:', err);
    const refund = await addCredits(c.env, user.id, reservationEstimate, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed or returned unusable output' });
    return c.json({ error: 'ai_error', message: 'คิดธีมไม่สำเร็จ ลองใหม่อีกครั้ง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  // A fresh suggest run replaces the PRIOR unconfirmed batch for this brand
  // profile — otherwise re-running "คิดใหม่" would pile up dead 'suggested'
  // rows forever. Confirmed themes are never touched here.
  await c.env.DB.prepare(`DELETE FROM content_themes WHERE user_id = ? AND brand_profile_id = ? AND status = 'suggested'`)
    .bind(user.id, brandProfileId).run();

  const now = Date.now();
  const inserted: ContentThemeRow[] = [];
  for (const theme of result.themes) {
    const id = generateId();
    const row: ContentThemeRow = {
      id, user_id: user.id, brand_profile_id: brandProfileId,
      name: theme.name, reason: theme.reason, status: 'suggested',
      created_at: now, updated_at: now,
    };
    await c.env.DB.prepare(`
      INSERT INTO content_themes (id, user_id, brand_profile_id, name, reason, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'suggested', ?, ?)
    `).bind(id, user.id, brandProfileId, theme.name, theme.reason, now, now).run();
    inserted.push(row);
  }

  const creditsUsed = result.creditsUsed;
  let finalBalance = reservation.balance;
  if (creditsUsed < reservationEstimate) {
    const refund = await addCredits(c.env, user.id, reservationEstimate - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reservationEstimate) {
    const extra = await deductCredits(c.env, user.id, creditsUsed - reservationEstimate, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

  return c.json({ themes: inserted.map(serializeTheme), credits_remaining: finalBalance }, 201);
});

contentThemeRoutes.post('/api/content-themes/confirm-batch', async (c) => {
  const user = getUser(c)!;
  const body: { theme_ids?: string[]; renames?: Record<string, string> } = await c.req.json<{ theme_ids?: string[]; renames?: Record<string, string> }>().catch(() => ({}));
  const themeIds = Array.isArray(body.theme_ids) ? body.theme_ids.filter((id) => typeof id === 'string') : [];
  if (!themeIds.length) return c.json({ error: 'theme_ids_required' }, 400);

  const placeholders = themeIds.map(() => '?').join(',');
  const rows = await c.env.DB.prepare(`SELECT * FROM content_themes WHERE id IN (${placeholders}) AND user_id = ?`)
    .bind(...themeIds, user.id).all<ContentThemeRow>();
  const owned = rows.results || [];
  if (owned.length !== themeIds.length) return c.json({ error: 'theme_not_found' }, 404);

  const brandProfileId = owned[0].brand_profile_id;
  // All themes in one confirm batch must belong to the same brand profile —
  // otherwise the dismiss-the-rest and content_pillars_json sync below (both
  // scoped to a single brandProfileId) would silently leave the OTHER
  // profile's theme marked 'confirmed' in the DB while its
  // content_pillars_json never picks it up. Reject rather than guess.
  if (owned.some((theme) => theme.brand_profile_id !== brandProfileId)) {
    return c.json({ error: 'theme_brand_profile_mismatch', message: 'ธีมที่เลือกต้องอยู่ใน Brand Profile เดียวกัน' }, 400);
  }
  const now = Date.now();
  for (const theme of owned) {
    const newName = body.renames?.[theme.id]?.trim();
    await c.env.DB.prepare(`UPDATE content_themes SET status = 'confirmed', name = ?, updated_at = ? WHERE id = ?`)
      .bind(newName || theme.name, now, theme.id).run();
  }
  // Whatever else was suggested in the same batch but not picked is done —
  // dismiss it so it stops showing as a pending choice.
  await c.env.DB.prepare(`
    UPDATE content_themes SET status = 'dismissed', updated_at = ?
    WHERE user_id = ? AND brand_profile_id = ? AND status = 'suggested' AND id NOT IN (${placeholders})
  `).bind(now, user.id, brandProfileId, ...themeIds).run();

  // Sync brand_profiles.content_pillars_json so brand-context prompts
  // (formatBrandContextBlock) see the confirmed themes — recomputed from ALL
  // confirmed themes for this profile, not just this batch, so it stays
  // correct across repeated confirm rounds.
  const confirmedNames = await c.env.DB.prepare(`
    SELECT name FROM content_themes WHERE user_id = ? AND brand_profile_id = ? AND status = 'confirmed' ORDER BY updated_at ASC
  `).bind(user.id, brandProfileId).all<{ name: string }>();
  await c.env.DB.prepare(`UPDATE brand_profiles SET content_pillars_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(JSON.stringify((confirmedNames.results || []).map((r) => r.name)), now, brandProfileId, user.id).run();

  const updated = await c.env.DB.prepare(`SELECT * FROM content_themes WHERE id IN (${placeholders})`)
    .bind(...themeIds).all<ContentThemeRow>();
  return c.json({ themes: (updated.results || []).map(serializeTheme) });
});

// -----------------------------------------------------------------------
// Topics
// -----------------------------------------------------------------------

async function getOwnedTheme(env: Pick<Bindings, 'DB'>, userId: string, themeId: string) {
  return env.DB.prepare('SELECT * FROM content_themes WHERE id = ? AND user_id = ?')
    .bind(themeId, userId).first<ContentThemeRow>();
}

contentThemeRoutes.get('/api/content-themes/:id/topics', async (c) => {
  const user = getUser(c)!;
  const theme = await getOwnedTheme(c.env, user.id, c.req.param('id'));
  if (!theme) return c.json({ error: 'theme_not_found' }, 404);

  const rows = await c.env.DB.prepare(`
    SELECT * FROM content_topics WHERE theme_id = ? AND status != 'dismissed' ORDER BY created_at DESC
  `).bind(theme.id).all<ContentTopicRow>();
  return c.json({ topics: (rows.results || []).map(serializeTopic) });
});

contentThemeRoutes.post('/api/content-themes/:id/topics/suggest', async (c) => {
  const user = getUser(c)!;
  const theme = await getOwnedTheme(c.env, user.id, c.req.param('id'));
  if (!theme) return c.json({ error: 'theme_not_found' }, 404);

  const account = await c.env.DB.prepare('SELECT email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number }>();
  if (account && account.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  const toolRunId = generateId();
  const snapshot = await getBrandSnapshotObject(c.env, user.id, theme.brand_profile_id);

  // Full history for this theme, regardless of status — a dismissed or
  // already-used topic still shouldn't be suggested again ("history ต่อ
  // pillar" in the plan means the theme's whole past, not just what's live).
  const historyRows = await c.env.DB.prepare(`SELECT title FROM content_topics WHERE theme_id = ?`)
    .bind(theme.id).all<{ title: string }>();
  const existingTitles = (historyRows.results || []).map((r) => r.title);

  // Must track callTopicSuggestion's actual maxTokens (contentThemes.ts) —
  // this is the estimate that gates the upfront reserve and therefore the
  // true-up math below; callTopicSuggestion's own returned `reserveCredits`
  // is NOT consulted here, so letting these two drift apart under-reserves
  // for real (bumped 6000 -> 12000 alongside the maxTokens bump).
  const reservationEstimate = calculateCredits({ prompt_tokens: 1200, completion_tokens: 12000 });
  const reservation = await deductCredits(c.env, user.id, reservationEstimate, 'generation_reserve', toolRunId);
  if (!reservation.ok) {
    return c.json({ error: 'insufficient_credits', message: 'เครดิตไม่เพียงพอ', balance: reservation.balance, required: reservationEstimate }, 402);
  }

  let result: Awaited<ReturnType<typeof callTopicSuggestion>>;
  try {
    result = await callTopicSuggestion(c.env, {
      themeName: theme.name,
      themeReason: theme.reason,
      brandSnapshot: snapshot,
      existingTitles,
      nowMonth: new Date().getMonth() + 1,
    });
  } catch (err: any) {
    console.error('Topic suggestion error:', err);
    const refund = await addCredits(c.env, user.id, reservationEstimate, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed or returned unusable output' });
    return c.json({ error: 'ai_error', message: 'คิดหัวข้อไม่สำเร็จ ลองใหม่อีกครั้ง', credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  const now = Date.now();
  const inserted: ContentTopicRow[] = [];
  for (const topic of result.topics) {
    const id = generateId();
    await c.env.DB.prepare(`
      INSERT INTO content_topics (id, user_id, theme_id, title, content_type, seasonal_event, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'suggested', ?, ?)
    `).bind(id, user.id, theme.id, topic.title, topic.content_type, topic.seasonal_event, now, now).run();
    inserted.push({
      id, user_id: user.id, theme_id: theme.id, title: topic.title, content_type: topic.content_type,
      seasonal_event: topic.seasonal_event, status: 'suggested', used_series_id: null, created_at: now, updated_at: now,
    });
  }

  const creditsUsed = result.creditsUsed;
  let finalBalance = reservation.balance;
  if (creditsUsed < reservationEstimate) {
    const refund = await addCredits(c.env, user.id, reservationEstimate - creditsUsed, 'generation_refund', { referenceId: toolRunId, note: 'Reserved more than actual usage' });
    if (refund.ok) finalBalance = refund.balance;
  } else if (creditsUsed > reservationEstimate) {
    const extra = await deductCredits(c.env, user.id, creditsUsed - reservationEstimate, 'generation_true_up', toolRunId);
    if (extra.ok) finalBalance = extra.balance;
  }

  return c.json({ topics: inserted.map(serializeTopic), credits_remaining: finalBalance }, 201);
});

export default contentThemeRoutes;
