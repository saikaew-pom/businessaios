/**
 * Million Dollar Offer Tool Presets
 * For tool: /tools/million-dollar-offer
 *
 * Dropdowns that help user think about their offer structure
 */

export const OFFER_TYPES = [
  {
    id: 'service_one_off',
    label: '🛎️ บริการครั้งเดียว',
    desc: 'ให้บริการรายครั้ง เช่น คอร์สเรียน, คลินิก, ที่ปรึกษา',
  },
  {
    id: 'subscription',
    label: '🔄 สมัครสมาชิกรายเดือน/ปี',
    desc: 'เก็บค่าสมาชิกต่อเนื่อง เช่น โปรแกรมออนไลน์, ฟิตเนส',
  },
  {
    id: 'product_bundle',
    label: '📦 ชุดสินค้ารวม',
    desc: 'รวมสินค้าหลายชิ้นเป็นชุด พร้อมของแถม',
  },
  {
    id: 'high_ticket',
    label: '💎 สินค้า/บริการราคาสูง',
    desc: 'ราคา ≥ 50,000 บาท ต่อข้อเสนอ เช่น งานที่ปรึกษา, บริการระดับพรีเมียม',
  },
  {
    id: 'cohort_program',
    label: '👥 คอร์สแบบกลุ่ม',
    desc: 'โปรแกรมกลุ่มที่เริ่มพร้อมกัน เช่น คอร์สเข้มข้น, โปรแกรมเร่งรัดธุรกิจ',
  },
  {
    id: 'course_diy',
    label: '🎓 คอร์สเรียนด้วยตัวเอง',
    desc: 'คอร์สออนไลน์เรียนเอง เช่น วิดีโอคอร์ส, ชุดอีบุ๊ก',
  },
  {
    id: 'physical_product',
    label: '🏷️ สินค้าจับต้องได้',
    desc: 'สินค้าจับต้องได้ พร้อมของแถม',
  },
];

export const DELIVERY_METHODS = [
  {
    id: '1on1',
    label: '👤 ตัวต่อตัว',
    desc: 'ให้บริการเฉพาะเจาะจง ลูกค้า 1 คน',
  },
  {
    id: 'small_group',
    label: '👥 กลุ่มเล็ก (3-10 คน)',
    desc: 'กลุ่มเล็ก ใกล้ชิด มีการพูดคุยโต้ตอบ',
  },
  {
    id: 'cohort',
    label: '🎪 กลุ่มใหญ่ (20-100 คน)',
    desc: 'กลุ่มใหญ่ที่รันพร้อมกัน',
  },
  {
    id: 'self_paced',
    label: '🎬 เรียนด้วยตัวเอง',
    desc: 'วิดีโอ/คอร์สออนไลน์ เรียนเมื่อไหร่ก็ได้',
  },
  {
    id: 'dfy',
    label: '🛠️ ทำให้ทั้งหมด',
    desc: 'เราทำให้ทั้งหมด ลูกค้าแค่รอ',
  },
  {
    id: 'dwy',
    label: '🤝 ทำด้วยกัน',
    desc: 'เราทำด้วย แนะนำ ลูกค้าทำเอง',
  },
  {
    id: 'diy',
    label: '📚 ทำเอง',
    desc: 'ลูกค้าทำเอง เรามีแบบฟอร์ม/คู่มือให้',
  },
];

export const GUARANTEE_TYPES = [
  {
    id: 'unconditional',
    label: '💯 Unconditional (ไม่มีเงื่อนไข)',
    desc: 'คืนเงิน 100% ไม่ถามเหตุผล ใน 30/60/90 วัน',
  },
  {
    id: 'conditional',
    label: '✅ Conditional (มีเงื่อนไข)',
    desc: 'คืนเงินถ้าทำตามเงื่อนไขครบ (เช่น เข้าเรียน 80%, ส่งงานครบ)',
  },
  {
    id: 'performance',
    label: '🏆 Performance (รับประกันผล)',
    desc: 'รับประกันผลลัพธ์ (เช่น ได้งานใน 90 วัน หรือเรียนฟรีต่อ)',
  },
  {
    id: 'anti_guarantee',
    label: '💪 Anti-Guarantee (ท้าทาย)',
    desc: '"ถ้าไม่เห็นผลใน 30 วัน เราจ่ายเงินเดือนให้คุณ" (bold, ลด risk ลูกค้า)',
  },
  {
    id: 'double',
    label: '🎁 Double Guarantee (2 เท่า)',
    desc: 'คืนเงิน + เก็บโบนัส (ลูกค้าได้ 2 ทาง)',
  },
];

