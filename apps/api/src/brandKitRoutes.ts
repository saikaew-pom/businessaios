import { Hono } from 'hono';
import { generateId } from './lib/crypto';
import { buildBrandbookHTML } from './lib/brandbookExport';
import { calculateCredits, deductCredits, addCredits } from './lib/credit';
import { callMinimax, estimateCost, extractJsonFromAny } from './lib/minimax';
import { getUser, requireAuth, rateLimit } from './lib/middleware';
import type { Bindings, Variables } from './lib/types';

const brandKitRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

brandKitRoutes.use('/api/brand-kits', requireAuth, requireBrandCompositionFeature);
brandKitRoutes.use('/api/brand-kits/*', requireAuth, requireBrandCompositionFeature);
brandKitRoutes.use('/api/compositions', requireAuth, requireBrandCompositionFeature);
brandKitRoutes.use('/api/compositions/*', requireAuth, requireBrandCompositionFeature);

brandKitRoutes.get('/api/brand-kits', async (c) => {
  const user = getUser(c)!;
  const status = normalizeLifecycleStatus(c.req.query('status') || 'active');
  const rows = await c.env.DB.prepare(`
    SELECT bk.*,
      (SELECT COUNT(*) FROM brand_kit_assets bka WHERE bka.brand_kit_id = bk.id) as asset_count
    FROM brand_kits bk
    WHERE bk.user_id = ?
      AND (? = 'all' OR bk.lifecycle_status = ?)
    ORDER BY bk.is_default DESC, bk.updated_at DESC
  `).bind(user.id, status, status).all<any>();
  return c.json({ brand_kits: (rows.results || []).map(serializeBrandKit) });
});

brandKitRoutes.post('/api/brand-kits', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    project_id?: string | null;
    name?: string;
    colors?: unknown[];
    typography?: Record<string, unknown>;
    rules?: Record<string, unknown>;
    is_default?: boolean;
    default_language?: string;
    brandbook_status?: string;
  }>();
  const name = (body.name || '').trim().slice(0, 120);
  if (!name) return c.json({ error: 'name_required' }, 400);
  const defaultLanguage = normalizeLanguage(body.default_language || inferLanguageFromRules(body.rules) || 'th');
  const brandbookStatus = normalizeBrandbookStatus(body.brandbook_status || 'draft');
  if (body.project_id) {
    const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .bind(body.project_id, user.id).first();
    if (!project) return c.json({ error: 'project_not_found' }, 404);
  }
  const now = Date.now();
  const id = generateId();
  if (body.is_default) {
    await c.env.DB.prepare('UPDATE brand_kits SET is_default = 0, updated_at = ? WHERE user_id = ?')
      .bind(now, user.id).run();
  }
  await c.env.DB.prepare(`
    INSERT INTO brand_kits (
      id, user_id, project_id, name, colors_json, typography_json, rules_json,
      is_default, brandbook_status, default_language, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.id,
    body.project_id || null,
    name,
    JSON.stringify(Array.isArray(body.colors) ? body.colors : []),
    JSON.stringify(body.typography && typeof body.typography === 'object' ? body.typography : {}),
    JSON.stringify(body.rules && typeof body.rules === 'object' ? body.rules : {}),
    body.is_default ? 1 : 0,
    brandbookStatus,
    defaultLanguage,
    now,
    now,
  ).run();
  return c.json({ brand_kit: serializeBrandKit((await getBrandKit(c.env, user.id, id))!) });
});

brandKitRoutes.get('/api/brand-kits/:id', async (c) => {
  const user = getUser(c)!;
  const kit = await getBrandKit(c.env, user.id, c.req.param('id'));
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const assets = await listBrandKitAssets(c.env, user.id, kit.id);
  return c.json({ brand_kit: serializeBrandKit(kit), assets });
});

brandKitRoutes.put('/api/brand-kits/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const kit = await getBrandKit(c.env, user.id, id);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const body = await c.req.json<{
    name?: string;
    colors?: unknown[];
    typography?: Record<string, unknown>;
    rules?: Record<string, unknown>;
    is_default?: boolean;
    default_language?: string;
    brandbook_status?: string;
  }>();
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (body.name !== undefined) updates.name = body.name.trim().slice(0, 120);
  if (body.colors !== undefined) updates.colors_json = JSON.stringify(Array.isArray(body.colors) ? body.colors : []);
  if (body.typography !== undefined) updates.typography_json = JSON.stringify(body.typography && typeof body.typography === 'object' ? body.typography : {});
  if (body.rules !== undefined) updates.rules_json = JSON.stringify(body.rules && typeof body.rules === 'object' ? body.rules : {});
  if (body.default_language !== undefined) updates.default_language = normalizeLanguage(body.default_language);
  if (body.brandbook_status !== undefined) updates.brandbook_status = normalizeBrandbookStatus(body.brandbook_status);
  if (body.is_default !== undefined) {
    if (body.is_default && kit.lifecycle_status !== 'active') return c.json({ error: 'brand_kit_not_active' }, 400);
    updates.is_default = body.is_default ? 1 : 0;
    if (body.is_default) {
      await c.env.DB.prepare('UPDATE brand_kits SET is_default = 0, updated_at = ? WHERE user_id = ? AND id != ?')
        .bind(Date.now(), user.id, id).run();
    }
  }
  await updateRow(c.env, 'brand_kits', user.id, id, updates);
  return c.json({ brand_kit: serializeBrandKit((await getBrandKit(c.env, user.id, id))!) });
});

brandKitRoutes.post('/api/brand-kits/:id/default', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const kit = await getBrandKit(c.env, user.id, id);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  if (kit.lifecycle_status !== 'active') return c.json({ error: 'brand_kit_not_active' }, 400);
  const now = Date.now();
  await c.env.DB.prepare('UPDATE brand_kits SET is_default = 0, updated_at = ? WHERE user_id = ?')
    .bind(now, user.id).run();
  await c.env.DB.prepare('UPDATE brand_kits SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(now, id, user.id).run();
  return c.json({ brand_kit: serializeBrandKit((await getBrandKit(c.env, user.id, id))!) });
});

brandKitRoutes.post('/api/brand-kits/:id/archive', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const kit = await getBrandKit(c.env, user.id, id);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const now = Date.now();
  await c.env.DB.prepare(`
    UPDATE brand_kits
    SET lifecycle_status = 'archived', archived_at = ?, is_default = 0, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, now, id, user.id).run();
  return c.json({ brand_kit: serializeBrandKit((await getBrandKit(c.env, user.id, id))!) });
});

