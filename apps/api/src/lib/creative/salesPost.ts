/**
 * Sales Post Engine — Content Playbook Upgrade Plan ขั้นที่ 5 ("โพสต์ขาย 15 ขั้น").
 *
 * The plan's own cited source (`18-AI-Content-Writing-Playbook.md`) does not
 * exist anywhere in this repo — same gap already hit and disclosed at ขั้นที่ 2
 * (see contentTaxonomy.ts's doc comment and CONTENT_PLAYBOOK_UPGRADE_PLAN.md's
 * ขั้นที่ 2 status note). The 15 named blocks below are this implementation's
 * own draft of a direct-response sales-post checklist, adapted to the plan's
 * explicit rules (skip a block rather than invent its facts; frame a
 * "tried before" objection as a method, never a competitor's name) — not a
 * transcription of a real external source. If a real 15-step list surfaces
 * later, only BLOCKS below needs to change; the skip/include machinery and
 * the route stay the same.
 *
 * Same "code decides structure, model writes sentences" split as
 * frameworks.ts and visualPrompt.ts: which of the 15 blocks are even
 * eligible for this specific post is a plain boolean check in code (does the
 * caller's input contain real data for it), not a judgment call handed to
 * MiniMax — the plan is explicit that a hallucinated price/guarantee is a
 * "Trust cliff" failure (CONTENT_PLAYBOOK_UPGRADE_PLAN.md's risk list item 7),
 * not a stylistic nitpick.
 */

export type SalesPostInput = {
  topic: string;
  price?: string;
  promo?: string;
  guarantee?: string;
  channel?: string;
  social_proof?: string;
};

/**
 * Optional fact fields are meant to hold a short, single fact (a price line,
 * a promo blurb, a one-line guarantee, a channel handle, a short review
 * quote) — not free-form prose. Unlike `topic`, nothing upstream caps their
 * length before they land verbatim in the prompt (see `buildSalesPostPrompt`'s
 * `{value}` substitution), so an unbounded field is a direct token-budget
 * hole of the same kind `sanitizeExistingHooks`'s `MAX_EXISTING_HOOK_CHARS`
 * exists to prevent for hooks in contentSeries.ts.
 */
export const MAX_SALES_POST_FACT_CHARS = 300;

const OPTIONAL_FACT_FIELDS = ['price', 'promo', 'guarantee', 'channel', 'social_proof'] as const;

/**
 * Validates the raw, untrusted request body shape before any field is
 * `.trim()`'d or otherwise treated as a string. The route previously cast
 * the body `as` a typed shape without checking it at runtime, so a
 * non-string value for any of these fields (a number, an array, an object —
 * anything a hand-rolled client might send) would throw inside `.trim()`
 * before this function was ever called, surfacing as a raw 500 instead of a
 * clean 400 (the same class of gap `validateSeriesInput`'s
 * `project_id_must_be_string` check closes for the sibling route).
 */
export function validateSalesPostInput(body: Record<string, unknown>) {
  const errors: string[] = [];

  if (typeof body.topic !== 'string' || !body.topic.trim()) errors.push('topic_required');
  else if (body.topic.length > 500) errors.push('topic_too_long');

  for (const field of OPTIONAL_FACT_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string') errors.push(`${field}_must_be_string`);
    else if (value.length > MAX_SALES_POST_FACT_CHARS) errors.push(`${field}_too_long`);
  }

  if (body.platform !== undefined && body.platform !== null && typeof body.platform !== 'string') {
    errors.push('platform_must_be_string');
  }
  if (body.project_id !== undefined && body.project_id !== null && typeof body.project_id !== 'string') {
    errors.push('project_id_must_be_string');
  }
  if (body.brand_profile_id !== undefined && body.brand_profile_id !== null && typeof body.brand_profile_id !== 'string') {
    errors.push('brand_profile_id_must_be_string');
  }

  return { ok: errors.length === 0, errors };
}

type BlockKey = keyof Omit<SalesPostInput, 'topic'> | 'always';

