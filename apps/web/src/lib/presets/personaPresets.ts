/**
 * Persona Presets — 8 Thai SME B2C personas
 * Based on Jobs-to-be-Done (Christensen) + Demographics + Psychographics
 */

export type PersonaPreset = {
  id: string;
  icon: string;
  name: string;        // persona name like "พี่หมู"
  nickname: string;    // short label
  description: string;  // who they are
  age: string;
  job: string;
  income: string;
  location: string;
  family: string;
  psychographics: {
    values: string;
    interests: string;
    fears: string;
    aspirations: string;
  };
  common_pains: string[];
  channels: string[];
  preferred_messages: string;
  preferred_offers: string;
  industries: string[];  // what industries this persona is relevant for
};

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'working_professional',
    icon: '👩‍💼',
    name: 'พี่หมู',
    nickname: 'พนักงานออฟฟิศ',
    description: 'คนทำงานออฟฟิศยุคใหม่ อายุ 25-35 ใช้ชีวิตเร็ว ชอบความสะดวก',
    age: '26-35',
    job: 'พนักงานออฟฟิศ / ไอที / การตลาด / บัญชี',
    income: '25,000-60,000 บาท/เดือน',
    location: 'กรุงเทพฯ และเมืองใหญ่',
    family: 'โสด / คู่รัก ไม่มีลูก',
    psychographics: {
      values: 'ประสิทธิภาพ ความสะดวก ดูดี มีรสนิยม',
      interests: 'คาเฟ่ ท่องเที่ยว อาหาร IG-able ดู Netflix ออกกำลังกาย',
      fears: 'เสียเวลา ตกงาน ดูไม่ดี ไม่ทันเทรนด์',
      aspirations: 'เติบโตในสายอาชีพ มี passive income เกษียณเร็ว ชีวิตสมดุล',
    },
    common_pains: [
      'ไม่มีเวลาทำอาหาร',
      'อยากดูดีแต่งบน้อย',
      'ต้องการของสะดวก ซื้อง่าย',
      'กลัวตกเทรนด์',
    ],
    channels: ['Instagram', 'Facebook', 'LINE', 'TikTok', 'LINE MAN'],
    preferred_messages: 'สั้น กระชับ มี visual สวย ชัดเจน',
    preferred_offers: 'โปรโมชั่นช่วงเที่ยง, subscription, ของพร้อมส่ง',
    industries: ['F&B delivery', 'คาเฟ่', 'fashion', 'beauty', 'SaaS productivity', 'fitness'],
  },

  {
    id: 'sme_owner',
    icon: '👨‍🍳',
    name: 'พี่ต้น',
    nickname: 'เจ้าของ SME',
    description: 'เจ้าของธุรกิจขนาดเล็ก-กลาง ทำเองทุกอย่าง ขาดคนช่วย',
    age: '30-50',
    job: 'เจ้าของร้าน/ธุรกิจ/โรงงาน',
    income: '50,000-200,000 บาท/เดือน (ผันผวน)',
    location: 'ทั่วประเทศ',
    family: 'แต่งงานแล้ว มีลูก',
    psychographics: {
      values: 'ความอยู่รอด การเติบโต ครอบครัว ความซื่อสัตย์',
      interests: 'หาลูกค้าใหม่ ลดต้นทุน เทคโนโลยีที่ช่วยงาน',
      fears: 'ขาดทุน คู่แข่ง ลูกน้องไม่ซื่อสัตย์ ลูกค้าหาย',
      aspirations: 'ธุรกิจเติบโต มีเวลาให้ครอบครัว ขยายสาขา ส่งต่อลูก',
    },
    common_pains: [
      'งบโฆษณาจำกัด',
      'ทำการตลาดเองไม่เป็น',
      'ขาดคนช่วยงาน',
      'ลูกค้าไม่กลับมาซื้อซ้ำ',
    ],
    channels: ['Facebook', 'LINE Official', 'YouTube', 'TikTok'],
    preferred_messages: 'ตรงๆ เข้าใจง่าย เห็นผลจริง ไม่เวอร์',
    preferred_offers: 'เครื่องมือช่วยงาน, คอร์สออนไลน์, ที่ปรึกษาฟรี, เคสจริง',
    industries: ['SME tools', 'POS', 'accounting', 'marketing services', 'B2B SaaS', 'logistics'],
  },

  {
    id: 'student',
    icon: '👩‍🎓',
    name: 'น้องนัท',
    nickname: 'นักศึกษา',
    description: 'วัยรุ่น-นักศึกษา ใช้เงินจำกัด ตามเทรนด์ TikTok',
    age: '18-24',
    job: 'นักศึกษา / ฝึกงาน / part-time',
    income: '5,000-15,000 บาท/เดือน (จากผู้ปกครอง/พาร์ทไทม์)',
    location: 'ในเมืองมหาวิทยาลัย',
    family: 'ยังอยู่กับครอบครัว',
    psychographics: {
      values: 'เป็นตัวเอง ตามเทรนด์ ความเท่าเทียม',
      interests: 'TikTok IG Reels เกม คาเฟ่ คอนเสิร์ต fashion',
      fears: 'ไม่เท่ ตกเทรนด์ เพื่อนล้อ เงินไม่พอ',
      aspirations: 'มีรายได้ มีงานดีๆ มีคอนเทนต์ มีชื่อเสียง',
    },
    common_pains: [
      'เงินไม่พอ',
      'อยากลองของใหม่แต่แพง',
      'กลัวเพื่อนล้อ',
      'ไม่รู้จะเริ่มต้นยังไง',
    ],
    channels: ['TikTok', 'Instagram', 'Twitter', 'Shopee', 'LINE'],
    preferred_messages: 'สั้น ตลก ตรง มี meme, influencer review',
    preferred_offers: 'ส่วนลดนักศึกษา, ผ่อน, free trial, ของถูก',
    industries: ['fashion', 'beauty', 'food delivery', 'streaming', 'mobile games', 'budget F&B'],
  },

  {
    id: 'new_mom',
    icon: '👩',
    name: 'พี่ใหม่',
    nickname: 'คุณแม่มือใหม่',
    description: 'คุณแม่ที่มีลูกเล็ก ใส่ใจทุกเรื่อง พร้อมจ่ายถ้าดีต่อลูก',
    age: '28-40',
    job: 'คุณแม่ full-time / part-time / work from home',
    income: '30,000-80,000 บาท/เดือน (ครอบครัว)',
    location: 'ในเมือง/หมู่บ้านจัดสรร',
    family: 'มีลูก 1-2 คน',
    psychographics: {
      values: 'ความปลอดภัย ครอบครัว สุขภาพ คุณภาพ',
      interests: 'ของใช้เด็ก อาหารเด็ก สุขภาพ การเลี้ยงลูก',
      fears: 'ลูกป่วย ของไม่ปลอดภัย ลูกตามเพื่อนไม่ทัน',
      aspirations: 'ลูกเติบโตดี ครอบครัวมีความสุข มีเวลาให้ลูก',
    },
    common_pains: [
      'เวลาน้อย ไม่ทันทำกับข้าว',
      'กลัวลูกแพ้ของ',
      'งบเท่าไหร่ก็ไม่พอ',
      'อยากให้ลูกดีที่สุด',
    ],
    channels: ['Facebook', 'LINE', 'Instagram', 'YouTube', 'Pantip'],
    preferred_messages: 'อบอุ่น น่าเชื่อถือ มีรีวิวจากคุณแม่ด้วยกัน',
    preferred_offers: 'ส่วนลด, free shipping, ทดลองฟรี, bundle',
    industries: ['baby products', 'kids education', 'healthy food', 'mom groups', 'childcare services'],
  },

  {
    id: 'health_conscious',
    icon: '💪',
    name: 'พี่เบส',
    nickname: 'สายสุขภาพ',
    description: 'คนรักสุขภาพ ออกกำลังกาย กินคลีน ใส่ใจส่วนผสม',
    age: '25-45',
    job: 'ออฟฟิศ/ฟรีแลนซ์/เจ้าของกิจการ',
    income: '30,000-100,000 บาท/เดือน',
    location: 'กรุงเทพฯ / เมืองใหญ่',
    family: 'คละไป',
    psychographics: {
      values: 'สุขภาพ ความยั่งยืน คุณภาพ ความ透明 (โปร่งใส)',
      interests: 'ออกกำลังกาย โภชนาการ organic/plant-based, mindfulness',
      fears: 'ป่วย น้ำหนักขึ้น แก่เร็ว สารพิษสะสม',
      aspirations: 'สุขภาพดีถึง 80, แข็งแรง, รูปร่างดี, มีพลัง',
    },
    common_pains: [
      'ไม่มีเวลาออกกำลังกาย',
      'อาหารนอกบ้านไม่ดีต่อสุขภาพ',
      'หาของ clean label ยาก',
      'แพ้อาหารบางอย่าง',
    ],
    channels: ['Instagram', 'Facebook Groups', 'YouTube', 'LINE', 'Podcast'],
    preferred_messages: 'อ้างอิงวิทยาศาสตร์ โปร่งใส ไม่ขายฝัน',
    preferred_offers: 'ตัวอย่างฟรี, subscription, ส่วนลดเมื่อซื้อซ้ำ, content ฟรี',
    industries: ['organic food', 'supplements', 'fitness', 'wellness apps', 'healthy restaurants'],
  },

  {
    id: 'retiree',
    icon: '👴',
    name: 'ลุงใบหยก',
    nickname: 'วัยเกษียณ',
    description: 'ผู้สูงอายุ 55+ มีเวลาและเงิน แต่ไม่เก่งเทคโนโลยี',
    age: '55-75',
    job: 'เกษียณ / ทำสวน / ทำธุรกิจเล็กๆ',
    income: '15,000-30,000 บาท/เดือน (บำนาญ/ออม)',
    location: 'ต่างจังหวัด / ชานเมือง',
    family: 'มีลูก หลาน',
    psychographics: {
      values: 'สุขภาพ ครอบครัว ความคุ้มค่า ความปลอดภัย',
      interests: 'สุขภาพ อาหารเสริม ลูกหลาน ข่าวสาร งานอดิเรก',
      fears: 'ถูกหลอก เจ็บป่วย ไม่มีคนดูแล ลูกหลานไม่สนใจ',
      aspirations: 'สุขภาพดี มีเงินใช้ เห็นลูกหลานเติบโต',
    },
    common_pains: [
      'ไม่เก่งเทคโนโลยี',
      'กลัวถูกหลอกจากโฆษณา',
      'ของแพงเกินไป',
      'หาของคุณภาพยาก',
    ],
    channels: ['Facebook', 'LINE', 'TV', 'หนังสือพิมพ์', 'เพื่อนบอกต่อ'],
    preferred_messages: 'ช้าๆ อธิบายชัดเจน พูดสุภาพ มี call center',
    preferred_offers: 'ส่วนลดผู้สูงอายุ, ผ่อน 0%, ส่งฟรี',
    industries: ['health supplements', 'health insurance', 'TV shopping', 'local community', 'F&B'],
  },

  {
    id: 'gamer_tech',
    icon: '🎮',
    name: 'น้องเจ',
    nickname: 'เกมเมอร์ / สายเทค',
    description: 'วัยรุ่น-วัยทำงานตอนต้น สายเทค ติดเกม อยากได้ของ spec สูง',
    age: '16-28',
    job: 'นักเรียน/นักศึกษา/เกมเมอร์/สายไอที',
    income: '5,000-25,000 บาท/เดือน',
    location: 'กรุงเทพฯ / เมืองใหญ่',
    family: 'ส่วนใหญ่โสด',
    psychographics: {
      values: 'ประสิทธิภาพ ความล้ำ ชุมชน ความสนุก',
      interests: 'เกม เทคโนโลยีใหม่ anime/esport streaming',
      fears: 'ของเก่า ของช้า พลาดของดี คนเก่งกว่า',
      aspirations: 'มี PC แรง, มีเกมครบ, เป็น pro gamer, มีรายได้จาก streaming',
    },
    common_pains: [
      'ของ spec สูงแพง',
      'ของหมดเร็ว',
      'เกมอัปเดตบ่อย',
      'อยากเล่นเกมล่าสุด',
    ],
    channels: ['YouTube', 'Twitch', 'TikTok', 'Facebook Gaming', 'LINE Gaming'],
    preferred_messages: 'เร็ว ตรง มี spec ชัด เห็นรีวิวก่อน',
    preferred_offers: 'pre-order, bundle, ส่วนลด early bird, ผ่อน 0%',
    industries: ['gaming hardware', 'mobile games', 'streaming services', 'tech accessories'],
  },

  {
    id: 'freelance_creative',
    icon: '💼',
    name: 'พี่เจมส์',
    nickname: 'ฟรีแลนซ์ / ครีเอทีฟ',
    description: 'Designer / Writer / Dev / Photographer อิสระ รายได้ผันผวน',
    age: '25-40',
    job: 'Freelance Designer / Writer / Dev / Photographer / Marketing',
    income: '20,000-100,000 บาท/เดือน (ผันผวนมาก)',
    location: 'กรุงเทพฯ / Chiang Mai / ต่างจังหวัด',
    family: 'ส่วนใหญ่โสด',
    psychographics: {
      values: 'อิสระ ความคิดสร้างสรรค์ คุณภาพ การควบคุมตัวเอง',
      interests: 'งานออกแบบ เครื่องมือ productivity lifestyle',
      fears: 'งานหาย รายได้ไม่มา ไม่มี portfolio ถูกโกงค่าตัว',
      aspirations: 'มี passive income, ทำงานน้อยลงแต่ได้เงินเท่าเดิม, agency ของตัวเอง',
    },
    common_pains: [
      'หาลูกค้ายาก',
      'รายได้ไม่แน่นอน',
      'ต้องทำงานหลายอย่าง',
      'ขาด portfolio ที่ดี',
    ],
    channels: ['Instagram', 'Behance', 'LinkedIn', 'Facebook', 'Twitter'],
    preferred_messages: 'มี case study, มี data, ตรงกับ niche, design ดี',
    preferred_offers: 'free trial, lifetime deal, educational content, community',
    industries: ['SaaS productivity', 'creative tools', 'online courses', 'finance apps', 'co-working spaces'],
  },
];

export function getPersonaPresetById(id: string): PersonaPreset | undefined {
  return PERSONA_PRESETS.find(p => p.id === id);
}
