/**
 * Repurpose Engine — Content Playbook Upgrade Plan ขั้นที่ 7 ("รีดสื่อ").
 *
 * "Token ถูก (แปลงของเดิม ไม่ใช่แต่งใหม่)" is the whole point: unlike every
 * other generator in this codebase, the input here is an ALREADY-WRITTEN,
 * already-approved post (hook/caption/cta/hashtags), not a bare topic. The
 * model's job is to reshape that existing copy into a different format, not
 * invent new facts or claims — the same trust-cliff guardrail sales-post
 * enforces (CONTENT_PLAYBOOK_UPGRADE_PLAN.md risk list item 7), just aimed
 * at "don't add a claim the source post didn't make" instead of "don't
 * invent a price/promo that wasn't given."
 */

export type RepurposeType = 'album' | 'reel_script' | 'line_broadcast';

export const REPURPOSE_TYPES: RepurposeType[] = ['album', 'reel_script', 'line_broadcast'];

export function isRepurposeType(value: unknown): value is RepurposeType {
  return typeof value === 'string' && (REPURPOSE_TYPES as string[]).includes(value);
}

export type RepurposeSource = {
  title: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
};

export const REPURPOSE_LABELS: Record<RepurposeType, string> = {
  album: 'อัลบั้มภาพ',
  reel_script: 'สคริปต์ Reels/TikTok',
  line_broadcast: 'ข้อความ LINE broadcast',
};

const TYPE_INSTRUCTIONS: Record<RepurposeType, string> = {
  album: `แปลงโพสต์ต้นฉบับให้เป็น "อัลบั้มภาพ" 4-6 สไลด์ — แต่ละสไลด์มีข้อความสั้น ๆ ไหลต่อกันเป็นเรื่องเดียว (ไม่ใช่ตัดโพสต์เดิมมาแปะ)
เขียนลงในช่อง caption เป็นรายการ: "สไลด์ 1: ...\\nสไลด์ 2: ...\\n..." (ใช้ \\n จริงระหว่างสไลด์)
สไลด์แรกคือ hook ที่หยุด scroll ได้ สไลด์สุดท้ายคือ CTA
ช่อง visual_suggestion: บรรยายภาพที่ควรใช้ในแต่ละสไลด์แบบย่อ รูปแบบเดียวกัน "สไลด์ 1: ...\\nสไลด์ 2: ..."`,
  reel_script: `แปลงโพสต์ต้นฉบับให้เป็นสคริปต์วิดีโอสั้น (Reels/TikTok) ความยาว 15-30 วินาที
เขียนลงในช่อง caption เป็นสคริปต์แบ่งช่วงเวลา: "0-3 วิ: (บอกว่าพูด/โชว์อะไร)\\n3-10 วิ: ...\\n10-20 วิ: ...\\n20-30 วิ: ..." (ใช้ \\n จริงระหว่างบรรทัด)
วินาทีแรกต้องเป็น hook ที่หยุด scroll ได้ (คำพูดหรือข้อความบนจอ)
ช่อง visual_suggestion: บอกช็อต/มุมกล้อง/ข้อความบนจอที่ควรใช้ในแต่ละช่วงเวลา รูปแบบเดียวกับ caption`,
  line_broadcast: `แปลงโพสต์ต้นฉบับให้เป็นข้อความ LINE broadcast — สั้น กันเอง เป็นการส่งข้อความหาลูกค้าโดยตรง ไม่ใช่โพสต์โซเชียล
เขียนลงในช่อง caption ความยาวไม่เกิน 300 ตัวอักษร ใช้ภาษาพูดแบบทักหาเพื่อน มี emoji ได้พอเหมาะ
ต้องมี CTA เดียวชัดเจนปิดท้าย (ทักแชท/กดลิงก์/มาที่ร้าน ตามที่โพสต์ต้นฉบับให้มา)
ช่อง hashtags ให้ตอบเป็น array ว่าง [] เสมอ (LINE ไม่ใช้ hashtag)
ช่อง visual_suggestion ให้ตอบเป็นข้อความว่าง "" เสมอ (broadcast นี้ไม่ต้องมีคำแนะนำภาพ)`,
};

export function buildRepurposePrompt(params: {
  type: RepurposeType;
  source: RepurposeSource;
  brandContextBlock: string;
}) {
  const { type, source, brandContextBlock } = params;

  const system = `คุณคือ Content Strategist ที่ "รีดต่อ" โพสต์เดิมที่อนุมัติแล้ว ให้กลายเป็นสื่ออีกรูปแบบหนึ่ง สำหรับ SME ไทย
งานคือแปลงรูปแบบ ไม่ใช่แต่งเนื้อหาใหม่ — ข้อเท็จจริง/ราคา/โปร/คำเคลมทุกอย่างต้องมาจากโพสต์ต้นฉบับเท่านั้น
⚠️ ห้ามเติมข้อเท็จจริง ราคา โปรโมชั่น หรือคำเคลมที่ไม่มีในโพสต์ต้นฉบับเด็ดขาด แม้จะฟังดูสมเหตุสมผลก็ห้ามเดา
⚠️ ห้ามเอ่ยชื่อร้าน/แบรนด์คู่แข่งเด็ดขาด

${TYPE_INSTRUCTIONS[type]}

⚠️ สำคัญมาก: ตอบเป็น JSON object เดียวเท่านั้น ห้ามมี markdown code fence ห้ามมีข้อความอธิบายก่อน/หลัง
⚠️ JSON ต้อง valid — ใช้ double quote, ห้ามมี trailing comma`;

  const user = `# โพสต์ต้นฉบับ (อนุมัติแล้ว — ใช้ข้อเท็จจริงจากนี้เท่านั้น)
หัวข้อ: ${source.title || '(ไม่มี)'}
Hook: ${source.hook || '(ไม่มี)'}
Caption: ${source.caption || '(ไม่มี)'}
CTA: ${source.cta || '(ไม่มี)'}
Hashtags เดิม: ${source.hashtags.length ? source.hashtags.join(', ') : '(ไม่มี)'}

# Brand context
${brandContextBlock}

# Output JSON Schema
{
  "hook": "1 บรรทัด",
  "caption": "เนื้อหาหลักตามรูปแบบที่กำหนดข้างบน",
  "cta": "คำชวนทำอะไรต่อ 1 ประโยคสั้น ๆ",
  "hashtags": ["#tag1", "#tag2"],
  "visual_suggestion": "คำอธิบายภาพ ตามรูปแบบที่กำหนดข้างบน"
}

⚠️ ทุก field ต้องมี ไม่เว้นว่าง (ยกเว้นที่ระบุไว้ข้างบนว่าให้เว้นว่างได้)
⚠️ JSON valid — ไม่มี comment, ไม่มี trailing comma`;

  return { system, user };
}

/** Sensible target platform/format per repurpose type, seeded from the
 * source item's own platform where that makes sense (e.g. a reel repurposed
 * from an Instagram post should probably stay on Instagram, not default to
 * TikTok) — never guessed beyond the 3 fixed shapes below. */
export function repurposeTargetPlatformFormat(type: RepurposeType, sourcePlatform: string) {
  if (type === 'album') return { platform: sourcePlatform || 'facebook', format: 'album' };
  if (type === 'reel_script') {
    const platform = ['tiktok', 'instagram'].includes(sourcePlatform) ? sourcePlatform : 'tiktok';
    return { platform, format: 'reel' };
  }
  return { platform: 'line', format: 'post' };
}