brandKitRoutes.post('/api/brand-kits/:id/restore', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const kit = await getBrandKit(c.env, user.id, id);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const now = Date.now();
  await c.env.DB.prepare(`
    UPDATE brand_kits
    SET lifecycle_status = 'active', archived_at = NULL, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, id, user.id).run();
  return c.json({ brand_kit: serializeBrandKit((await getBrandKit(c.env, user.id, id))!) });
});

brandKitRoutes.delete('/api/brand-kits/:id', async (c) => {
  const user = getUser(c)!;
  const id = c.req.param('id');
  const kit = await getBrandKit(c.env, user.id, id);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const now = Date.now();
  await c.env.DB.prepare('UPDATE composition_documents SET brand_kit_id = NULL, updated_at = ? WHERE brand_kit_id = ? AND user_id = ?')
    .bind(now, id, user.id).run();
  await c.env.DB.prepare('DELETE FROM brand_kit_assets WHERE brand_kit_id = ? AND user_id = ?')
    .bind(id, user.id).run();
  await c.env.DB.prepare('DELETE FROM brandbook_exports WHERE brand_kit_id = ? AND user_id = ?')
    .bind(id, user.id).run();
  await c.env.DB.prepare('DELETE FROM brand_kits WHERE id = ? AND user_id = ?')
    .bind(id, user.id).run();
  return c.json({ ok: true });
});

brandKitRoutes.post('/api/brand-kits/:id/export/pdf', async (c) => {
  const user = getUser(c)!;
  const kit = await getBrandKit(c.env, user.id, c.req.param('id'));
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const body = await c.req.json<{ language?: string }>().catch(() => ({} as { language?: string }));
  const language = normalizeLanguage(body.language || kit.default_language || inferLanguageFromRules(parseJson(kit.rules_json, {})) || 'th');
  const serializedKit = serializeBrandKit(kit);
  const assets = await listBrandKitAssets(c.env, user.id, kit.id);
  const html = buildBrandbookHTML({
    brandKit: serializedKit,
    assets,
    language,
    apiBaseUrl: c.env.API_URL || new URL(c.req.url).origin,
  });
  const exportId = generateId();
  const r2Key = `brandbook-exports/${user.id}/${kit.id}/${exportId}.html`;
  await c.env.R2.put(r2Key, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
    customMetadata: {
      user_id: user.id,
      brand_kit_id: kit.id,
      format: 'pdf',
      language,
    },
  });
  await c.env.DB.prepare(`
    INSERT INTO brandbook_exports (id, user_id, brand_kit_id, format, language, r2_key, file_size, created_at)
    VALUES (?, ?, ?, 'pdf', ?, ?, ?, ?)
  `).bind(exportId, user.id, kit.id, language, r2Key, new TextEncoder().encode(html).byteLength, Date.now()).run();
  return c.json({
    ok: true,
    export_id: exportId,
    format: 'pdf',
    language,
    url: `/api/brand-kits/${kit.id}/exports/${exportId}`,
    download_url: `/api/brand-kits/${kit.id}/exports/${exportId}`,
  });
});

brandKitRoutes.post('/api/brand-kits/:id/smart-writing', rateLimit, async (c) => {
  const user = getUser(c)!;
  const kitId = c.req.param('id') || '';
  const kit = await getBrandKit(c.env, user.id, kitId);
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);

  const account = await c.env.DB.prepare('SELECT email_verified FROM users WHERE id = ?')
    .bind(user.id).first<{ email_verified: number }>();
  if (account && account.email_verified === 0) {
    return c.json({ error: 'email_not_verified', message: 'กรุณายืนยันอีเมลก่อน' }, 403);
  }

  type SmartWritingBody = { brandbook?: Record<string, unknown>; mode?: string; language?: string };
  const body: SmartWritingBody = await c.req.json<SmartWritingBody>().catch(() => ({}));
  const savedRules = safeObject(parseJson(kit.rules_json, {}));
  const currentBrandbook = body.brandbook && typeof body.brandbook === 'object'
    ? body.brandbook
    : safeObject((savedRules as any).brandbook);
  const language = normalizeLanguage(body.language || inferLanguageFromRules({ brandbook: currentBrandbook }) || kit.default_language || 'th');
  const mode = body.mode || 'complete';
  const startTime = Date.now();
  const toolRunId = generateId();
  const { system, user: userPrompt } = buildBrandbookSmartWritingPrompt({
    kit: serializeBrandKit(kit),
    brandbook: currentBrandbook,
    language,
    mode,
  });
  const maxTokens = 5200;
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
      { maxTokens, temperature: 0.62, jsonMode: true },
    );
  } catch (err: any) {
    console.error('Brandbook smart writing error:', err);
    const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI call failed' });
    return c.json({ error: 'ai_error', message: err.message, credits_remaining: refund.ok ? refund.balance : undefined }, 500);
  }

  let output: any;
  try {
    output = normalizeSmartWritingOutput(extractJsonFromAny(result.content, result.reasoning));
  } catch (err: any) {
    console.error('Brandbook smart writing parse error:', err);
    const refund = await addCredits(c.env, user.id, reserveCredits, 'generation_refund', { referenceId: toolRunId, note: 'AI returned unparseable output' });
    return c.json({
      error: 'parse_error',
      message: 'AI returned invalid JSON',
      raw: result.content.slice(0, 500),
      credits_remaining: refund.ok ? refund.balance : undefined,
    }, 500);
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO tool_runs (id, user_id, tool_name, input, output, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      toolRunId, user.id, 'brandbook_smart_writing',
      JSON.stringify({ brand_kit_id: kit.id, language, mode }),
      JSON.stringify(output),
      c.env.MINIMAX_MODEL,
      result.usage?.prompt_tokens || 0,
      result.usage?.completion_tokens || 0,
      result.usage?.total_tokens || 0,
      estimateCost(result.usage),
      Date.now() - startTime,
      Date.now(),
    ).run();
  } catch (err) {
    console.error('Failed to save brandbook smart writing tool_run (non-fatal):', err);
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

  return c.json({
    ok: true,
    output,
    meta: {
      model: c.env.MINIMAX_MODEL,
      duration_ms: Date.now() - startTime,
      tokens: result.usage,
      cost_usd: estimateCost(result.usage),
      credits_used: creditsUsed,
      credits_remaining: finalBalance,
    },
  });
});

brandKitRoutes.get('/api/brand-kits/:id/exports/:exportId', async (c) => {
  const user = getUser(c)!;
  const kitId = c.req.param('id');
  const exportId = c.req.param('exportId');
  const exp = await c.env.DB.prepare(`
    SELECT be.*, bk.name
    FROM brandbook_exports be
    JOIN brand_kits bk ON bk.id = be.brand_kit_id
    WHERE be.id = ? AND be.brand_kit_id = ? AND be.user_id = ?
  `).bind(exportId, kitId, user.id).first<any>();
  if (!exp) return c.json({ error: 'not_found' }, 404);
  const obj = await c.env.R2.get(exp.r2_key);
  if (!obj) return c.json({ error: 'not_found_in_storage' }, 404);
  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Content-Disposition', `inline; filename="${sanitizeExportFilename(exp.name || 'brandbook')}-${exportId}.html"`);
  c.header('Cache-Control', 'no-cache');
  if (obj.size !== undefined) c.header('Content-Length', String(obj.size));
  return c.body(await obj.text());
});

brandKitRoutes.post('/api/brand-kits/:id/assets', async (c) => {
  const user = getUser(c)!;
  const kit = await getBrandKit(c.env, user.id, c.req.param('id'));
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const body = await c.req.json<{ asset_id?: string; role?: string; license_confirmed?: boolean; license_note?: string; metadata?: Record<string, unknown> }>();
  if (!body.asset_id) return c.json({ error: 'asset_id_required' }, 400);
  const asset = await c.env.DB.prepare('SELECT id FROM media_assets WHERE id = ? AND user_id = ? AND lifecycle_status = "active"')
    .bind(body.asset_id, user.id).first();
  if (!asset) return c.json({ error: 'asset_not_found' }, 404);
  const now = Date.now();
  const id = generateId();
  await c.env.DB.prepare(`
    INSERT INTO brand_kit_assets (
      id, user_id, brand_kit_id, asset_id, role, license_confirmed,
      license_note, metadata_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.id,
    kit.id,
    body.asset_id,
    (body.role || 'reference').slice(0, 40),
    body.license_confirmed ? 1 : 0,
    (body.license_note || '').slice(0, 500),
    JSON.stringify(body.metadata || {}),
    now,
    now,
  ).run();
  return c.json({ ok: true, asset_link_id: id });
});

