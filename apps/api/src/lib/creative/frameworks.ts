/**
 * Framework Engine — Content Playbook Upgrade Plan ขั้นที่ 4.
 *
 * Same split as visualPrompt.ts's slot pipeline (see that file's doc comment):
 * MiniMax-M3 is weak at open-ended structure/length judgment, so the STRUCTURE
 * of each post (which beats it hits, how long it runs) is decided here in
 * deterministic code, not left to the model. The model still writes every
 * sentence — this file only tells it, per item, "what shape to fill in Thai."
 *
 * Two independent axes, resolved differently on purpose:
 *  - pillar → framework is a CODE-side rotation (resolveFramework below). The
 *    plan is explicit this must not be "a rule the model follows" — it's a
 *    fixed weighted default so a whole series doesn't accidentally skew
 *    all-education or all-promo depending on model mood.
 *  - the 2-of-5 headline angle is the MODEL's creative choice per item
 *    (which pair of angles best fits this specific hook) — code only
 *    validates the shape afterward (see parseHeadlineAngles), the same
 *    "model does judgment, code does structure" split as the rest of this
 *    file.
 */

export type Framework = 'how_to' | 'story_5_beat' | 'mindset_tips' | 'mindset_do_dont' | 'mindset_stat_fact';

export const FRAMEWORK_SPEC: Record<Framework, { label: string; structure: string; lengthHint: string }> = {
  how_to: {
    label: 'How-to',
    structure: 'ปัญหา 1 ประโยค → ขั้นตอนทำจริง 3-4 ข้อ (สั้น ทำตามได้ทันที) → ผลลัพธ์ที่ได้ 1 ประโยค',
    lengthHint: '4-7 บรรทัด',
  },
  story_5_beat: {
    label: 'เรื่องเล่า 5 จังหวะ',
    structure: 'เริ่ม (ฉากตั้งต้น) → อุปสรรค (ปัญหาที่เจอ) → ดิ้นรน (พยายามแก้) → จุดเปลี่ยน (สิ่งที่เปลี่ยนสถานการณ์) → ผลลัพธ์ (จบแบบเป็นรูปธรรม)',
    lengthHint: '5-8 บรรทัด',
  },
  mindset_tips: {
    label: 'Mindset — Tips',
    structure: 'มุมมอง/ความเชื่อ 1 ประโยค ตามด้วยทิปสั้น 2-3 ข้อที่หนุนมุมมองนั้น',
    lengthHint: '3-5 บรรทัด',
  },
  mindset_do_dont: {
    label: "Mindset — Do/Don't",
    structure: '"อย่าทำแบบนี้" 1-2 ข้อ ตามด้วย "ควรทำแบบนี้" 1-2 ข้อ เทียบกันให้ชัด',
    lengthHint: '3-5 บรรทัด',
  },
  mindset_stat_fact: {
    label: 'Mindset — Stat/Fact',
    structure: 'ตัวเลขหรือข้อเท็จจริงที่น่าสนใจ 1 จุด ตามด้วยความหมายต่อผู้อ่าน 1-2 ประโยค',
    lengthHint: '3-4 บรรทัด',
  },
};

export const HEADLINE_ANGLES = [
  { key: 'result', label: 'ผลลัพธ์', hint: 'บอกผลลัพธ์ที่จะได้ตรง ๆ' },
  { key: 'question', label: 'คำถาม', hint: 'ตั้งคำถามที่คนอ่านอยากรู้คำตอบ' },
  { key: 'problem', label: 'ปัญหา', hint: 'พูดปัญหาที่คนอ่านเจอตรง ๆ' },
  { key: 'time', label: 'เวลา', hint: 'ใส่กรอบเวลา (กี่นาที/กี่วัน)' },
  { key: 'unlikely', label: 'เงื่อนไขไม่น่าเป็นไปได้', hint: 'สถานการณ์ที่ฟังดูเหลือเชื่อแต่เป็นจริง' },
] as const;

export type HeadlineAngleKey = (typeof HEADLINE_ANGLES)[number]['key'];
const HEADLINE_ANGLE_KEYS = new Set<string>(HEADLINE_ANGLES.map((a) => a.key));

/**
 * Which frameworks a pillar draws from, and in what order — the "weighted
 * default หมุนในโค้ด" the plan asks for. Only `education` has an explicit
 * mapping in the plan text ({How-to, Tips, Do-Don't, Stat/Fact}); the rest
 * are this implementation's product judgment, chosen to fit each pillar's
 * existing hook_style intent (see contentSeries.ts's old DEFAULT_SLOTS) and
 * documented here rather than silently guessed, in case the mapping needs
 * revisiting later.
 */
const PILLAR_FRAMEWORK_ROTATION: Record<string, Framework[]> = {
  education: ['how_to', 'mindset_tips', 'mindset_do_dont', 'mindset_stat_fact'],
  awareness: ['story_5_beat', 'mindset_tips'],
  engagement: ['mindset_tips', 'mindset_stat_fact'],
  social_proof: ['story_5_beat', 'mindset_stat_fact'],
  conversion: ['mindset_do_dont', 'how_to'],
};

