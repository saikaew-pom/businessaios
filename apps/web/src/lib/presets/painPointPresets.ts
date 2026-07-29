/**
 * Pain Point Presets — 8 core + 3 emerging categories (11 total)
 * Based on canonical 4-category framework (Financial/Productivity/Process/Support)
 *   + 3 layers: Trust, Emotional, Identity
 *   + 3 emerging: Health, Compatibility, Convenience
 * References: Salesforce, Zoominfo, Prospeo, HubSpot 2026 buyer trends
 *
 * Categories mapped to canonical types:
 *   Financial      = budget
 *   Productivity    = time
 *   Process        = decision, effort
 *   Support        = information, skill_gap
 *   Trust          = trust
 *   Emotional      = social
 *   Identity       = identity
 *   Health         = health_safety
 *   Convenience    = convenience
 *   Compatibility  = compatibility
 */

export type PainPointCategory = {
  id: string;
  icon: string;
  label: string;
  description: string;
  /** Canonical taxonomy bucket (Financial/Productivity/Process/Support/Trust/Emotional/Identity/Health/Convenience/Compatibility) */
  category_type: 'Financial' | 'Productivity' | 'Process' | 'Support' | 'Trust' | 'Emotional' | 'Identity' | 'Health' | 'Convenience' | 'Compatibility';
  typical_industries: string[];
  typical_audiences: string[];
  example_pains: string[];
  example_phrases: string[];  // what customers actually say
  // How to apply in input — used as target_audience hint + extra context
  audience_hint: string;
  context_block: string;
};