brandKitRoutes.delete('/api/brand-kits/:id/assets/:assetLinkId', async (c) => {
  const user = getUser(c)!;
  const kit = await getBrandKit(c.env, user.id, c.req.param('id'));
  if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  const result = await c.env.DB.prepare(`
    DELETE FROM brand_kit_assets
    WHERE id = ? AND brand_kit_id = ? AND user_id = ?
  `).bind(c.req.param('assetLinkId'), kit.id, user.id).run();
  if (!result.meta.changes) return c.json({ error: 'asset_link_not_found' }, 404);
  return c.json({ ok: true });
});

brandKitRoutes.post('/api/compositions', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    project_id?: string | null;
    content_item_id?: string | null;
    brand_kit_id?: string | null;
    base_asset_id?: string | null;
    title?: string;
    document?: Record<string, unknown>;
  }>();
  if (body.brand_kit_id) {
    const kit = await getBrandKit(c.env, user.id, body.brand_kit_id);
    if (!kit) return c.json({ error: 'brand_kit_not_found' }, 404);
  }
  if (body.content_item_id) {
    const item = await c.env.DB.prepare('SELECT id FROM content_items WHERE id = ? AND user_id = ?')
      .bind(body.content_item_id, user.id).first();
    if (!item) return c.json({ error: 'content_item_not_found' }, 404);
  }
  const now = Date.now();
  const id = generateId();
  await c.env.DB.prepare(`
    INSERT INTO composition_documents (
      id, user_id, project_id, content_item_id, brand_kit_id, base_asset_id,
      title, document_json, status, renderer_version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'scaffold-v1', ?, ?)
  `).bind(
    id,
    user.id,
    body.project_id || null,
    body.content_item_id || null,
    body.brand_kit_id || null,
    body.base_asset_id || null,
    (body.title || 'Untitled composition').slice(0, 160),
    JSON.stringify(body.document || {}),
    now,
    now,
  ).run();
  return c.json({ ok: true, composition_id: id });
});

