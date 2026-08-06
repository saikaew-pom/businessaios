import { generateId } from '../crypto';
import type { Bindings } from '../types';
import { canonicalJson } from '../media/catalog';

export type BrandProfilePersona = {
  name: string;
  age: string;
  job: string;
  daily_life: string;
  complaints: [string, string, string];
};

export type BrandProfileInput = {
  name?: string;
  business_summary?: string;
  audience?: unknown;
  tone_of_voice?: unknown;
  content_pillars?: unknown;
  offers?: unknown;
  rules?: unknown;
  default_reference_asset_ids?: unknown;
  persona?: BrandProfilePersona | null;
  voice_samples?: string[];
  is_default?: boolean;
};

export type BrandProfileRow = {
  id: string;
  user_id: string;
  name: string;
  business_summary: string;
  audience_json: string;
  tone_of_voice_json: string;
  content_pillars_json: string;
  offers_json: string;
  rules_json: string;
  default_reference_asset_ids_json: string;
  persona_json: string | null;
  voice_samples_json: string | null;
  schema_version: number;
  is_default: number;
  created_at: number;
  updated_at: number;
};

export function validateBrandProfileInput(input: BrandProfileInput, partial = false) {
  const errors: string[] = [];
  if (!partial && !input.name?.trim()) errors.push('name_required');
  if (input.name !== undefined && input.name.trim().length > 120) errors.push('name_too_long');
  if (input.business_summary !== undefined && input.business_summary.length > 3000) {
    errors.push('business_summary_too_long');
  }

  for (const [field, value] of [
    ['audience', input.audience],
    ['tone_of_voice', input.tone_of_voice],
    ['content_pillars', input.content_pillars],
    ['offers', input.offers],
    ['default_reference_asset_ids', input.default_reference_asset_ids],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) errors.push(`${field}_must_be_array`);
  }
  if (input.rules !== undefined && (!input.rules || typeof input.rules !== 'object' || Array.isArray(input.rules))) {
    errors.push('rules_must_be_object');
  }

  if (input.voice_samples !== undefined && !Array.isArray(input.voice_samples)) {
    errors.push('voice_samples_must_be_array');
  }

  if (input.persona !== undefined && input.persona !== null) {
    const p = input.persona;
    if (typeof p !== 'object' || Array.isArray(p)) {
      errors.push('persona_must_be_object');
    } else {
      // p.name/p.complaints entries are untrusted request-body values, not
      // guaranteed strings (e.g. a client could send numbers/null/objects) —
      // guard with typeof before calling .trim()/.length so malformed input
      // fails validation with a 400 instead of throwing and surfacing as a
      // 500 from the global error handler.
      if (typeof p.name !== 'string' || !p.name.trim()) errors.push('persona_name_required');
      if (!Array.isArray(p.complaints) || p.complaints.length !== 3) {
        errors.push('persona_complaints_must_be_exactly_3');
      } else if (p.complaints.some((c) => typeof c !== 'string' || !c.trim() || c.length > 200)) {
        errors.push('persona_complaint_invalid');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function createBrandProfile(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  input: BrandProfileInput,
  now = Date.now(),
) {
  const validation = validateBrandProfileInput(input);
  if (!validation.ok) return { ok: false as const, status: 400, errors: validation.errors };

  const id = generateId();
  const isDefault = input.is_default ? 1 : 0;
  if (isDefault) await clearDefaultBrandProfile(env, userId);

  await env.DB.prepare(`
    INSERT INTO brand_profiles (
      id, user_id, name, business_summary, audience_json, tone_of_voice_json,
      content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
      persona_json, voice_samples_json,
      schema_version, is_default, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    id,
    userId,
    input.name!.trim(),
    input.business_summary?.trim() || '',
    canonicalJson(input.audience || []),
    canonicalJson(input.tone_of_voice || []),
    canonicalJson(input.content_pillars || []),
    canonicalJson(input.offers || []),
    canonicalJson(input.rules || {}),
    canonicalJson(input.default_reference_asset_ids || []),
    input.persona ? canonicalJson(input.persona) : null,
    input.voice_samples ? canonicalJson(input.voice_samples) : null,
    isDefault,
    now,
    now,
  ).run();

  if (isDefault) await setActiveBrandProfile(env, userId, id, now);
  const profile = await getBrandProfile(env, userId, id);
  return { ok: true as const, profile: profile! };
}

export async function listBrandProfiles(env: Pick<Bindings, 'DB'>, userId: string) {
  const result = await env.DB.prepare(`
    SELECT * FROM brand_profiles
    WHERE user_id = ?
    ORDER BY is_default DESC, updated_at DESC
  `).bind(userId).all<BrandProfileRow>();
  return (result.results || []).map(serializeBrandProfile);
}

export async function getBrandProfile(env: Pick<Bindings, 'DB'>, userId: string, id: string) {
  const row = await env.DB.prepare(`
    SELECT * FROM brand_profiles WHERE id = ? AND user_id = ?
  `).bind(id, userId).first<BrandProfileRow>();
  return row ? serializeBrandProfile(row) : null;
}

export async function getActiveBrandProfile(env: Pick<Bindings, 'DB'>, userId: string) {
  const selected = await env.DB.prepare(`
    SELECT p.* FROM brand_profile_selections s
    JOIN brand_profiles p ON p.id = s.active_profile_id
    WHERE s.user_id = ? AND p.user_id = ?
  `).bind(userId, userId).first<BrandProfileRow>();
  if (selected) return serializeBrandProfile(selected);

  const fallback = await env.DB.prepare(`
    SELECT * FROM brand_profiles
    WHERE user_id = ?
    ORDER BY is_default DESC, updated_at DESC
    LIMIT 1
  `).bind(userId).first<BrandProfileRow>();
  return fallback ? serializeBrandProfile(fallback) : null;
}

export async function setActiveBrandProfile(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  profileId: string | null,
  now = Date.now(),
) {
  if (profileId) {
    const profile = await getBrandProfile(env, userId, profileId);
    if (!profile) return { ok: false as const, status: 404, error: 'brand_profile_not_found' };
  }

  await env.DB.prepare(`
    INSERT INTO brand_profile_selections (user_id, active_profile_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      active_profile_id = excluded.active_profile_id,
      updated_at = excluded.updated_at
  `).bind(userId, profileId, now).run();

  return { ok: true as const, active_profile: profileId ? await getBrandProfile(env, userId, profileId) : null };
}

function toSnapshotObject(profile: Awaited<ReturnType<typeof getBrandProfile>>) {
  return profile
    ? {
        schema_version: profile.schema_version,
        profile_id: profile.id,
        name: profile.name,
        business_summary: profile.business_summary,
        audience: profile.audience,
        tone_of_voice: profile.tone_of_voice,
        content_pillars: profile.content_pillars,
        offers: profile.offers,
        rules: profile.rules,
        default_reference_asset_ids: profile.default_reference_asset_ids,
        persona: profile.persona,
        voice_samples: profile.voice_samples,
      }
    : { schema_version: 1, profile_id: null };
}

/**
 * Same snapshot shape as createBrandContextSnapshot, without writing a
 * brand_context_snapshots row — for call sites that need brand context to
 * ground a single lightweight AI call (e.g. regenerate-field) where
 * persisting a new immutable snapshot per call would just bloat that table.
 */
export async function getBrandSnapshotObject(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  profileId?: string | null,
) {
  const profile = profileId
    ? await getBrandProfile(env, userId, profileId)
    : await getActiveBrandProfile(env, userId);
  return toSnapshotObject(profile);
}

export async function createBrandContextSnapshot(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  profileId?: string | null,
  now = Date.now(),
) {
  const profile = profileId
    ? await getBrandProfile(env, userId, profileId)
    : await getActiveBrandProfile(env, userId);
  const snapshot = toSnapshotObject(profile);
  const snapshotJson = canonicalJson(snapshot);
  const snapshotHash = await sha256Hex(snapshotJson);
  const id = generateId();

  await env.DB.prepare(`
    INSERT INTO brand_context_snapshots (
      id, user_id, brand_profile_id, profile_version, snapshot_json,
      snapshot_hash, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    userId,
    profile?.id || null,
    profile?.schema_version || 1,
    snapshotJson,
    snapshotHash,
    now,
  ).run();

  return {
    id,
    brand_profile_id: profile?.id || null,
    snapshot,
    snapshot_hash: snapshotHash,
    created_at: now,
  };
}

/**
 * Renders a brand context snapshot as a labeled Thai text block instead of
 * raw `JSON.stringify` — Content Playbook Upgrade Plan §2 item 8 ("Brand
 * context ถูกส่งเป็น JSON.stringify ดิบ — ควรเป็นบล็อกไทยติดป้ายตามโครง
 * 3 ชั้น"). The 3 layers follow the playbook's role/context/examples split:
 * บทบาท (who this brand is) → บริบท (facts to ground generation, incl. the
 * one persona) → ตัวอย่าง (past posts that worked, the cheapest quality
 * lever for a model that's weak at free-form writing).
 */
export function formatBrandContextBlock(snapshot: any): string {
  if (!snapshot || !snapshot.profile_id) return 'ไม่มีข้อมูลแบรนด์ (ยังไม่ได้เลือก Brand Profile)';

  const lines: string[] = [];

  lines.push('# บทบาทแบรนด์');
  lines.push(`ชื่อธุรกิจ: ${snapshot.name || '-'}`);
  if (snapshot.business_summary) lines.push(`สรุปธุรกิจ: ${snapshot.business_summary}`);
  if (snapshot.tone_of_voice?.length) lines.push(`โทนเสียง: ${snapshot.tone_of_voice.join(', ')}`);

  lines.push('');
  lines.push('# บริบท');
  if (snapshot.audience?.length) lines.push(`กลุ่มเป้าหมาย: ${snapshot.audience.join(', ')}`);
  const p = snapshot.persona;
  if (p?.name) {
    lines.push(`ลูกค้าตัวแทน: ${p.name}${p.age ? ` (${p.age} ปี)` : ''}${p.job ? ` — ${p.job}` : ''}`);
    if (p.daily_life) lines.push(`ชีวิตประจำวัน: ${p.daily_life}`);
    if (p.complaints?.length) lines.push(`คำบ่นที่พบบ่อย: ${p.complaints.join(' / ')}`);
  }
  if (snapshot.content_pillars?.length) lines.push(`ธีมหลักของแบรนด์: ${JSON.stringify(snapshot.content_pillars)}`);
  if (snapshot.offers?.length) lines.push(`ข้อเสนอ/จุดขาย: ${snapshot.offers.join(', ')}`);
  if (snapshot.rules && Object.keys(snapshot.rules).length) lines.push(`กติกาที่ต้องยึด: ${JSON.stringify(snapshot.rules)}`);

  if (snapshot.voice_samples?.length) {
    lines.push('');
    lines.push('# ตัวอย่างโพสต์ที่เคยเวิร์ก (เลียนโทน/จังหวะประโยคนี้)');
    snapshot.voice_samples.forEach((s: string, i: number) => lines.push(`${i + 1}. ${s}`));
  }

  return lines.join('\n');
}

function serializeBrandProfile(row: BrandProfileRow) {
  return {
    id: row.id,
    name: row.name,
    business_summary: row.business_summary,
    audience: parseJson(row.audience_json, []),
    tone_of_voice: parseJson(row.tone_of_voice_json, []),
    content_pillars: parseJson(row.content_pillars_json, []),
    offers: parseJson(row.offers_json, []),
    rules: parseJson(row.rules_json, {}),
    default_reference_asset_ids: parseJson(row.default_reference_asset_ids_json, []),
    persona: row.persona_json ? parseJson(row.persona_json, null) : null,
    voice_samples: row.voice_samples_json ? parseJson(row.voice_samples_json, []) : [],
    schema_version: row.schema_version,
    is_default: row.is_default === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function clearDefaultBrandProfile(env: Pick<Bindings, 'DB'>, userId: string) {
  await env.DB.prepare('UPDATE brand_profiles SET is_default = 0, updated_at = ? WHERE user_id = ?')
    .bind(Date.now(), userId).run();
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