export const SCARCITY_TYPES = [
  {
    id: 'cohort',
    label: '👥 Cohort-based (รับเฉพาะกลุ่ม)',
    desc: 'เปิดรับเฉพาะ cohort ที่กำหนด (เช่น Q1 2025)',
  },
  {
    id: 'seats',
    label: '🪑 Limited Seats (จำกัดที่นั่ง)',
    desc: 'มีที่นั่งจำกัด 20-50 ที่นั่ง (real capacity)',
  },
  {
    id: 'bonus_limited',
    label: '🎁 Limited Bonuses (โบนัสจำกัด)',
    desc: 'คนแรก 10 คนได้ bonus พิเศษ',
  },
  {
    id: 'seasonal',
    label: '📅 Seasonal (ตามฤดูกาล)',
    desc: 'เปิดเฉพาะช่วงเทศกาล/ฤดู',
  },
  {
    id: 'application',
    label: '📝 Application-based (ต้องสมัคร)',
    desc: 'ลูกค้าต้องสมัคร + เราคัดเลือก (qualification)',
  },
  {
    id: 'none',
    label: '— ไม่มี —',
    desc: 'อย่าใช้ fake scarcity (ทำลาย trust)',
  },
];

export const URGENCY_TYPES = [
  {
    id: 'deadline',
    label: '⏰ Hard Deadline',
    desc: 'ปิดรับวันที่กำหนด เช่น enrollment ปิด 31 ม.ค.',
  },
  {
    id: 'price_increase',
    label: '💸 Price Increase (ราคาขึ้นเร็วๆ นี้)',
    desc: 'ราคานี้ใช้ได้ถึง X แล้วราคาขึ้น 30%',
  },
  {
    id: 'bonus_expiry',
    label: '⏳ Bonus Expiring Soon',
    desc: 'Bonus หมดเขตเมื่อสมัครภายใน 7 วัน',
  },
  {
    id: 'cohort_start',
    label: '🚀 Cohort Starts Soon',
    desc: 'Cohort เริ่ม X วัน ต้องสมัครล่วงหน้า 1 สัปดาห์',
  },
  {
    id: 'none',
    label: '— ไม่มี —',
    desc: 'ใช้ scarcity อย่างเดียว',
  },
];

export const CONTAINER_WORDS = [
  'Bootcamp', 'Sprint', 'Workshop', 'Masterclass', 'System',
  'Blueprint', 'Formula', 'Protocol', 'Program', 'Challenge',
  'Method', 'Framework', 'Playbook', 'Accelerator', 'Intensive',
];

// =====================================================
// 7 Components of Unbeatable Offer — info cards
// =====================================================

export const OFFER_COMPONENTS = [
  {
    id: 'dream_outcome',
    icon: '🎯',
    title: 'Dream Outcome',
    thai: 'ผลลัพธ์ในฝัน',
    desc: 'ลูกค้าจะได้อะไร (vivid, specific)',
    area: 'numerator',
  },
  {
    id: 'value_stack',
    icon: '📚',
    title: 'Value Stack',
    thai: 'กองคุณค่า',
    desc: 'Core Offer + Bonuses ที่แก้ทุก pain',
    area: 'numerator',
  },
  {
    id: 'trim_stack',
    icon: '✂️',
    title: 'Trim & Stack',
    thai: 'ตัด + เสริม',
    desc: 'ตัด high-cost-low-value + เก็บ high-value-low-cost',
    area: 'numerator',
  },
  {
    id: 'pricing',
    icon: '💰',
    title: 'Pricing',
    thai: 'ราคา',
    desc: '5:1 ถึง 10:1 value-to-price ratio',
    area: 'leverage',
  },
  {
    id: 'guarantee',
    icon: '🛡️',
    title: 'Guarantee',
    thai: 'การันตี',
    desc: 'ย้าย risk จากลูกค้าไปหาเรา',
    area: 'numerator',
  },
  {
    id: 'scarcity_urgency',
    icon: '⏰',
    title: 'Scarcity & Urgency',
    thai: 'ความจำกัด + เร่งด่วน',
    desc: 'real limits + real deadlines',
    area: 'denominator',
  },
  {
    id: 'name',
    icon: '🏷️',
    title: 'Name (MAGIC)',
    thai: 'ชื่อ Offer',
    desc: 'Magnet + Avatar + Goal + Interval + Container',
    area: 'leverage',
  },
];

// Value Equation (4 levers)
export const VALUE_LEVERS = [
  {
    id: 'dream_outcome',
    name: 'Dream Outcome',
    thai: 'ผลลัพธ์ที่ฝันถึง',
    direction: 'เพิ่ม ↑',
    position: 'numerator',
    example: 'ลูกค้าต้องการผลลัพธ์อะไรมากที่สุด',
  },
  {
    id: 'perceived_likelihood',
    name: 'Perceived Likelihood',
    thai: 'ความมั่นใจว่าจะสำเร็จ',
    direction: 'เพิ่ม ↑',
    position: 'numerator',
    example: 'ลูกค้าเชื่อมั่นแค่ไหนว่าจะได้ผล',
  },
  {
    id: 'time_delay',
    name: 'Time Delay',
    thai: 'ระยะเวลารอผล',
    direction: 'ลด ↓',
    position: 'denominator',
    example: 'นานแค่ไหนกว่าจะเห็นผล',
  },
  {
    id: 'effort_sacrifice',
    name: 'Effort & Sacrifice',
    thai: 'ความยาก + สิ่งที่ต้องแลก',
    direction: 'ลด ↓',
    position: 'denominator',
    example: 'ลูกค้าต้องทำอะไรบ้าง',
  },
];
