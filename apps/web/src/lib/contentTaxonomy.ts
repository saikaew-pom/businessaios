// Mirrors apps/api/src/lib/creative/contentTaxonomy.ts's CONTENT_TYPES keys
// and groups exactly — the frontend only needs plain-Thai labels + a chip
// tone per group for display, never validates against this list (the
// backend is the source of truth there).

export type ContentTypeGroup = 'ขายฝัน' | 'Expert' | 'Engagement' | 'Review';

export const CONTENT_TYPE_LABELS: Record<string, { label: string; group: ContentTypeGroup }> = {
  before_after: { label: 'ก่อน-หลัง', group: 'ขายฝัน' },
  lifestyle: { label: 'ชีวิตที่อยากมี', group: 'ขายฝัน' },
  promotion: { label: 'โปรโมชั่น/ข้อเสนอ', group: 'ขายฝัน' },
  new_launch: { label: 'เปิดตัวสินค้าใหม่', group: 'ขายฝัน' },
  tips: { label: 'เคล็ดลับ/ให้ความรู้', group: 'Expert' },
  faq: { label: 'ตอบคำถามที่พบบ่อย', group: 'Expert' },
  behind_the_scenes: { label: 'เบื้องหลัง/กระบวนการทำงาน', group: 'Expert' },
  comparison: { label: 'เปรียบเทียบ', group: 'Expert' },
  poll_question: { label: 'ถามความเห็น/โพล', group: 'Engagement' },
  seasonal: { label: 'ตามเทศกาล', group: 'Engagement' },
  casual_chat: { label: 'ชวนคุยเล่น', group: 'Engagement' },
  testimonial: { label: 'รีวิวจากลูกค้าจริง', group: 'Review' },
  case_study: { label: 'เคสตัวอย่างความสำเร็จ', group: 'Review' },
  ugc: { label: 'UGC/แชร์จากลูกค้า', group: 'Review' },
};

const GROUP_TONE: Record<ContentTypeGroup, 'neutral' | 'sage' | 'gold'> = {
  'ขายฝัน': 'gold',
  Expert: 'sage',
  Engagement: 'neutral',
  Review: 'sage',
};

export function contentTypeLabel(key: string): string {
  return CONTENT_TYPE_LABELS[key]?.label || key;
}

export function contentTypeChipTone(key: string): 'neutral' | 'sage' | 'gold' {
  const group = CONTENT_TYPE_LABELS[key]?.group;
  return group ? GROUP_TONE[group] : 'neutral';
}

// Mirrors THAI_MARKETING_CALENDAR's keys/names for display only.
export const SEASONAL_EVENT_LABELS: Record<string, string> = {
  new_year: 'ปีใหม่', chinese_new_year: 'ตรุษจีน', valentines: 'วาเลนไทน์',
  womens_day: 'วันสตรีสากล', songkran: 'สงกรานต์', labour_day: 'วันแรงงาน',
  back_to_school: 'เปิดเทอม', rainy_season: 'ฤดูฝน', mothers_day: 'วันแม่',
  nine_nine: '9.9', double_ten: '10.10', loy_krathong: 'ลอยกระทง',
  eleven_eleven: '11.11', fathers_day: 'วันพ่อ', double_twelve: '12.12',
  year_end_sale: 'ลดราคาสิ้นปี',
};

export function seasonalEventLabel(key: string): string {
  return SEASONAL_EVENT_LABELS[key] || key;
}