async function requireBrandCompositionFeature(c: any, next: any) {
  if (c.env.BRAND_COMPOSITION_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Brand Kit Composition is not enabled' }, 404);
  }
  await next();
}

function buildBrandbookSmartWritingPrompt(input: {
  kit: any;
  brandbook: Record<string, unknown>;
  language: string;
  mode: string;
}) {
  const context = JSON.stringify({
    brand_kit_name: input.kit.name,
    export_language: input.language,
    mode: input.mode,
    current_brandbook: input.brandbook,
  }, null, 2).slice(0, 18000);

  const system = `You are a senior brand strategist and bilingual Thai/English copy director.
Your job is to help non-marketing business owners complete a practical brandbook.

Rules:
- Return valid JSON only.
- Write excellent Thai for Thai fields and natural English for English fields.
- Do not invent legal claims, awards, guarantees, pricing, addresses, or dates.
- Preserve any strong existing brand details, colors, logo metaphor, audience, and business model.
- If a field is already good, improve clarity without changing meaning.
- Make the brand useful for AI creative generation: concrete mood, composition, people style, product style, prompt guide, and negative prompt.
- Tone should be professional, practical, premium enough for SME owners, and not hype-driven.
- Avoid generic words such as innovative, world-class, best, revolutionary unless grounded in the context.
- Keep every text block concise enough for a brandbook PDF.`;

  const user = `Create or improve a complete brandbook writing draft from this context.

Return this exact JSON shape:
{
  "identity": {
    "brand_name": { "th": "", "en": "" },
    "business_description": { "th": "", "en": "" },
    "positioning": { "th": "", "en": "" },
    "value_proposition": { "th": "", "en": "" },
    "audience_summary": { "th": "", "en": "" },
    "tagline": { "th": "", "en": "" }
  },
  "tone_of_voice": {
    "summary": { "th": "", "en": "" },
    "cta_style": { "th": "", "en": "" },
    "use_words": { "th": [], "en": [] },
    "avoid_words": { "th": [], "en": [] }
  },
  "creative_style": {
    "visual_mood": [],
    "lighting": "",
    "composition": "",
    "people_style": "",
    "product_style": "",
    "background_style": "",
    "graphic_elements": [],
    "avoid": []
  },
  "ai_prompt_guide": {
    "default_prompt_style": { "th": "", "en": "" },
    "negative_prompt": { "th": "", "en": "" }
  },
  "compliance": {
    "disclaimer": ""
  },
  "writing_notes": []
}

Context:
${context}`;

  return { system, user };
}

