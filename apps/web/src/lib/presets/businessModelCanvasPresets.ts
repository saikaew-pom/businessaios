/**
 * Business Model Canvas (BMC) Presets
 * For tool: /tools/business-model-canvas
 * 4 dropdown fields with options to help user think about their business model
 */

export const REVENUE_MODELS = [
  {
    id: 'transactional',
    label: '💵 Transactional (ขายครั้งเดียว)',
    desc: 'ลูกค้าจ่ายเงินครั้งเดียวต่อหน่อย เช่น ขนม กาแฟ เสื้อผ้า',
  },
  {
    id: 'subscription',
    label: '🔄 Subscription (รายเดือน/ปี)',
    desc: 'ลูกค้าจ่ายต่อเนื่อง เช่น SaaS, สมาชิก, กล่องของขวัญรายเดือน',
  },
  {
    id: 'freemium',
    label: '🆓 Freemium (ฟรี + Premium)',
    desc: 'ใช้ฟรีได้ แต่จ่ายเพื่อ advanced features',
  },
  {
    id: 'marketplace',
    label: '🏪 Marketplace (2-sided)',
    desc: 'เชื่อมผู้ซื้อ-ผู้ขาย เก็บค่าคอมมิชชั่น เช่น Shopee, Grab',
  },
  {
    id: 'licensing',
    label: '📜 Licensing (ขาย license/IP)',
    desc: 'ขายสิทธิ์ในการใช้ เช่น software license, franchise, IP',
  },
  {
    id: 'ad_supported',
    label: '📢 Ad-supported (โฆษณา)',
    desc: 'ผู้ใช้ฟรี แต่ monetize จากโฆษณา เช่น Facebook, YouTube',
  },
  {
    id: 'service_fee',
    label: '🛎️ Service Fee (ค่าบริการ)',
    desc: 'คิดค่าบริการตามงาน/เวลา เช่น ที่ปรึกษา, agency, คลินิก',
  },
  {
    id: 'hybrid',
    label: '🔀 Hybrid (หลายรูปแบบผสม)',
    desc: 'ผสมหลาย revenue streams เช่น ขายขนม + ค่าเช่าหน้าร้าน + delivery',
  },
];

export const GEOGRAPHIC_SCOPES = [
  { id: 'local', label: '📍 Local (ท้องถิ่นเดียว)', desc: 'เฉพาะอำเภอ/จังหวัด' },
  { id: 'regional', label: '🗺️ Regional (ภูมิภาค)', desc: 'หลายจังหวัดในภาค เช่น ภาคใต้' },
  { id: 'national', label: '🇹🇭 National (ทั่วประเทศ)', desc: 'ครอบคลุมทั้งประเทศ' },
  { id: 'international', label: '🌏 International (ข้ามประเทศ)', desc: 'ขาย/ให้บริการข้ามประเทศ' },
];

export const DISTRIBUTION_MODELS = [
  {
    id: 'offline_only',
    label: '🏬 Offline only (หน้าร้านอย่างเดียว)',
    desc: 'ขายที่หน้าร้าน/ตลาด/บูธ ไม่มีออนไลน์',
  },
  {
    id: 'online_only',
    label: '💻 Online only (ออนไลน์อย่างเดียว)',
    desc: 'D2C เว็บ/แอป, marketplace, social commerce',
  },
  {
    id: 'omnichannel',
    label: '🔄 Omnichannel (ทั้งหน้าร้าน + ออนไลน์)',
    desc: 'มีทั้ง physical + digital + delivery เชื่อมกัน',
  },
  {
    id: 'wholesale_b2b',
    label: '📦 Wholesale / B2B',
    desc: 'ขายส่งให้ร้านอื่น/บริษัทอื่น',
  },
  {
    id: 'franchise',
    label: '🏪 Franchise (แฟรนไชส์)',
    desc: 'ขายสิทธิ์ให้คนอื่นเปิดสาขา',
  },
];

