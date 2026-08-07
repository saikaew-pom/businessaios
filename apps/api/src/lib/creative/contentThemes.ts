import { generateId } from '../crypto';
import type { Bindings } from '../types';
import { callMinimax, extractJsonFromAny } from '../minimax';
import { calculateCredits } from '../credit';
import { formatBrandContextBlock } from './brandContext';
import { CONTENT_TYPES, isValidContentType, isValidSeasonalEvent, upcomingSeasonalEvents } from './contentTaxonomy';

// Content Playbook Upgrade Plan ขั้นที่ 2 — ธีมเสาหลัก + Topic Picker
// (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §6).

export type ContentThemeRow = {
  id: string;
  user_id: string;
  brand_profile_id: string;
  name: string;
  reason: string;
  status: 'suggested' | 'confirmed' | 'dismissed';
  created_at: number;
  updated_at: number;
};

export type ContentTopicRow = {
  id: string;
  user_id: string;
  theme_id: string;
  title: string;
  content_type: string;
  seasonal_event: string | null;
  status: 'suggested' | 'used' | 'dismissed';
  used_series_id: string | null;
  created_at: number;
  updated_at: number;
};

// Mirrors sanitizeExistingHooks (contentSeries.ts) exactly — same reasoning:
// flatten to one line (defends against the "- " bullet / prompt-injection
// shape), strip control chars, collapse whitespace, cap length, case-
// insensitive de-dup, cap count. Applied to topic TITLES rather than hooks,
// scoped per-theme (the plan's "history ต่อ pillar") rather than per-project.
const MAX_EXISTING_TOPICS = 60;
const MAX_EXISTING_TOPIC_CHARS = 150;

export function sanitizeExistingTopics(titles: readonly unknown[] | undefined): string[] {
  if (!titles?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    if (typeof raw !== 'string') continue;
    const flat = raw
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_EXISTING_TOPIC_CHARS)
      .trim();
    if (!flat) continue;
    const key = flat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(flat);
    if (out.length >= MAX_EXISTING_TOPICS) break;
  }
  return out;
}

// -----------------------------------------------------------------------
// Theme suggestion — AI proposes 3-5 brand content pillars.
// -----------------------------------------------------------------------

function buildThemeSuggestionPrompt(brandSnapshot: any) {
  const system = `คุณคือ Content Strategist ที่ช่วย SME ไทยวางธีมเสาหลักสำหรับทำ content ต่อเนื่อง
ธีมเสาหลักคือหัวข้อใหญ่ที่ธุรกิจนี้พูดถึงได้ไม่มีวันหมด แยกจาก "ขั้นตอนการขาย" (awareness/education/social proof/conversion) — เป็นคนละแกนกัน
เสนอ 3-5 ธีมที่ตรงกับแบรนด์นี้จริง ๆ ไม่ใช่ธีมทั่วไปที่ใช้กับธุรกิจไหนก็ได้

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`;

  const user = `${formatBrandContextBlock(brandSnapshot)}

# Output JSON Schema
{
  "themes": [
    { "name": "ชื่อธีมสั้น ๆ ภาษาคน", "reason": "ทำไมธีมนี้เหมาะกับแบรนด์นี้ 1 ประโยค" }
  ]
}

⚠️ เสนอ 3-5 ธีม ไม่มากไม่น้อยกว่านี้
⚠️ แต่ละธีมต้องอิงจากบริบทแบรนด์ข้างบนจริง ๆ (ลูกค้าตัวแทน, คำบ่น, จุดขาย) ไม่ใช่ธีมลอย ๆ`;

  return { system, user };
}

export function parseThemeSuggestionOutput(parsed: any): Array<{ name: string; reason: string }> {
  const themes = Array.isArray(parsed?.themes) ? parsed.themes : [];
  const cleaned = themes
    .filter((t: any) => t && typeof t.name === 'string' && t.name.trim())
    .map((t: any) => ({ name: String(t.name).trim().slice(0, 120), reason: String(t.reason || '').trim().slice(0, 300) }));
  if (cleaned.length < 3 || cleaned.length > 5) throw new Error('theme_suggestion_wrong_count');
  return cleaned;
}