/**
 * Resolves the framework for one slot. An explicit `framework` on the slot
 * (set by DEFAULT_SLOTS below, or by a user/admin editing a template) always
 * wins. Otherwise it's derived from the slot's pillar, cycling through that
 * pillar's rotation by the slot's position — deterministic, so the same
 * template always produces the same framework sequence, but older
 * user-authored templates (saved before this engine existed, with only
 * pillar/hook_style/cta_style) still get framework-driven structure for free
 * instead of falling back to no structure at all.
 */
export function resolveFramework(pillar: string | undefined, slotPosition: number, explicit?: string): Framework {
  if (explicit && explicit in FRAMEWORK_SPEC) return explicit as Framework;
  const candidates = PILLAR_FRAMEWORK_ROTATION[pillar || ''] || PILLAR_FRAMEWORK_ROTATION.education;
  return candidates[slotPosition % candidates.length];
}

/**
 * A pillar+framework rotation approximating the plan's monthly target mix
 * (education 40% / awareness 25% / engagement 15% / social_proof 10% /
 * conversion 10%) — compressed to fit within MAX_SERIES_COUNT (7), since a
 * single generation call never draws past its own requested_count and the
 * plan's ratios are stated as a monthly average, not a per-call rule. Every
 * pillar still appears at least once so a single batch of 7 never fully
 * skips one funnel stage (unlike the raw percentages, which would round
 * social_proof/conversion down to zero at this small a sample).
 */
export const DEFAULT_PILLAR_ROTATION: Array<{ pillar: string; framework: Framework }> = [
  { pillar: 'education', framework: 'how_to' },
  { pillar: 'awareness', framework: 'story_5_beat' },
  { pillar: 'education', framework: 'mindset_tips' },
  { pillar: 'engagement', framework: 'mindset_stat_fact' },
  { pillar: 'social_proof', framework: 'story_5_beat' },
  { pillar: 'awareness', framework: 'mindset_tips' },
  { pillar: 'conversion', framework: 'mindset_do_dont' },
];

/** Pillars whose posts should lead with a real customer complaint when the brand has persona data. */
const COMPLAINT_DRIVEN_PILLARS = new Set(['awareness', 'social_proof']);

/** Whether a pillar's posts should lead with a real customer complaint — exported so callers can track their own occurrence counter (see renderSlotLine's `complaintOccurrence` param) without duplicating this set. */
export function isComplaintDrivenPillar(pillar: string | undefined): boolean {
  return COMPLAINT_DRIVEN_PILLARS.has(pillar || '');
}

/**
 * Renders one slot's instruction line for the prompt: pillar, framework
 * structure, expected length, cta hint, and — for complaint-driven pillars —
 * which of the persona's 3 real complaints to open with. This replaces the
 * old raw `JSON.stringify(slots)` dump so the model gets the framework's
 * structure/length explicitly instead of inferring it from a bare label.
 *
 * `index` and `complaintOccurrence` are deliberately separate counters.
 * `index` is the item's absolute position in the batch — the correct basis
 * for framework rotation, since it must stay stable regardless of how many
 * other pillars come before it. Cycling complaints by that same `index`
 * would collide whenever two complaint-driven slots land a multiple of
 * `complaints.length` apart (e.g. positions 1 and 4 with 3 complaints both
 * resolve to index 1) — silently repeating a complaint within one batch
 * instead of varying it. `complaintOccurrence` counts only complaint-driven
 * slots seen so far, so consecutive occurrences always advance.
 */
export function renderSlotLine(
  index: number,
  slot: { pillar?: string; framework?: string; hook_style?: string; cta_style?: string },
  complaints: string[] | undefined,
  complaintOccurrence: number,
): string {
  const framework = resolveFramework(slot.pillar, index, slot.framework);
  const spec = FRAMEWORK_SPEC[framework];
  const parts = [
    `[slot ${index}] pillar=${slot.pillar || 'education'}`,
    `framework=${spec.label}`,
    `โครงสร้าง: ${spec.structure}`,
    `ความยาว: ${spec.lengthHint}`,
  ];
  if (slot.cta_style) parts.push(`cta แนวทาง: ${slot.cta_style}`);
  if (complaints?.length && isComplaintDrivenPillar(slot.pillar)) {
    const complaint = complaints[complaintOccurrence % complaints.length];
    if (complaint) parts.push(`เปิดด้วยคำบ่นนี้ถ้าเข้ากับหัวข้อ: "${complaint}"`);
  }
  return parts.join(' | ');
}

/**
 * Validates a model-returned headline-angle pair. Never throws — an invalid
 * or missing pair degrades to an empty array (the item still has its `hook`
 * text either way; this field is metadata about which angles it leans on,
 * not the hook itself) rather than failing a series the user already paid
 * for, matching this codebase's established never-throw-after-payment rule
 * for post-generation validation (see callVisualSlotGeneration).
 */
export function parseHeadlineAngles(value: unknown): HeadlineAngleKey[] {
  if (!Array.isArray(value)) return [];
  const unique = Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && HEADLINE_ANGLE_KEYS.has(v))));
  return unique.slice(0, 2) as HeadlineAngleKey[];
}

export const HEADLINE_ANGLES_PROMPT_BLOCK = HEADLINE_ANGLES.map((a) => `${a.key} (${a.label}): ${a.hint}`).join('\n');