export const CURRENT_STAGES = [
  { id: 'idea', label: '💡 Idea (ยังเป็นไอเดีย)', desc: 'ยังไม่ได้เริ่ม กำลังวางแผน' },
  { id: 'pre_revenue', label: '🔨 Pre-revenue (ยังไม่มีรายได้)', desc: 'กำลังสร้าง MVP / pilot' },
  { id: 'early_growth', label: '🌱 Early Growth (เริ่มโต)', desc: 'มีรายได้ 0-1M/เดือน กำลังหา product-market fit' },
  { id: 'scaling', label: '🚀 Scaling (ขยายตัว)', desc: '1-10M/เดือน กำลัง scale ช่องทาง/ทีม' },
  { id: 'mature', label: '🏆 Mature (เติบโตเต็มที่)', desc: '10M+/เดือน mature business optimize' },
];

// =====================================================
// 9 BMC Building Blocks — info cards for UI
// =====================================================

export const BMC_BLOCKS = [
  {
    id: 'customer_segments',
    icon: '👥',
    title: 'Customer Segments',
    thai: 'กลุ่มลูกค้า',
    desc: 'ลูกค้ากลุ่มไหนที่เราสร้าง value ให้',
    area: 'desirability',
    color: 'blue',
  },
  {
    id: 'value_propositions',
    icon: '💎',
    title: 'Value Propositions',
    thai: 'ข้อเสนอคุณค่า',
    desc: 'เราให้ value อะไร ที่แก้ปัญหาหรือตอบโจทย์',
    area: 'desirability',
    color: 'purple',
  },
  {
    id: 'channels',
    icon: '📡',
    title: 'Channels',
    thai: 'ช่องทาง',
    desc: 'เราส่งมอบ value ให้ลูกค้ายังไง (5 phases)',
    area: 'feasibility',
    color: 'teal',
  },
  {
    id: 'customer_relationships',
    icon: '🤝',
    title: 'Customer Relationships',
    thai: 'ความสัมพันธ์',
    desc: 'เราสร้าง/รักษาความสัมพันธ์ยังไง',
    area: 'feasibility',
    color: 'cyan',
  },
  {
    id: 'revenue_streams',
    icon: '💰',
    title: 'Revenue Streams',
    thai: 'กระแสรายได้',
    desc: 'เราทำเงินจากอะไร',
    area: 'viability',
    color: 'emerald',
  },
  {
    id: 'key_resources',
    icon: '🔧',
    title: 'Key Resources',
    thai: 'ทรัพยากรหลัก',
    desc: 'เราต้องมีอะไรถึงจะส่งมอบ value ได้',
    area: 'feasibility',
    color: 'amber',
  },
  {
    id: 'key_activities',
    icon: '⚙️',
    title: 'Key Activities',
    thai: 'กิจกรรมหลัก',
    desc: 'เราต้องทำอะไรเป็นพิเศษ',
    area: 'feasibility',
    color: 'orange',
  },
  {
    id: 'key_partnerships',
    icon: '🤝',
    title: 'Key Partnerships',
    thai: 'พันธมิตรหลัก',
    desc: 'เราต้องพึ่งพาใครบ้าง',
    area: 'feasibility',
    color: 'pink',
  },
  {
    id: 'cost_structure',
    icon: '📊',
    title: 'Cost Structure',
    thai: 'โครงสร้างต้นทุน',
    desc: 'ต้นทุนหลัก ๆ ของเราคืออะไร',
    area: 'viability',
    color: 'red',
  },
];

// Business Model Patterns (Strategyzer taxonomy)
export const BUSINESS_MODEL_PATTERNS = [
  'Multi-sided Platform',
  'Subscription',
  'Freemium',
  'Long Tail',
  'Unbundled',
  'Open Business',
  'Razor & Blade',
  'Cash Conversion Cycle',
  'Franchise',
  'Aggregator',
  'Marketplace',
  'Direct-to-Consumer (D2C)',
  'Asset Light Service',
  'Bundled',
  'Hidden Revenue',
];
