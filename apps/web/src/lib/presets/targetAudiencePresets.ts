/**
 * Target Audience Presets
 * Multi-select (max 2) + custom text input
 * Based on demographic, life stage, psychographic, role
 */

export type TargetAudience = {
  id: string;
  icon: string;
  label: string;
  category: 'demographic' | 'life_stage' | 'income' | 'psychographic' | 'role' | 'b2b' | 'geographic';
  description: string;
};

export const TARGET_AUDIENCES: TargetAudience[] = [
  // === Demographic (อายุ) ===
  { id: 'youth', icon: '🧒', label: 'วัยรุ่น/นักศึกษา (13-22)', category: 'demographic', description: 'ตามเทรนด์ ใช้ TikTok/IG' },
  { id: 'young_pro', icon: '👩‍💼', label: 'คนทำงานออฟฟิศ (23-35)', category: 'demographic', description: 'ซื้อของออนไลน์ มีรายได้' },
  { id: 'mid_career', icon: '👨‍💼', label: 'คนทำงานมีประสบการณ์ (36-50)', category: 'demographic', description: 'มีกำลังซื้อ ตัดสินใจเร็ว' },
  { id: 'senior', icon: '👴', label: 'ผู้สูงอายุ (50+)', category: 'demographic', description: 'เน้นคุณค่า ความน่าเชื่อถือ' },

  // === Life Stage (ช่วงชีวิต) ===
  { id: 'parent_young', icon: '👶', label: 'คุณพ่อ/คุณแม่ลูกเล็ก', category: 'life_stage', description: 'ลูก 0-6 ขวบ ใส่ใจทุกเรื่อง' },
  { id: 'parent_teen', icon: '👧', label: 'คุณพ่อ/คุณแม่ลูกวัยรุ่น', category: 'life_stage', description: 'ลูก 12-18 ปี กังวลเรื่องการศึกษา' },
  { id: 'newlywed', icon: '💍', label: 'ครอบครัวใหม่/เพิ่งแต่งงาน', category: 'life_stage', description: 'ซื้อบ้าน ซื้อรถ เริ่มสร้างครอบครัว' },
  { id: 'single', icon: '🧍', label: 'โสด/อยู่คนเดียว', category: 'life_stage', description: 'รายได้เต็มที่ ใช้จ่ายกับตัวเอง' },
  { id: 'preretiree', icon: '⏳', label: 'ใกล้เกษียณ', category: 'life_stage', description: 'วางแผนเกษียณ ใส่ใจสุขภาพ' },
  { id: 'caregiver', icon: '🤲', label: 'ผู้ดูแลผู้สูงอายุ/ผู้ป่วย', category: 'life_stage', description: 'ดูแลคนในครอบครัว' },

  // === Income (รายได้) ===
  { id: 'budget', icon: '💵', label: 'รายได้น้อย/ประหยัด', category: 'income', description: 'เน้นความคุ้มค่า ราคาถูก' },
  { id: 'middle_income', icon: '💴', label: 'รายได้ปานกลาง', category: 'income', description: 'กลุ่มใหญ่ที่สุด ตัดสินใจตามคุณภาพ' },
  { id: 'high_income', icon: '💎', label: 'รายได้สูง/premium', category: 'income', description: 'ซื้อของแพงได้ สนใจคุณภาพ' },

  // === Psychographic (ไลฟ์สไตล์) ===
  { id: 'health_focused', icon: '🥗', label: 'สายสุขภาพ/ออกกำลังกาย', category: 'psychographic', description: 'ใส่ใจสุขภาพ ส่วนผสม' },
  { id: 'tech_savvy', icon: '🎮', label: 'สายเทค/เกมเมอร์', category: 'psychographic', description: 'ชอบเทคโนโลยีใหม่' },
  { id: 'fashion_lover', icon: '👗', label: 'สายแฟชั่น/ความงาม', category: 'psychographic', description: 'ตามเทรนด์แฟชั่น' },
  { id: 'value_seeker', icon: '🏷', label: 'สายประหยัด/คุ้มค่า', category: 'psychographic', description: 'เปรียบเทียบเยอะ ก่อนซื้อ' },
  { id: 'luxury_seeker', icon: '👑', label: 'สายหรูหรา/premium', category: 'psychographic', description: 'ชอบของมีคุณภาพสูง' },
  { id: 'diy_maker', icon: '🔧', label: 'สาย DIY/ทำเอง', category: 'psychographic', description: 'ชอบลงมือทำเอง' },
  { id: 'eco_conscious', icon: '🌱', label: 'สายรักษ์โลก/ออร์แกนิก', category: 'psychographic', description: 'ใส่ใจสิ่งแวดล้อม ความยั่งยืน' },
  { id: 'social_trend', icon: '📱', label: 'สายตามเทรนด์โซเชียล', category: 'psychographic', description: 'ขับเคลื่อนด้วย influencer' },

  // === Role (อาชีพ/บทบาท) ===
  { id: 'business_owner', icon: '💼', label: 'เจ้าของธุรกิจ/SME', category: 'role', description: 'ตัดสินใจธุรกิจ ซื้อเพื่อองค์กร' },
  { id: 'freelancer', icon: '🧑‍💻', label: 'ฟรีแลนซ์/ครีเอทีฟ', category: 'role', description: 'อิสระ รายได้ผันผวน' },
  { id: 'corporate', icon: '🏢', label: 'พนักงานบริษัท', category: 'role', description: 'มีรายได้ประจำ ต้องการ convenience' },
  { id: 'student', icon: '🎓', label: 'นักเรียน/นักศึกษา', category: 'role', description: 'งบจำกัด ตามเทรนด์' },
  { id: 'housewife', icon: '🏠', label: 'แม่บ้าน/full-time mom', category: 'role', description: 'ดูแลครอบครัว ตัดสินใจซื้อของ' },
  { id: 'retiree', icon: '🌳', label: 'ผู้เกษียณ', category: 'role', description: 'มีเวลา มีเงิน ไม่เก่งเทค' },

  // === B2B ===
  { id: 'b2b_sme', icon: '🏪', label: 'SME/Startup (B2B)', category: 'b2b', description: 'ธุรกิจขนาดเล็ก-กลาง' },
  { id: 'b2b_enterprise', icon: '🏛', label: 'องค์กรใหญ่/Corporate (B2B)', category: 'b2b', description: 'บริษัทขนาดใหญ่' },
  { id: 'b2b_gov', icon: '🏛', label: 'หน่วยงานรัฐ (B2B)', category: 'b2b', description: 'ภาครัฐ รัฐวิสาหกิจ' },
  { id: 'b2b_ngo', icon: '🤝', label: 'NGO/มูลนิธิ (B2B)', category: 'b2b', description: 'ไม่แสวงหากำไร' },

  // === Geographic (พื้นที่) ===
  { id: 'geo_bkk', icon: '🏙', label: 'กรุงเทพและปริมณฑล', category: 'geographic', description: 'เขตเมือง รายได้สูง' },
  { id: 'geo_major', icon: '🌆', label: 'หัวเมืองใหญ่', category: 'geographic', description: 'เชียงใหม่ ขอนแก่น ภูเก็ต ฯลฯ' },
  { id: 'geo_province', icon: '🌾', label: 'ต่างจังหวัด/ชนบท', category: 'geographic', description: 'เมืองรอง รายได้ปานกลาง-น้อย' },
  { id: 'geo_intl', icon: '🌏', label: 'International/ASEAN', category: 'geographic', description: 'ต่างประเทศ เน้น CLMV' },
];

/**
 * Group target audiences by category (for display)
 */
export function getAudiencesByCategory(): Record<string, TargetAudience[]> {
  const result: Record<string, TargetAudience[]> = {};
  for (const a of TARGET_AUDIENCES) {
    if (!result[a.category]) result[a.category] = [];
    result[a.category].push(a);
  }
  return result;
}

export const AUDIENCE_CATEGORY_LABELS: Record<string, string> = {
  demographic: '👤 ช่วงอายุ',
  life_stage: '👨‍👩‍👧 ช่วงชีวิต',
  income: '💰 รายได้',
  psychographic: '🎯 ไลฟ์สไตล์',
  role: '💼 อาชีพ',
  b2b: '🏢 ธุรกิจ (B2B)',
  geographic: '📍 พื้นที่',
};