export const PAIN_POINT_CATEGORIES: PainPointCategory[] = [
  {
    id: 'time',
    icon: '⏰',
    label: 'ไม่มีเวลา',
    description: 'ลูกค้ามีเวลาน้อย อยากได้ของเร็ว ไม่อยากเสียเวลา',
    category_type: 'Productivity',
    typical_industries: ['food delivery', 'productivity tools', 'convenience store', 'quick service'],
    typical_audiences: ['พ่อแม่ทำงาน', 'เจ้าของธุรกิจ', 'คนทำงานออฟฟิศ', 'นักศึกษา'],
    example_pains: [
      'รอนานมาก ไม่มีเวลารอ',
      'ทำไมต้องรอคิวขนาดนี้',
      'อยากได้เร็วๆ แต่ไม่รู้จะไปไหน',
      'ทุกวันเวลาไม่พอ',
      'อยากเสร็จใน 5 นาที ไม่ใช่ 5 ชั่วโมง',
    ],
    example_phrases: [
      '"ไม่มีเวลาเลย"',
      '"รอนานจนหงุดหริด"',
      '"อยากได้ของด่วน"',
      '"ทำไม่ทัน"',
    ],
    audience_hint: 'คนทำงานที่มีเวลาจำกัด ต้องการความรวดเร็ว',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "เวลา" — ความล่าช้า การรอคิว ขั้นตอนที่ใช้เวลานาน ความยุ่งยากในการจัดการเวลา',
  },
  {
    id: 'budget',
    icon: '💸',
    label: 'งบน้อย / แพง',
    description: 'ลูกค้ามีงบจำกัด อยากได้ของคุ้มค่า',
    category_type: 'Financial',
    typical_industries: ['budget F&B', 'mass market retail', 'student products', 'entry-level SaaS'],
    typical_audiences: ['นักศึกษา', 'SME', 'คนเริ่มงาน', 'ครอบครัวขนาดเล็ก'],
    example_pains: [
      'แพงไป ไม่มีงบ',
      'คุ้มค่าไหม ถ้าเทียบกับราคา',
      'มีตัวเลือกถูกกว่านี้มั้ย',
      'ต้องคิดเยอะก่อนซื้อ',
      'ค่าใช้จ่ายแอบแฝงเยอะ',
    ],
    example_phrases: [
      '"แพงไป"',
      '"ไม่คุ้ม"',
      '"เกินงบ"',
      '"มีของถูกกว่ามั้ย"',
    ],
    audience_hint: 'ผู้บริโภคที่มีงบจำกัด ต้องการความคุ้มค่า',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ราคา" — ค่าใช้จ่าย ความคุ้มค่า งบประมาณจำกัด ค่าใช้จ่ายแอบแฝง',
  },
  {
    id: 'information',
    icon: '🔍',
    label: 'ขาดข้อมูล / เปรียบเทียบยาก',
    description: 'หาข้อมูลยาก เปรียบเทียบไม่เป็น ไม่รู้ว่าจะเลือกอะไร',
    category_type: 'Support',
    typical_industries: ['B2B software', 'financial services', 'healthcare', 'education'],
    typical_audiences: ['ผู้บริโภคครั้งแรก', 'คนตัดสินใจยาก', 'SME owner'],
    example_pains: [
      'ไม่รู้จะเลือกอันไหนดี',
      'รีวิวน้อย ข้อมูลไม่ครบ',
      'เชื่อใครไม่ได้',
      'เปรียบเทียบยาก แต่ละอันต่างกันยังไง',
      'กลัวเลือกผิด',
    ],
    example_phrases: [
      '"ไม่รู้จะเลือกอันไหน"',
      '"เทียบกันยังไง"',
      '"ข้อมูลไม่พอ"',
      '"กลัวถูกหลอก"',
    ],
    audience_hint: 'ผู้บริโภคที่ขาดข้อมูลในการตัดสินใจ',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ข้อมูล" — ความไม่เพียงพอของข้อมูล การเปรียบเทียบ ความน่าเชื่อถือ ความโปร่งใส',
  },
  {
    id: 'skill_gap',
    icon: '🛠',
    label: 'ไม่มีความรู้/ทักษะ',
    description: 'ไม่รู้ว่าจะเริ่มยังไง ทำเองไม่เป็น กลัวทำผิด',
    category_type: 'Support',
    typical_industries: ['online courses', 'DIY', 'coaching', 'professional services'],
    typical_audiences: ['ผู้เริ่มต้น', 'คนอยากเปลี่ยนสายอาชีพ', 'SME owner'],
    example_pains: [
      'ทำไม่เป็น ไม่รู้จะเริ่ม',
      'กลัวทำผิด',
      'เคยลองแล้วล้มเหลว',
      'ต้องเรียนรู้เยอะ ไม่มีเวลา',
      'ซับซ้อนเกินไป',
    ],
    example_phrases: [
      '"ทำไม่เป็น"',
      '"ไม่รู้จะเริ่มยังไง"',
      '"กลัวพัง"',
      '"ต้องเรียนรู้เยอะ"',
    ],
    audience_hint: 'ผู้เริ่มต้นที่ต้องการคำแนะนำ',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ทักษะ" — การขาดความรู้ ความซับซ้อน ความกลัวทำผิด การเริ่มต้น',
  },
  {
    id: 'trust',
    icon: '🤝',
    label: 'ไม่ไว้ใจ / กลัวถูกหลอก',
    description: 'กลัวถูกโกง ของไม่ตรงปก ไม่มีหลักฐาน',
    category_type: 'Trust',
    typical_industries: ['healthcare', 'finance', 'luxury', 'online services'],
    typical_audiences: ['ผู้บริโภคใหม่', 'กลุ่มเสี่ยง', 'ตลาดออนไลน์'],
    example_pains: [
      'กลัวถูกโกง ไม่เห็นของจริง',
      'ไม่แน่ใจว่าจะได้ของจริง',
      'รีวิวปลอมเยอะ',
      'ไม่รู้ว่าจะเชื่อใคร',
      'เคยโดนหลอกมาก่อน',
    ],
    example_phrases: [
      '"กลัวโดนหลอก"',
      '"ไม่แน่ใจ"',
      '"เชื่อถือได้จริงเหรอ"',
      '"เคยโดนมาแล้ว"',
    ],
    audience_hint: 'ผู้บริโภคที่เคยถูกหลอกหรือระวังตัว',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ความไว้ใจ" — การถูกหลอก ของปลอม รีวิวปลอม ความเสี่ยง',
  },
  {
    id: 'decision',
    icon: '🤔',
    label: 'ตัดสินใจยาก / เลือกไม่ได้',
    description: 'มีตัวเลือกเยอะ เปรียบเทียบไม่จบ เลือกไม่ถูก',
    category_type: 'Process',
    typical_industries: ['e-commerce', 'subscription', 'multi-option services'],
    typical_audiences: ['คน perfectionist', 'analytical buyer', 'first-time buyer'],
    example_pains: [
      'ตัวเลือกเยอะเกินไป เลือกไม่ถูก',
      'เปรียบเทียบมา 3 วันแล้ว',
      'กลัวเลือกผิด เสียใจทีหลัง',
      'ไม่รู้จะเริ่มจากตรงไหน',
    ],
    example_phrases: [
      '"เลือกไม่ถูก"',
      '"ตัวเลือกเยอะ"',
      '"กลัวเลือกผิด"',
      '"เปรียบเทียบไม่จบ"',
    ],
    audience_hint: 'ผู้บริโภคที่ต้องการคำแนะนำในการเลือก',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "การตัดสินใจ" — ความลังเล ตัวเลือกเยอะ ความกลัวเลือกผิด',
  },
  {
    id: 'effort',
    icon: '😮‍💨',
    label: 'เหนื่อย / ยุ่งยาก',
    description: 'กระบวนการยุ่งยาก ใช้แรงงานเยอะ ต้องทำเอง',
    category_type: 'Process',
    typical_industries: ['services', 'logistics', 'productivity', 'health & wellness'],
    typical_audiences: ['คนยุ่ง', 'ผู้สูงอายุ', 'คนไม่มีเวลา'],
    example_pains: [
      'ขั้นตอนเยอะมาก ทำไม่ไหว',
      'ต้องเดินทางไปซื้อเอง',
      'ต้องโทรจองล่วงหน้า',
      'ทำเองทุกอย่าง',
      'กระบวนการยากเกินไป',
    ],
    example_phrases: [
      '"ยุ่งยาก"',
      '"เหนื่อย"',
      '"ทำไม่ไหว"',
      '"ขั้นตอนเยอะ"',
    ],
    audience_hint: 'ผู้บริโภคที่ต้องการความสะดวก ลดความยุ่งยาก',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ความยุ่งยาก" — ขั้นตอนซับซ้อน แรงงาน การเดินทาง ความไม่สะดวก',
  },
  {
    id: 'social',
    icon: '🤐',
    label: 'อาย / กลัวคนมอง',
    description: 'กังวลเรื่องภาพลักษณ์ กลัวคนตัดสิน อยากดูดี',
    category_type: 'Emotional',
    typical_industries: ['beauty', 'fashion', 'health', 'education', 'luxury'],
    typical_audiences: ['วัยรุ่น', 'คนใส่ใจภาพลักษณ์', 'first-time user'],
    example_pains: [
      'กลัวเพื่อนล้อ',
      'อายที่จะถาม',
      'กลัวคนมอง',
      'ไม่กล้าลองของใหม่',
      'อยากดูดี แต่ไม่รู้จะเริ่ม',
    ],
    example_phrases: [
      '"กลัวเพื่อนล้อ"',
      '"อายคนรู้"',
      '"ไม่กล้า"',
      '"กลัวผิดพลาด"',
    ],
    audience_hint: 'ผู้บริโภคที่กังวลเรื่องภาพลักษณ์',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ภาพลักษณ์" — ความอาย กลัวคนมอง กลัวถูกตัดสิน ความไม่มั่นใจ',
  },

  // ===== 3 NEW CATEGORIES (added 2026-07-26) =====
  // Based on emerging market trends 2026: identity, health, convenience

  {
    id: 'identity',
    icon: '🪞',
    label: 'อยากเป็น / อยากดูดี',
    description: 'อยากแสดงตัวตน เป็นส่วนหนึ่งของ tribe ได้รับการยอมรับ',
    category_type: 'Identity',
    typical_industries: ['fashion', 'luxury', 'social media', 'fitness', 'beauty', 'education'],
    typical_audiences: ['Gen Z', 'คนอยากเปลี่ยนสถานะ', 'content creator', 'first-jobber'],
    example_pains: [
      'อยากเป็นคนที่ประสบความสำเร็จ',
      'อยากเป็นส่วนหนึ่งของกลุ่ม',
      'รู้สึกว่าตัวเองไม่เข้ากับคนรอบข้าง',
      'อยากมี lifestyle ที่ดูดี',
      'อยากเปลี่ยนภาพลักษณ์ตัวเอง',
    ],
    example_phrases: [
      '"อยากเป็นเหมือนเขา"',
      '"อยากอัปสถานะ"',
      '"อยากเป็นที่ยอมรับ"',
      '"อยากเปลี่ยนชีวิต"',
    ],
    audience_hint: 'คนที่ต้องการแสดงตัวตน/อัปเกรดสถานะ',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "อัตลักษณ์" — ความอยากเป็น การแสดงสถานะ การยอมรับจากสังคม tribe',
  },

  {
    id: 'health_safety',
    icon: '🛡',
    label: 'สุขภาพ / ความปลอดภัย',
    description: 'กังวลเรื่องสุขภาพ ความปลอดภัย สารพิษ ผลข้างเคียง',
    category_type: 'Health',
    typical_industries: ['healthcare', 'food', 'beauty', 'children products', 'insurance', 'cleaning'],
    typical_audiences: ['คุณแม่', 'ผู้สูงอายุ', 'คนแพ้ง่าย', 'คนใส่ใจสุขภาพ', 'pet owners'],
    example_pains: [
      'กลัวสารเคมีตกค้าง',
      'ลูกแพ้อาหาร ไม่รู้ว่าตัวไหน',
      'กังวลผลข้างเคียงยา',
      'กลัวอุบัติเหตุ',
      'ไม่รู้ว่าของชิ้นนี้ปลอดภัยจริงไหม',
      'กลัวโรคระบาด',
    ],
    example_phrases: [
      '"ปลอดภัยจริงเหรอ"',
      '"มีสารเคมีไหม"',
      '"ลูกแพ้ง่าย"',
      '"กลัวเป็นอันตราย"',
    ],
    audience_hint: 'ผู้บริโภคที่กังวลสุขภาพและความปลอดภัย',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "สุขภาพและความปลอดภัย" — สารพิษ ผลข้างเคียง อาการแพ้ ความเสี่ยงต่อร่างกาย',
  },

  {
    id: 'convenience',
    icon: '⚡',
    label: 'ไม่สะดวก / ยุ่ง',
    description: 'ขั้นตอนเยอะ ต้องเดินทาง รอนาน ไม่มีบริการเสริม',
    category_type: 'Convenience',
    typical_industries: ['delivery', 'services', 'government', 'banking', 'healthcare', 'subscription'],
    typical_audiences: ['คนยุ่ง', 'คนทำงาน', 'ต่างจังหวัด', 'ผู้สูงอายุ', 'คนพิการ'],
    example_pains: [
      'ต้องไปธนาคาร 3 ครั้ง จึงจะเสร็จ',
      'รอคิว 2 ชั่วโมง',
      'ต้องโทรจองล่วงหน้า 7 วัน',
      'ต้องเดินทางไปเอง ไม่มี delivery',
      'ระบบล่มบ่อย',
      'ไม่มีบริการวันอาทิตย์',
    ],
    example_phrases: [
      '"ทำไมยุ่งยากจัง"',
      '"เมื่อไหร่จะเสร็จ"',
      '"มีบริการดีกว่านี้ไหม"',
      '"ต้องไปเองเหรอ"',
    ],
    audience_hint: 'ผู้บริโภคที่ต้องการความสะดวก รวดเร็ว ลดขั้นตอน',
    context_block: 'มุ่งเน้น pain points ที่เกี่ยวกับ "ความสะดวก" — ขั้นตอนซับซ้อน เวลารอ การเดินทาง การให้บริการนอกเวลา ระบบล่ม',
  },
];

export function getPainCategoryById(id: string): PainPointCategory | undefined {
  return PAIN_POINT_CATEGORIES.find(c => c.id === id);
}