function normalizeSmartWritingOutput(value: any) {
  const identity = safeObject(value.identity);
  const tone = safeObject(value.tone_of_voice);
  const creative = safeObject(value.creative_style);
  const promptGuide = safeObject(value.ai_prompt_guide);
  const compliance = safeObject(value.compliance);
  return {
    identity: {
      brand_name: localizedOutput(identity.brand_name),
      business_description: localizedOutput(identity.business_description),
      positioning: localizedOutput(identity.positioning),
      value_proposition: localizedOutput(identity.value_proposition),
      audience_summary: localizedOutput(identity.audience_summary),
      tagline: localizedOutput(identity.tagline),
    },
    tone_of_voice: {
      summary: localizedOutput(tone.summary),
      cta_style: localizedOutput(tone.cta_style),
      use_words: {
        th: stringArray(safeObject(tone.use_words).th).slice(0, 12),
        en: stringArray(safeObject(tone.use_words).en).slice(0, 12),
      },
      avoid_words: {
        th: stringArray(safeObject(tone.avoid_words).th).slice(0, 12),
        en: stringArray(safeObject(tone.avoid_words).en).slice(0, 12),
      },
    },
    creative_style: {
      visual_mood: stringArray(creative.visual_mood).slice(0, 10),
      lighting: stringValue(creative.lighting),
      composition: stringValue(creative.composition),
      people_style: stringValue(creative.people_style),
      product_style: stringValue(creative.product_style),
      background_style: stringValue(creative.background_style),
      graphic_elements: stringArray(creative.graphic_elements).slice(0, 10),
      avoid: stringArray(creative.avoid).slice(0, 10),
    },
    ai_prompt_guide: {
      default_prompt_style: localizedOutput(promptGuide.default_prompt_style),
      negative_prompt: localizedOutput(promptGuide.negative_prompt),
    },
    compliance: {
      disclaimer: stringValue(compliance.disclaimer),
    },
    writing_notes: stringArray(value.writing_notes).slice(0, 8),
  };
}

