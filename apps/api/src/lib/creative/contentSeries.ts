import { generateId } from '../crypto';
import type { Bindings } from '../types';
import { callMinimax, extractJsonFromAny } from '../minimax';
import { calculateCredits } from '../credit';

export const MAX_SERIES_COUNT = 30;
export const MIN_SERIES_COUNT = 1;

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
}) {
  const { topic, count, slots, platforms, brandSnapshot } = params;
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

# Slot rotation (เรียงตามลำดับ ให้แต่ละ item ใช้ slot ตาม index ที่กำหนด)
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
      "visual_suggestion": "คำอธิบายภาพ 1 บรรทัด"
    }
  ]
}

⚠️ สร้าง ${count} items พอดี (slot_index ไล่จาก 0 ถึง ${count - 1})
⚠️ แต่ละ item ต้องใช้ slot ตาม index ที่กำหนดใน slot rotation ข้างบน (วนซ้ำถ้าจำนวน slot น้อยกว่า item)
⚠️ hashtag ไม่เกิน 5 ตัว ต่อ item
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
  params: { topic: string; count: number; slots: SeriesSlot[]; platforms: string[]; brandSnapshot: any },
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
