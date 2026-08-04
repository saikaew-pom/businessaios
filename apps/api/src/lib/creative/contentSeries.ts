import { generateId } from '../crypto';
import type { Bindings } from '../types';
import { callMinimax, extractJsonFromAny } from '../minimax';
import { calculateCredits } from '../credit';
import { assembleVisualPrompt, buildVisualSlotBatchPrompt, type VisualSlotBatchItem } from './visualPrompt';

// Measured ceiling, not an arbitrary cap: MiniMax-M3 spends an unbounded
// amount of its completion budget on internal reasoning before writing the
// answer, and past ~7 posts that reasoning eats the budget and the JSON comes
// back truncated (verified live — 7 succeeds, 8 and 12 both fail with
// finish_reason 'length'). Advertising 30 just charged users for a request
// that could not succeed. Bigger calendars are built by running several
// batches; each one is told what the previous ones already covered.
export const MAX_SERIES_COUNT = 7;
export const MIN_SERIES_COUNT = 1;

// How much "already covered" context the copy pass is allowed to carry, and
// the row limit the route reads with. Deliberately small: this is PROMPT
// budget on a call whose COMPLETION budget is already at its measured ceiling
// (see MAX_SERIES_COUNT), so it must not be able to grow without bound.
export const MAX_EXISTING_HOOKS = 40;
// A hook is spec'd at "1 ประโยค ไม่เกิน 100 ตัวอักษร" (contentRoutes.ts), but
// nothing enforces that: PATCH /api/content-items accepts up to 5000 chars for
// any text field, and the generator writes model output through unclamped.
const MAX_EXISTING_HOOK_CHARS = 120;

/**
 * Existing hooks are untrusted, user-editable free text that gets
 * interpolated straight into the prompt, so they are normalised before they
 * ever reach it:
 *
 *  - flattened to a single line (a hook may legally contain newlines, and a
 *    multi-line one would break out of the "- " bullet list and could forge
 *    its own "# section" / "⚠️ rule" inside the user message);
 *  - control characters stripped, whitespace collapsed;
 *  - truncated per hook and capped in count, so 40 maxed-out 5000-char hooks
 *    cannot add ~66k tokens of prompt to a call that is already near its
 *    token ceiling (which would inflate the true-up charge and can fail the
 *    whole series);
 *  - de-duplicated, since repeats spend tokens to say the same thing.
 */
export function sanitizeExistingHooks(hooks: readonly unknown[] | undefined): string[] {
  if (!hooks?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hooks) {
    if (typeof raw !== 'string') continue;
    const flat = raw
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_EXISTING_HOOK_CHARS)
      .trim();
    if (!flat) continue;
    const key = flat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(flat);
    if (out.length >= MAX_EXISTING_HOOKS) break;
  }
  return out;
}

export type SeriesSlot = {
  pillar?: string;
  hook_style?: string;
  cta_style?: string;
  notes?: string;
};

export type ContentSeriesTemplateRow = {
  id: string;
  owner_type: 'admin' | 'user';
  owner_user_id: string | null;
  name: string;
  description: string;
  slots_json: string;
  default_platforms_json: string;
  is_active: number;
  created_at: number;
  updated_at: number;
};

export type ContentSeriesRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  template_id: string | null;
  brand_profile_id: string | null;
  brand_snapshot_id: string | null;
  topic: string;
  requested_count: number;
  cadence_days: number;
  start_date: number | null;
  platforms_json: string;
  status: 'queued' | 'generating' | 'completed' | 'partial' | 'failed';
  generated_count: number;
  credits_used: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

export type SeriesGenerationInput = {
  topic: string;
  requested_count: number;
  cadence_days?: number;
  start_date?: number;
  template_id?: string | null;
  brand_profile_id?: string | null;
  project_id?: string | null;
  platforms?: string[];
};

const DEFAULT_SLOTS: SeriesSlot[] = [
  { pillar: 'awareness', hook_style: 'ตั้งคำถามชวนคิด', cta_style: 'กดลิงก์/ทักแชท' },
  { pillar: 'education', hook_style: 'ให้ความรู้/เทคนิค', cta_style: 'บันทึกไว้อ่านทีหลัง' },
  { pillar: 'social_proof', hook_style: 'เล่าเคสจริง/รีวิว', cta_style: 'ทักแชทสอบถาม' },
  { pillar: 'conversion', hook_style: 'โปรโมชัน/ข้อเสนอ', cta_style: 'สั่งซื้อ/จองเลย' },
];
const DEFAULT_PLATFORMS = ['facebook', 'instagram'];

