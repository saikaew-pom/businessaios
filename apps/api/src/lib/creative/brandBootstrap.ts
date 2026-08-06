import type { BrandProfileInput, BrandProfilePersona } from './brandContext';

// Content Playbook Upgrade Plan "ขั้นที่ 1 — Brand Bootstrap + ลูกค้า 1 คน"
// (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §6). Two entry paths produce a DRAFT
// BrandProfileInput — neither path saves anything; the caller shows the draft
// in an editable card and only persists it via the existing
// POST /api/brand-profiles once the user reviews/adjusts and confirms
// ("ปรับ/ยืนยันเป็นการ์ด" in the target user journey, step B).

// -----------------------------------------------------------------------
// Path (ก) — deterministic mapping from an existing wizard plan. No AI call:
// the wizard already spent 4 AI generations producing this data, so this
// path is "แทบไม่ใช้ AI" (barely use AI at all) by just reshaping it.
// -----------------------------------------------------------------------

type WizardPersona = {
  name?: string;
  demographics?: { age?: string; job?: string };
  psychographics?: { values?: string; interests?: string; aspirations?: string };
  pain_points?: string[];
  size_estimate?: string;
};

type WizardStepData = {
  step1?: { positioning?: string; uvp?: string; voice_tone?: string; target_audience?: string };
  step2?: { personas?: WizardPersona[] };
  step3?: { pain_points?: Array<{ pain?: string }> };
  step4?: { uvp_bullets?: string[] };
};

function pickPrimaryPersona(personas: WizardPersona[] | undefined): WizardPersona | undefined {
  if (!personas?.length) return undefined;
  // "ลูกค้า 1 คน" — prefer whichever persona the wizard itself sized as the
  // largest segment (size_estimate is a free-text field like "55% ของลูกค้า",
  // so this is a best-effort parse, not a guarantee); fall back to the first.
  let best = personas[0];
  let bestPct = -1;
  for (const p of personas) {
    const match = p.size_estimate?.match(/(\d+)/);
    const pct = match ? parseInt(match[1], 10) : -1;
    if (pct > bestPct) { best = p; bestPct = pct; }
  }
  return best;
}

function buildDailyLifeSentence(p: WizardPersona): string {
  const parts: string[] = [];
  if (p.demographics?.job) parts.push(`เป็น${p.demographics.job}`);
  if (p.psychographics?.interests) parts.push(`สนใจ${p.psychographics.interests}`);
  if (p.psychographics?.values) parts.push(`ให้ความสำคัญกับ${p.psychographics.values}`);
  if (p.psychographics?.aspirations) parts.push(`อยาก${p.psychographics.aspirations}`);
  return parts.join(' ') || 'ไม่มีข้อมูลเพิ่มเติมจากแผน — แก้ไขเพิ่มได้ที่นี่';
}

/**
 * Builds a persona seed from the wizard's step2/step3 output. Deliberately
 * returns FEWER than 3 complaints if the source data doesn't have enough —
 * this is a draft the user reviews before saving, and
 * `validateBrandProfileInput` (see brandContext.ts) is what enforces exactly
 * 3 at actual save time, prompting the user to fill the gap rather than the
 * mapper silently padding with empty/duplicate strings.
 */
function buildPersonaSeed(stepData: WizardStepData): BrandProfilePersona | undefined {
  const primary = pickPrimaryPersona(stepData.step2?.personas);
  if (!primary) return undefined;

  const complaints: string[] = [...(primary.pain_points || [])];
  if (complaints.length < 3) {
    for (const jp of stepData.step3?.pain_points || []) {
      if (complaints.length >= 3) break;
      if (jp.pain && !complaints.includes(jp.pain)) complaints.push(jp.pain);
    }
  }

  return {
    name: primary.name || 'ลูกค้าตัวแทน',
    age: primary.demographics?.age || '',
    job: primary.demographics?.job || '',
    daily_life: buildDailyLifeSentence(primary),
    complaints: complaints.slice(0, 3) as unknown as [string, string, string],
  };
}

export function mapWizardPlanToBrandDraft(project: { name: string; step_data: string | null }): BrandProfileInput {
  let stepData: WizardStepData = {};
  try { stepData = JSON.parse(project.step_data || '{}'); } catch { /* treat as empty plan */ }

  const step1 = stepData.step1;
  const step4 = stepData.step4;

  return {
    name: project.name || 'แบรนด์ของฉัน',
    business_summary: [step1?.positioning, step1?.uvp].filter(Boolean).join(' — '),
    tone_of_voice: step1?.voice_tone ? [step1.voice_tone] : [],
    audience: step1?.target_audience ? [step1.target_audience] : [],
    offers: step4?.uvp_bullets || [],
    content_pillars: [], // ธีมเสาหลัก is ขั้นที่ 2's job, not bootstrap's
    rules: {},
    default_reference_asset_ids: [],
    voice_samples: [], // no past-post data exists in a wizard plan
    persona: buildPersonaSeed(stepData) || null,
  };
}