export async function callThemeSuggestion(
  env: Pick<Bindings, 'MINIMAX_API_KEY' | 'MINIMAX_GROUP_ID' | 'MINIMAX_MODEL'>,
  brandSnapshot: any,
): Promise<{ themes: Array<{ name: string; reason: string }>; creditsUsed: number; reserveCredits: number }> {
  const { system, user } = buildThemeSuggestionPrompt(brandSnapshot);
  const maxTokens = 4000; // title+reason only, no captions — kept small on purpose
  const estPromptTokens = Math.ceil((system.length + user.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxTokens });

  const result = await callMinimax(
    { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
    [
      { role: 'system', content: system + '\n\n🚫 ห้าม reasoning หรือคิดออกเสียง — ตอบ JSON object เท่านั้นใน content field' },
      { role: 'user', content: user + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น ไม่ต้องคิดออกเสียง ไม่ต้องอธิบาย]' },
    ],
    { maxTokens, temperature: 0.8, jsonMode: true },
  );

  const parsed = extractJsonFromAny(result.content, result.reasoning);
  const themes = parseThemeSuggestionOutput(parsed);
  const creditsUsed = calculateCredits(result.usage);
  return { themes, creditsUsed, reserveCredits };
}

// -----------------------------------------------------------------------
// Topic suggestion — 8-12 title+tag cards per theme. Never a caption.
// -----------------------------------------------------------------------

function buildTopicSuggestionPrompt(params: {
  themeName: string;
  themeReason: string;
  brandSnapshot: any;
  existingTitles: string[];
  nowMonth: number;
}) {
  const existingTitles = sanitizeExistingTopics(params.existingTitles);
  const upcoming = upcomingSeasonalEvents(params.nowMonth, 2);
  const typeList = CONTENT_TYPES.map((t) => `${t.key} = ${t.label} (${t.group})`).join('\n');

  const system = `คุณคือ Content Strategist ที่ช่วยคิด "หัวข้อโพสต์" ให้ SME ไทย ไม่ใช่เขียนโพสต์เต็ม
งานของคุณคือคิดชื่อเรื่องสั้น ๆ ที่ทำเป็นโพสต์ได้จริง พร้อมติด tag ประเภทเนื้อหา — ห้ามเขียนเนื้อหาโพสต์เต็ม ห้ามมี caption

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma
⚠️ "content_type" ต้องเป็นค่าจากลิสต์นี้เท่านั้น (ใช้ค่าซ้ายมือ เช่น "tips" ไม่ใช่ "เคล็ดลับ"):
${typeList}`;

  const user = `${formatBrandContextBlock(params.brandSnapshot)}

# ธีมที่กำลังคิดหัวข้อให้
${params.themeName} — ${params.themeReason}

${upcoming.length ? `# เทศกาล/ช่วงที่ใกล้ถึง (ใช้ถ้าเข้ากับธีมนี้จริง ๆ เท่านั้น ไม่ต้องยัดทุกหัวข้อ)
${upcoming.map((e) => `${e.key} = ${e.name}`).join('\n')}
` : ''}${existingTitles.length ? `# หัวข้อที่เคยเสนอไปแล้วสำหรับธีมนี้ (ห้ามซ้ำ ห้ามคล้ายกันมาก)
${existingTitles.map((t) => `- ${t}`).join('\n')}
` : ''}
# Output JSON Schema
{
  "topics": [
    { "title": "ชื่อหัวข้อสั้น ๆ ทำเป็นโพสต์ได้จริง", "content_type": "ค่าจากลิสต์ประเภทด้านบน", "seasonal_event": "key จากลิสต์เทศกาล หรือ null ถ้าไม่เกี่ยว" }
  ]
}

⚠️ เสนอ 8-12 หัวข้อ
⚠️ กระจายให้ครบหลายประเภท ไม่กระจุกอยู่ประเภทเดียว
⚠️ ทุกหัวข้อต้องเกี่ยวกับธีมนี้จริง ๆ${existingTitles.length ? '\n⚠️ ห้ามซ้ำกับหัวข้อที่เคยเสนอไปแล้วข้างบนเด็ดขาด' : ''}`;

  return { system, user };
}

export function parseTopicSuggestionOutput(parsed: any): Array<{ title: string; content_type: string; seasonal_event: string | null }> {
  const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
  const cleaned = topics
    .filter((t: any) => t && typeof t.title === 'string' && t.title.trim() && isValidContentType(t.content_type))
    .map((t: any) => ({
      title: String(t.title).trim().slice(0, 200),
      content_type: t.content_type,
      seasonal_event: isValidSeasonalEvent(t.seasonal_event) ? t.seasonal_event : null,
    }));
  if (cleaned.length < 4) throw new Error('topic_suggestion_too_few'); // model drifted badly — below half the requested minimum
  return cleaned;
}

export async function callTopicSuggestion(
  env: Pick<Bindings, 'MINIMAX_API_KEY' | 'MINIMAX_GROUP_ID' | 'MINIMAX_MODEL'>,
  params: { themeName: string; themeReason: string; brandSnapshot: any; existingTitles: string[]; nowMonth: number },
): Promise<{ topics: Array<{ title: string; content_type: string; seasonal_event: string | null }>; creditsUsed: number; reserveCredits: number }> {
  const { system, user } = buildTopicSuggestionPrompt(params);
  // 6000 truncated in live testing once the de-dup history list grew (>10
  // existing titles injected into the prompt) — "No JSON found in content or
  // reasoning" from a genuinely empty response. MiniMax-M3's reasoning
  // overhead scales with prompt complexity, not just requested output
  // length (same trap documented in contentRoutes.ts's regenerate-field and
  // contentSeries.ts's MAX_SERIES_COUNT comments). 12000 is the budget
  // already proven reliable elsewhere in this codebase for the same
  // reasoning-model behavior.
  const maxTokens = 12000;
  const estPromptTokens = Math.ceil((system.length + user.length) / 3);
  const reserveCredits = calculateCredits({ prompt_tokens: estPromptTokens, completion_tokens: maxTokens });

  const result = await callMinimax(
    { apiKey: env.MINIMAX_API_KEY, groupId: env.MINIMAX_GROUP_ID, model: env.MINIMAX_MODEL },
    [
      { role: 'system', content: system + '\n\n🚫 ห้าม reasoning หรือคิดออกเสียง — ตอบ JSON object เท่านั้นใน content field' },
      { role: 'user', content: user + '\n\n[ตอบเป็น JSON object ใน content field เท่านั้น ไม่ต้องคิดออกเสียง ไม่ต้องอธิบาย]' },
    ],
    { maxTokens, temperature: 0.85, jsonMode: true },
  );

  const parsed = extractJsonFromAny(result.content, result.reasoning);
  const topics = parseTopicSuggestionOutput(parsed);
  const creditsUsed = calculateCredits(result.usage);
  return { topics, creditsUsed, reserveCredits };
}

export function serializeTheme(row: ContentThemeRow) {
  return {
    id: row.id,
    brand_profile_id: row.brand_profile_id,
    name: row.name,
    reason: row.reason,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeTopic(row: ContentTopicRow) {
  return {
    id: row.id,
    theme_id: row.theme_id,
    title: row.title,
    content_type: row.content_type,
    seasonal_event: row.seasonal_event,
    status: row.status,
    used_series_id: row.used_series_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