export function validateSeriesInput(input: SeriesGenerationInput) {
  const errors: string[] = [];
  if (!input.topic?.trim()) errors.push('topic_required');
  if (input.topic && input.topic.length > 500) errors.push('topic_too_long');
  if (!Number.isInteger(input.requested_count) || input.requested_count < MIN_SERIES_COUNT || input.requested_count > MAX_SERIES_COUNT) {
    errors.push(`requested_count_must_be_between_${MIN_SERIES_COUNT}_and_${MAX_SERIES_COUNT}`);
  }
  if (input.cadence_days !== undefined && (!(input.cadence_days > 0) || input.cadence_days > 30)) {
    errors.push('cadence_days_must_be_between_0_and_30');
  }
  if (input.platforms !== undefined && !Array.isArray(input.platforms)) errors.push('platforms_must_be_array');
  // Type-check before the value ever reaches a .bind() — a non-string
  // project_id (e.g. `{}` from a hand-rolled client) otherwise blows up
  // inside D1's parameter binding and surfaces as a raw 500 internal_error
  // with the driver's message, instead of a 400 the caller can act on.
  if (input.project_id !== undefined && input.project_id !== null && typeof input.project_id !== 'string') {
    errors.push('project_id_must_be_string');
  }
  return { ok: errors.length === 0, errors };
}