const BLOCKS: Array<{ key: BlockKey; label: string; instruction: string }> = [
  { key: 'always', label: 'Hook', instruction: 'เปิดด้วยประโยคที่หยุด scroll ได้ เกี่ยวกับหัวข้อที่จะขาย' },
  { key: 'always', label: 'ปัญหา', instruction: 'พูดถึงปัญหาที่ลูกค้าตัวแทนเจอจริง (อ้างจากคำบ่นในบริบทแบรนด์)' },
  { key: 'always', label: 'ขยายปัญหา', instruction: 'ขยายว่าถ้าปล่อยปัญหานี้ไว้ จะกระทบชีวิตประจำวันยังไง' },
  { key: 'always', label: 'แนะนำทางแก้', instruction: 'แนะนำหัวข้อที่กำหนดเป็นทางแก้ (อธิบายสั้น ๆ ว่าคืออะไร)' },
  { key: 'always', label: 'วิธีใช้งาน/รายละเอียด', instruction: 'อธิบายสั้น ๆ ว่ามันทำงาน/ใช้งานยังไง ให้เห็นภาพจริง' },
  { key: 'always', label: 'จุดต่าง', instruction: 'บอกจุดต่างจากทางเลือกอื่นทั่วไปในตลาด (ห้ามเอ่ยชื่อคู่แข่งหรือแบรนด์อื่นเด็ดขาด พูดถึงเป็น "วิธีทั่วไปที่คนมักทำ" เท่านั้น)' },
  { key: 'always', label: 'ภาพหลังใช้', instruction: 'วาดภาพความรู้สึก/ชีวิตที่ดีขึ้นหลังปัญหาถูกแก้' },
  { key: 'always', label: 'เคยลองวิธีอื่นไม่เวิร์ก', instruction: 'พูดถึงวิธีที่ลูกค้าตัวแทนเคยลองมาก่อนแต่ไม่เวิร์ก (อ้างจากคำบ่นที่เหลือในบริบทแบรนด์ แต่เล่าเป็น "วิธีการทั่วไป" ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด)' },
  { key: 'social_proof', label: 'หลักฐาน/รีวิว', instruction: 'ใส่รีวิว/หลักฐานจริงนี้แทรกเข้าไปให้เนียน: {value}' },
  { key: 'promo', label: 'ข้อเสนอ/โปรโมชั่น', instruction: 'บอกข้อเสนอ/โปรโมชั่นนี้ตามจริง: {value}' },
  { key: 'price', label: 'ราคา', instruction: 'บอกราคานี้ตามจริง: {value}' },
  { key: 'guarantee', label: 'การันตี', instruction: 'บอกการันตีนี้ตามจริง: {value}' },
  { key: 'promo', label: 'เหตุผลให้ตัดสินใจตอนนี้', instruction: 'ให้เหตุผลว่าทำไมควรตัดสินใจตอนนี้ อิงจากข้อเสนอ/โปรที่ให้มา ห้ามแต่งเงื่อนไขเวลาที่ไม่มีอยู่จริง' },
  { key: 'always', label: 'ช่องทาง/CTA', instruction: 'ปิดท้ายด้วยคำชวนทำอะไรต่อ 1 ทาง ชัดเจน' },
  { key: 'always', label: 'PS', instruction: 'ปิดท้ายด้วยประโยคสั้น ๆ กันลืม ย้ำจุดเด่นที่สุดของโพสต์นี้อีกครั้ง' },
];

function hasValue(input: SalesPostInput, key: BlockKey): key is Exclude<BlockKey, 'always'> {
  return key !== 'always' && !!input[key]?.trim();
}

/**
 * Which of the 15 blocks apply to this specific post — computed once so the
 * caller (and tests) can inspect exactly what was skipped, same shape as
 * frameworks.ts's resolveFramework being a plain, testable function rather
 * than logic buried inside the prompt string.
 */
export function resolveIncludedBlocks(input: SalesPostInput) {
  return BLOCKS.filter((b) => b.key === 'always' || hasValue(input, b.key));
}