function safeObject(value: any) {
  return value && typeof value === 'object' ? value : {};
}

function localizedOutput(value: any) {
  if (typeof value === 'string') return { th: value.trim(), en: '' };
  const obj = safeObject(value);
  return {
    th: stringValue(obj.th),
    en: stringValue(obj.en),
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function getBrandKit(env: Pick<Bindings, 'DB'>, userId: string, id: string) {
  return env.DB.prepare('SELECT * FROM brand_kits WHERE id = ? AND user_id = ?')
    .bind(id, userId).first<any>();
}

async function listBrandKitAssets(env: Pick<Bindings, 'DB'>, userId: string, brandKitId: string) {
  const assets = await env.DB.prepare(`
    SELECT bka.*, ma.original_filename, ma.asset_type, ma.mime_type
    FROM brand_kit_assets bka
    JOIN media_assets ma ON ma.id = bka.asset_id
    WHERE bka.brand_kit_id = ? AND bka.user_id = ?
    ORDER BY bka.role ASC, bka.updated_at DESC
  `).bind(brandKitId, userId).all<any>();
  return (assets.results || []).map(serializeBrandKitAsset);
}

async function updateRow(env: Pick<Bindings, 'DB'>, table: string, userId: string, id: string, updates: Record<string, unknown>) {
  const entries = Object.entries(updates);
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  await env.DB.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ? AND user_id = ?`)
    .bind(...entries.map(([, value]) => value), id, userId).run();
}

function serializeBrandKit(row: any) {
  return {
    ...row,
    colors: parseJson(row.colors_json, []),
    typography: parseJson(row.typography_json, {}),
    rules: parseJson(row.rules_json, {}),
    is_default: row.is_default === 1,
    lifecycle_status: row.lifecycle_status || 'active',
    brandbook_status: row.brandbook_status || 'draft',
    default_language: row.default_language || inferLanguageFromRules(parseJson(row.rules_json, {})) || 'th',
    colors_json: undefined,
    typography_json: undefined,
    rules_json: undefined,
  };
}

function serializeBrandKitAsset(row: any) {
  return {
    ...row,
    license_confirmed: row.license_confirmed === 1,
    metadata: parseJson(row.metadata_json, {}),
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

function normalizeLifecycleStatus(value: string) {
  return ['active', 'archived', 'all'].includes(value) ? value : 'active';
}

function normalizeBrandbookStatus(value: string) {
  return ['draft', 'reviewed', 'published'].includes(value) ? value : 'draft';
}

function normalizeLanguage(value: string | undefined) {
  if (value === 'en' || value === 'th-en') return value;
  return 'th';
}

function inferLanguageFromRules(rules: unknown) {
  if (!rules || typeof rules !== 'object') return null;
  const language = (rules as any).brandbook?.language?.default || (rules as any).language?.default;
  return typeof language === 'string' ? normalizeLanguage(language) : null;
}

function sanitizeExportFilename(value: string) {
  return value.replace(/[^\w.\- ]+/g, '').trim().slice(0, 80) || 'brandbook';
}

export default brandKitRoutes;
