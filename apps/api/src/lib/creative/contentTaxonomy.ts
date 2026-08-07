// Content Playbook Upgrade Plan ขั้นที่ 2 — the 14-type content taxonomy and
// the static Thai marketing calendar (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md
// §6). The plan's own source ("18-AI-Content-Writing-Playbook.md") doesn't
// exist anywhere in this repo, so this list was drafted fresh (confirmed
// with the product owner) rather than transcribed from an unavailable
// external document — see docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §9 for that
// decision record.
//
// "กลุ่มเป้าหมาย" (ขายฝัน/Expert/Engagement/Review) is deliberately NOT a
// separate stored field on a topic card — it's derived from `content_type`
// here, so it can never drift out of sync with the type itself.
//
// "framework แนะนำ" from the plan's own topic-card spec is intentionally
// NOT included yet — the 4-framework taxonomy it refers to is the explicit
// subject of ขั้นที่ 4 (Framework Engine, not yet built). Tagging topics with
// framework names now would mean inventing a second undefined taxonomy on
// top of this one; that tag gets added when ขั้นที่ 4 actually defines it.

export type ContentTypeGroup = 'ขายฝัน' | 'Expert' | 'Engagement' | 'Review';

export type ContentTypeDef = {
  key: string;
  label: string; // plain Thai, shown to users
  group: ContentTypeGroup;
};

export const CONTENT_TYPES: ContentTypeDef[] = [
  // ขายฝัน (aspirational sell) — 4
  { key: 'before_after', label: 'ก่อน-หลัง', group: 'ขายฝัน' },
  { key: 'lifestyle', label: 'ชีวิตที่อยากมี', group: 'ขายฝัน' },
  { key: 'promotion', label: 'โปรโมชั่น/ข้อเสนอ', group: 'ขายฝัน' },
  { key: 'new_launch', label: 'เปิดตัวสินค้าใหม่', group: 'ขายฝัน' },
  // Expert (authority/education) — 4
  { key: 'tips', label: 'เคล็ดลับ/ให้ความรู้', group: 'Expert' },
  { key: 'faq', label: 'ตอบคำถามที่พบบ่อย', group: 'Expert' },
  { key: 'behind_the_scenes', label: 'เบื้องหลัง/กระบวนการทำงาน', group: 'Expert' },
  { key: 'comparison', label: 'เปรียบเทียบ', group: 'Expert' },
  // Engagement — 3
  { key: 'poll_question', label: 'ถามความเห็น/โพล', group: 'Engagement' },
  { key: 'seasonal', label: 'ตามเทศกาล', group: 'Engagement' },
  { key: 'casual_chat', label: 'ชวนคุยเล่น', group: 'Engagement' },
  // Review (social proof) — 3
  { key: 'testimonial', label: 'รีวิวจากลูกค้าจริง', group: 'Review' },
  { key: 'case_study', label: 'เคสตัวอย่างความสำเร็จ', group: 'Review' },
  { key: 'ugc', label: 'UGC/แชร์จากลูกค้า', group: 'Review' },
];

const CONTENT_TYPE_BY_KEY = new Map(CONTENT_TYPES.map((t) => [t.key, t]));

export function isValidContentType(key: unknown): key is string {
  return typeof key === 'string' && CONTENT_TYPE_BY_KEY.has(key);
}

export function contentTypeGroup(key: string): ContentTypeGroup | undefined {
  return CONTENT_TYPE_BY_KEY.get(key)?.group;
}

export type SeasonalEvent = {
  key: string;
  name: string;
  month: number; // 1-12, Thai calendar convention
};

// Free, static, zero-AI-cost — injected into ideation prompts as reference
// data only, not generated. "ไม่ใช้ AI, ฟรี" per the plan.
export const THAI_MARKETING_CALENDAR: SeasonalEvent[] = [
  { key: 'new_year', name: 'ปีใหม่', month: 1 },
  { key: 'chinese_new_year', name: 'ตรุษจีน', month: 2 },
  { key: 'valentines', name: 'วาเลนไทน์', month: 2 },
  { key: 'womens_day', name: 'วันสตรีสากล', month: 3 },
  { key: 'songkran', name: 'สงกรานต์', month: 4 },
  { key: 'labour_day', name: 'วันแรงงาน', month: 5 },
  { key: 'back_to_school', name: 'เปิดเทอม', month: 5 },
  { key: 'rainy_season', name: 'ฤดูฝน', month: 6 },
  { key: 'mothers_day', name: 'วันแม่', month: 8 },
  { key: 'nine_nine', name: '9.9', month: 9 },
  { key: 'double_ten', name: '10.10', month: 10 },
  { key: 'loy_krathong', name: 'ลอยกระทง', month: 11 },
  { key: 'eleven_eleven', name: '11.11', month: 11 },
  { key: 'fathers_day', name: 'วันพ่อ', month: 12 },
  { key: 'double_twelve', name: '12.12', month: 12 },
  { key: 'year_end_sale', name: 'ลดราคาสิ้นปี', month: 12 },
];

const SEASONAL_BY_KEY = new Map(THAI_MARKETING_CALENDAR.map((e) => [e.key, e]));

export function isValidSeasonalEvent(key: unknown): key is string {
  return typeof key === 'string' && SEASONAL_BY_KEY.has(key);
}

/** Events within `monthsAhead` of `nowMonth` (wrapping December→January) — the ones worth surfacing to ideation as "coming up soon". */
export function upcomingSeasonalEvents(nowMonth: number, monthsAhead = 2): SeasonalEvent[] {
  return THAI_MARKETING_CALENDAR.filter((e) => {
    const diff = (e.month - nowMonth + 12) % 12;
    return diff <= monthsAhead;
  });
}