export function buildSalesPostPrompt(params: {
  input: SalesPostInput;
  platform: string;
  brandContextBlock: string;
  /**
   * Raw persona complaints (not the pre-joined `brandContextBlock` text).
   * `formatBrandContextBlock` renders all 3 complaints as one undifferentiated
   * "คำบ่นที่พบบ่อย: A / B / C" line, so without this, the "ปัญหา" block
   * (told to reference "the" complaint) and the "เคยลองวิธีอื่นไม่เวิร์ก" block
   * (told to reference "the remaining" complaints) both point at the exact
   * same joined line with no code-enforced separation — nothing stops the
   * model from writing about the same complaint twice under two different
   * framings. frameworks.ts's `renderSlotLine` avoids the equivalent problem
   * across posts in a batch with an explicit `complaintOccurrence` index;
   * here, with a single post and up to two complaint-driven blocks, the same
   * fix is to assign each block a distinct index in code — complaints[0] for
   * "ปัญหา", complaints[1] for "เคยลองวิธีอื่นไม่เวิร์ก" — rather than trust
   * the model to infer "remaining" from prose.
   */
  personaComplaints?: string[];
}) {
  const { input, platform, brandContextBlock, personaComplaints } = params;
  const included = resolveIncludedBlocks(input);
  const complaints = (personaComplaints || []).filter((c) => typeof c === 'string' && c.trim());

  const blockLines = included.map((b, i) => {
    let instruction = b.instruction;
    if (b.label === 'ปัญหา' && complaints[0]) {
      instruction = `พูดถึงปัญหานี้ที่ลูกค้าตัวแทนเจอจริง: "${complaints[0]}"`;
    } else if (b.label === 'แนะนำทางแก้') {
      instruction = `แนะนำ "${input.topic}" เป็นทางแก้ (อธิบายสั้น ๆ ว่าคืออะไร)`;
    } else if (b.label === 'เคยลองวิธีอื่นไม่เวิร์ก' && complaints[1]) {
      instruction = `พูดถึงวิธีที่ลูกค้าตัวแทนเคยลองมาก่อนแต่ไม่เวิร์ก เกี่ยวกับปัญหานี้โดยเฉพาะ (คนละเรื่องกับที่ใช้ไปแล้วในบล็อก "ปัญหา" ข้างบน): "${complaints[1]}" — เล่าเป็น "วิธีการทั่วไป" ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด`;
    } else if (b.label === 'ช่องทาง/CTA') {
      instruction = input.channel
        ? `ปิดท้ายด้วยคำชวนทำอะไรต่อผ่านช่องทางนี้ตามจริง: ${input.channel}`
        : 'ปิดท้ายด้วยคำชวนทักแชท/สอบถามเพิ่มเติม (ไม่มีช่องทางเฉพาะที่ระบุ ใช้คำชวนทั่วไป)';
    } else if (b.key !== 'always') {
      instruction = b.instruction.replace('{value}', String(input[b.key as keyof SalesPostInput]));
    }
    return `${i + 1}. ${b.label}: ${instruction}`;
  });

  const system = `คุณคือ Content Strategist ที่เขียนโพสต์ขายให้ SME ไทย จากหัวข้อเดียว
เข้าใจ platform ไทย, ภาษาไทย, คนไทย
งานคือเขียนโพสต์ขาย 1 ชิ้น ให้ครอบคลุมประเด็นด้านล่างทั้งหมด แต่ต้องไหลลื่นเป็นโพสต์เดียวเป็นธรรมชาติ
⚠️ ห้ามใส่ชื่อบล็อก/หมายเลขโชว์ในเนื้อหาจริง (เช่น ห้ามเขียนคำว่า "1. Hook" หรือ "ปัญหา:" ปรากฏในโพสต์) — บล็อกด้านล่างคือ checklist ให้คุณเขียนตาม ไม่ใช่หัวข้อที่ต้องโชว์
⚠️ ห้ามเอ่ยชื่อร้าน/แบรนด์/สินค้าของคู่แข่งเด็ดขาด แม้แต่ทางอ้อม
⚠️ ทุกข้อเท็จจริง (ราคา/โปร/การันตี/รีวิว/ช่องทาง) ต้องตรงกับที่ให้มาเป๊ะ ๆ ห้ามแต่งเติมหรือปัดตัวเลข
⚠️ ห้ามแต่งข้อเท็จจริงที่ไม่ได้ให้มาเพิ่มเองเด็ดขาด (เช่น เวลาเปิด-ปิดร้าน ที่อยู่เพิ่มเติม จำนวนลูกค้า ปีที่ก่อตั้ง) แม้จะฟังดูสมเหตุสมผลก็ห้ามเดา
⚠️ ห้ามแต่งคำโฆษณาเกินจริงที่ไม่มีข้อมูลรองรับเด็ดขาด (เช่น "ขายดีอันดับ 1" "ที่สุดในไทย" "ลูกค้าติดใจนับพัน" ถ้าไม่ได้ให้มาในหลักฐาน/รีวิว, ส่วนผสม/วัตถุดิบเฉพาะที่ไม่ได้ระบุ, สรรพคุณ/ผลลัพธ์ด้านสุขภาพเช่น "รักษา" "ลดน้ำหนัก" "ปลอดภัย 100%" "ไม่มีผลข้างเคียง", หรือเวลาจัดส่ง/ระยะเวลาที่ไม่ได้ระบุ) — เขียนแบบขายได้โดยไม่ต้องมีคำเคลมพวกนี้
⚠️ โทน "เปิดตัวโปร/ข้อเสนอ" ไม่ใช่โทน "ยัดเยียดขายของ"

⚠️ สำคัญมาก: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`;

  const user = `# หัวข้อที่จะขาย
${input.topic}

# Brand context
${brandContextBlock}

# Checklist ที่ต้องครอบคลุม (ข้อไหนไม่มีข้อมูลจริงจะไม่อยู่ในลิสต์นี้ — ห้ามแต่งเติมข้อที่ไม่อยู่ในนี้)
${blockLines.join('\n')}

# Platform
${platform}

# Output JSON Schema
{
  "hook": "ประโยค hook 1 บรรทัด หยุด scroll ได้",
  "caption": "โพสต์ขายฉบับเต็ม ภาษาไทย ไหลลื่นเป็นโพสต์เดียว ครอบคลุม checklist ข้างบนแบบไม่โชว์หมายเลข/ชื่อบล็อก",
  "cta": "คำชวนทำอะไรต่อ 1 ประโยคสั้น ๆ",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "visual_suggestion": "คำอธิบายภาพ 1 บรรทัด — บรรยายเฉพาะสิ่งที่เห็นในภาพ ห้ามระบุตัวอักษร ข้อความ ป้าย ปุ่ม โลโก้ หรือราคาในภาพ"
}

⚠️ ทุก field ต้องมี ไม่เว้นว่าง
⚠️ JSON valid — ไม่มี comment, ไม่มี trailing comma`;

  return { system, user };
}