// -----------------------------------------------------------------------
// Path (ข) — no wizard plan. 3 short, plain-Thai questions, one AI call
// drafts every field (this path IS the AI-heavy one, unlike (ก)).
// -----------------------------------------------------------------------

export type BootstrapAnswers = {
  business: string; // "ร้านคุณชื่ออะไร ขายอะไร"
  customer: string; // "ลูกค้าหลักของคุณคือใคร"
  complaint: string; // "ลูกค้าบ่นอะไรบ่อยที่สุด ก่อนมาเจอร้านคุณ"
};

export function buildBrandBootstrapPrompt(answers: BootstrapAnswers) {
  const system = `คุณคือ Marketing Strategist ที่มีประสบการณ์ 20 ปีในการสร้าง Brand Profile ให้ SME ไทย
เข้าใจ pain point คนไทย ตลาดไทย และ platform ไทย (Facebook, LINE, TikTok)
ผู้ใช้ตอบคำถามสั้นมากแค่ 3 ข้อ — หน้าที่คุณคือ "ร่างให้ก่อน" ทุกช่องจากข้อมูลน้อยนิดนี้ให้สมเหตุสมผลที่สุด ผู้ใช้จะปรับแก้เองทีหลัง
เขียนแบบชัด กระชับ ใช้ภาษาที่ ป.6 อ่านเข้าใจ ห้ามศัพท์การตลาด/ภาษาอังกฤษปนในค่าที่ส่งกลับ

⚠️ สำคัญ: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma
⚠️ "complaints" ต้องมีสมาชิกเป็นประโยคสั้นแบบคำพูดลูกค้าจริง (verbatim-style) เป๊ะ 3 ประโยคเท่านั้น ห้ามยาวเกิน 1 ประโยคต่อข้อ`;

  const user = `# คำตอบจากผู้ใช้
1. ร้าน/ธุรกิจ: ${answers.business}
2. ลูกค้าหลัก: ${answers.customer}
3. ลูกค้าบ่นอะไรบ่อยที่สุดก่อนมาเจอร้านนี้: ${answers.complaint}

# Output JSON Schema
{
  "name": "ชื่อแบรนด์ (ดึงจากคำตอบข้อ 1)",
  "business_summary": "สรุปธุรกิจ 1-2 ประโยค: ขายอะไร ให้ใคร ต่างจากคนอื่นยังไง",
  "tone_of_voice": ["โทนเสียงแบรนด์ 2-3 คำ เช่น อบอุ่น, จริงใจ, ขี้เล่น"],
  "audience": ["กลุ่มเป้าหมาย บรรยายสั้น ๆ 1-2 ข้อ"],
  "offers": ["จุดขาย/สิ่งที่แบรนด์เสนอให้ลูกค้า 1-3 ข้อ (เดาอย่างสมเหตุสมผลจากบริบท)"],
  "persona": {
    "name": "ชื่อสมมติของลูกค้าตัวแทน 1 คน (เช่น 'พี่หมู')",
    "age": "ช่วงอายุโดยประมาณ",
    "job": "อาชีพโดยประมาณ",
    "daily_life": "ชีวิตประจำวันโดยย่อ 1 ย่อหน้าสั้น ๆ",
    "complaints": ["คำบ่นข้อ 1 ตามที่ผู้ใช้ตอบ", "คำบ่นข้อ 2 ต่อยอดให้สมเหตุสมผล", "คำบ่นข้อ 3 ต่อยอดให้สมเหตุสมผล"]
  }
}`;

  return { system, user };
}

/** Validates the AI's JSON output has the exact shape createBrandProfile needs. Throws on shape mismatch — caller refunds credits and reports parse_error, same convention as regenerate-field. */
export function parseBrandBootstrapOutput(parsed: any): BrandProfileInput {
  if (!parsed || typeof parsed !== 'object') throw new Error('bootstrap_output_not_object');
  if (!parsed.persona || !Array.isArray(parsed.persona.complaints) || parsed.persona.complaints.length !== 3) {
    throw new Error('bootstrap_persona_complaints_invalid');
  }

  return {
    name: typeof parsed.name === 'string' ? parsed.name : 'แบรนด์ของฉัน',
    business_summary: typeof parsed.business_summary === 'string' ? parsed.business_summary : '',
    tone_of_voice: Array.isArray(parsed.tone_of_voice) ? parsed.tone_of_voice : [],
    audience: Array.isArray(parsed.audience) ? parsed.audience : [],
    offers: Array.isArray(parsed.offers) ? parsed.offers : [],
    content_pillars: [],
    rules: {},
    default_reference_asset_ids: [],
    voice_samples: [],
    persona: {
      name: String(parsed.persona.name || 'ลูกค้าตัวแทน'),
      age: String(parsed.persona.age || ''),
      job: String(parsed.persona.job || ''),
      daily_life: String(parsed.persona.daily_life || ''),
      complaints: parsed.persona.complaints.slice(0, 3).map((c: unknown) => String(c || '')) as [string, string, string],
    },
  };
}