function parseJson(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function getVisibleTemplates(env: Pick<Bindings, 'DB'>, userId: string): Promise<ContentSeriesTemplateRow[]> {
  const rows = await env.DB.prepare(`
    SELECT * FROM content_series_templates
    WHERE is_active = 1 AND (owner_type = 'admin' OR owner_user_id = ?)
    ORDER BY owner_type ASC, created_at DESC
  `).bind(userId).all<ContentSeriesTemplateRow>();
  return rows.results || [];
}

export async function getTemplateForUser(env: Pick<Bindings, 'DB'>, userId: string, templateId: string): Promise<ContentSeriesTemplateRow | null> {
  const row = await env.DB.prepare(`
    SELECT * FROM content_series_templates
    WHERE id = ? AND is_active = 1 AND (owner_type = 'admin' OR owner_user_id = ?)
  `).bind(templateId, userId).first<ContentSeriesTemplateRow>();
  return row || null;
}

function buildSeriesPrompt(params: {
  topic: string;
  count: number;
  slots: SeriesSlot[];
  platforms: string[];
  brandSnapshot: any;
  existingHooks?: string[];
}) {
  const { topic, count, slots, platforms, brandSnapshot } = params;
  // Sanitised here rather than at the call site so every caller gets it — this
  // string goes straight into the prompt and the rows behind it are editable
  // free text (see sanitizeExistingHooks).
  const existingHooks = sanitizeExistingHooks(params.existingHooks);
  const system = `คุณคือ Content Strategist ที่เขียน content series ให้ SME ไทยจากหัวข้อเดียว
เข้าใจ platform ไทย, ภาษาไทย, คนไทย
caption กระชับ ไม่เกิน 4-5 บรรทัด
hook ทำให้คนหยุด scroll
ทุกชิ้นต้องพูดถึงหัวข้อเดียวกัน แต่เล่ามุมต่างกัน ห้ามซ้ำเนื้อหากัน

⚠️ สำคัญมาก: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ ต้องมี ${count} items ใน array "items" เท่านั้น (เท่ากับจำนวนที่ขอพอดี)
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`;

  const user = `# หัวข้อ (Topic)
${topic}

# Brand context
${JSON.stringify(brandSnapshot || {})}

${existingHooks.length ? `# มุมที่เคยเขียนไปแล้ว (ห้ามซ้ำ)
โพสต์เหล่านี้อยู่ในปฏิทินของธุรกิจนี้แล้ว ห้ามเขียนซ้ำมุมเดิม ประเด็นเดิม หรือ hook ที่สื่อความหมายเดียวกัน — ให้หามุมใหม่ที่ยังไม่เคยพูดถึง
${existingHooks.map((h) => `- ${h}`).join('\n')}

` : ''}# Slot rotation (เรียงตามลำดับ ให้แต่ละ item ใช้ slot ตาม index ที่กำหนด)
${JSON.stringify(slots)}

# Platforms หมุนเวียน
${JSON.stringify(platforms)}

# Output JSON Schema
{
  "items": [
    {
      "slot_index": 0,
      "pillar": "awareness | education | social_proof | conversion",
      "platform": "facebook | instagram | line | tiktok",
      "hook": "ประโยค hook 1 บรรทัด หยุด scroll ได้",
      "caption": "caption 3-5 บรรทัด ภาษาไทย",
      "cta": "กดลิงก์ / ทักแชท / แชร์ / บันทึก",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "visual_suggestion": "คำอธิบายภาพ 1 บรรทัด — บรรยายเฉพาะสิ่งที่เห็นในภาพ (ฉาก คน สิ่งของ มุมกล้อง แสง สี อารมณ์) ห้ามระบุตัวอักษร ข้อความ ป้าย ปุ่ม โลโก้ หรือราคาในภาพ"
    }
  ]
}

⚠️ สร้าง ${count} items พอดี (slot_index ไล่จาก 0 ถึง ${count - 1})
⚠️ แต่ละ item ต้องใช้ slot ตาม index ที่กำหนดใน slot rotation ข้างบน (วนซ้ำถ้าจำนวน slot น้อยกว่า item)
⚠️ hashtag ไม่เกิน 5 ตัว ต่อ item${existingHooks.length ? '\n⚠️ ห้ามซ้ำมุมกับ "มุมที่เคยเขียนไปแล้ว" ข้างบนเด็ดขาด ทุก item ต้องเป็นมุมใหม่' : ''}
⚠️ visual_suggestion ต้องบรรยายภาพล้วน ๆ ห้ามมีตัวอักษร/ข้อความ/ป้าย/ปุ่ม/โลโก้/ราคาในภาพ (AI วาดตัวหนังสือไทยไม่ได้ — หัวข้อกับ CTA จะถูกใส่ทีหลังด้วยเครื่องมือแยก)
⚠️ ทุก field ต้องมี ไม่เว้นว่าง
⚠️ JSON valid — ไม่มี comment, ไม่มี trailing comma`;

  return { system, user };
}

export type SeriesItemResult = {
  slot_index: number;
  pillar: string;
  platform: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visual_suggestion: string;
};

/**
 * Reserve-then-reconcile credit flow, mirroring the wizard step-generation
 * route in index.ts — one MiniMax call produces all N items together so the
 * series reads as one coherent narrative instead of N unrelated posts.
 */
export async function callSeriesGeneration(
  env: Pick<Bindings, 'MINIMAX_API_KEY' | 'MINIMAX_GROUP_ID' | 'MINIMAX_MODEL'>,
  params: { topic: string; count: number; slots: SeriesSlot[]; platforms: string[]; brandSnapshot: any; existingHooks?: string[] },
): Promise<{ items: SeriesItemResult[]; creditsUsed: number; reserveCredits: number; usage: any }> {
  const { system, user } = buildSeriesPrompt(params);
  const maxCompletionTokens = Math.min(24000, 700 * params.count + 2000);
  const estPromptTokens = Math.ceil((system.length + user.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxCompletionTokens });

  const result = await callMinimax(
    { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
    [
      { role: 'system', content: system + '\n\n🚫 ห้าม reasoning หรือคิดออกเสียง — ตอบ JSON object เท่านั้นใน content field' },
      { role: 'user', content: user + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น ไม่ต้องคิดออกเสียง ไม่ต้องอธิบาย]' },
    ],
    { maxTokens: maxCompletionTokens, temperature: 0.8, jsonMode: true },
  );

  const parsed = extractJsonFromAny(result.content, result.reasoning);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (!items.length) throw new Error('series_generation_empty_output');

  const creditsUsed = calculateCredits(result.usage);
  return { items, creditsUsed, reserveCredits, usage: result.usage };
}

/**
 * Second pass over a freshly generated series: turn each post's copy into
 * real art direction via the slot pipeline (see lib/creative/visualPrompt.ts).
 *
 * Deliberately separate from callSeriesGeneration rather than folded into its
 * prompt: that call already asks for 5 copy fields per post and is the
 * expensive one, and pushing art-direction slots into it would both bloat an
 * output already near its token ceiling and re-introduce the free-form
 * "describe the image" task the slot pipeline exists to avoid.
 *
 * NEVER THROWS. By the time this runs the copy has been generated and the
 * user has already been charged for it — a failure here must degrade to the
 * copy pass's own one-line visual_suggestion, not lose the whole series.
 * Chunked for the same reason: one truncated response costs a chunk's worth
 * of art direction instead of the entire month's.
 */
const VISUAL_SLOT_CHUNK_SIZE = 10;

export async function callVisualSlotGeneration(
  env: Pick<Bindings, 'MINIMAX_API_KEY' | 'MINIMAX_GROUP_ID' | 'MINIMAX_MODEL'>,
  items: VisualSlotBatchItem[],
): Promise<{ prompts: Map<number, string>; creditsUsed: number }> {
  const prompts = new Map<number, string>();
  let creditsUsed = 0;
  if (!items.length) return { prompts, creditsUsed };

  const chunks: VisualSlotBatchItem[][] = [];
  for (let i = 0; i < items.length; i += VISUAL_SLOT_CHUNK_SIZE) {
    chunks.push(items.slice(i, i + VISUAL_SLOT_CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map(async (chunk) => {
    try {
      // Inside the try, not above it: anything that escapes this callback
      // rejects the Promise.all and breaks the never-throws contract, which
      // would lose a series the user has already paid for.
      const { system, user } = buildVisualSlotBatchPrompt(chunk);
      const result = await callMinimax(
        { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
        [
          { role: 'system', content: system },
          { role: 'user', content: `${user}\n\n[ตอบเป็น JSON object เท่านั้น ไม่ต้องอธิบาย]` },
        ],
        // Budgeted against MiniMax-M3's reasoning overhead, which is not
        // proportional to the (short) answer — the same trap that made a
        // 300-token budget return nothing at all on the single-item route.
        { maxTokens: 6000, temperature: 0.7, jsonMode: true },
      );
      const parsed = extractJsonFromAny(result.content, result.reasoning);
      const rows = Array.isArray(parsed?.items) ? parsed.items : [];
      const valid = new Set(chunk.map((c) => c.index));
      const built: Array<[number, string]> = [];
      for (const row of rows) {
        const index = Number(row?.i);
        // Only accept indexes we actually asked for — a hallucinated index
        // would otherwise overwrite an unrelated post's art direction.
        if (!Number.isInteger(index) || !valid.has(index)) continue;
        built.push([index, assembleVisualPrompt(row)]);
      }
      return { built, credits: calculateCredits(result.usage) };
    } catch (err) {
      console.error('Visual slot batch failed (falling back to plain visual_suggestion):', err);
      return { built: [] as Array<[number, string]>, credits: 0 };
    }
  }));

  for (const result of results) {
    for (const [index, prompt] of result.built) prompts.set(index, prompt);
    creditsUsed += result.credits;
  }
  return { prompts, creditsUsed };
}

export function resolveSlots(template: ContentSeriesTemplateRow | null): SeriesSlot[] {
  if (!template) return DEFAULT_SLOTS;
  const slots = parseJson(template.slots_json, []) as SeriesSlot[];
  return Array.isArray(slots) && slots.length ? slots : DEFAULT_SLOTS;
}

export function resolvePlatforms(template: ContentSeriesTemplateRow | null, requested?: string[]): string[] {
  if (requested?.length) return requested;
  if (template) {
    const platforms = parseJson(template.default_platforms_json, []) as string[];
    if (Array.isArray(platforms) && platforms.length) return platforms;
  }
  return DEFAULT_PLATFORMS;
}

export function serializeSeriesTemplate(row: ContentSeriesTemplateRow) {
  return {
    ...row,
    slots: parseJson(row.slots_json, []),
    default_platforms: parseJson(row.default_platforms_json, []),
    slots_json: undefined,
    default_platforms_json: undefined,
    is_active: !!row.is_active,
  };
}

export function serializeSeries(row: ContentSeriesRow) {
  return {
    ...row,
    platforms: parseJson(row.platforms_json, []),
    platforms_json: undefined,
  };
}

export { generateId };
