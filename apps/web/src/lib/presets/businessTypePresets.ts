/**
 * Business Type + Industry Presets
 * Based on NAICS (North American Industry Classification System) + Thai SME context
 * Top-level business types (15) → sub-industries (5-10 per type)
 *
 * Why this structure:
 *   - User picks business type first (broad, easy to scan)
 *   - Industry options filter to match the chosen type
 *   - Custom option always available
 */

export type BusinessType = {
  id: string;
  icon: string;
  label: string;
  description: string;
  industries: string[];
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'fnb',
    icon: '🍜',
    label: 'อาหารและเครื่องดื่ม',
    description: 'ร้านอาหาร คาเฟ่ เบเกอรี่ ไอศกรีม delivery',
    industries: [
      'ร้านอาหารทั่วไป',
      'คาเฟ่/กาแฟ specialty',
      'เบเกอรี่/ขนมหวาน',
      'ร้านก๋วยเตี๋ยว/ราเมง',
      'ฟาสต์ฟู้ด',
      'รถเข็น/สตรีทฟู้ด',
      'ร้านข้าวตามสั่ง',
      'Fine dining',
      'บาร์/ผับ/ร้านเหล้า',
      'Cloud kitchen / Delivery-only',
      'โรงงานผลิตอาหาร/อาหารแช่แข็ง',
      'ชานมไข่มุก',
      'ไอศกรีม/โยเกิร์ต',
      'ผลไม้สด/น้ำผลไม้',
    ],
  },
  {
    id: 'retail',
    icon: '🛍',
    label: 'ค้าปลีก',
    description: 'ร้านค้า ซูเปอร์มาร์เก็ต เสื้อผ้า ของใช้',
    industries: [
      'ร้านค้าทั่วไป/โชว์ห่วย',
      'ซูเปอร์มาร์เก็ต/ไฮเปอร์มาร์เก็ต',
      'ร้านเสื้อผ้า/แฟชั่น',
      'ร้านรองเท้า/กระเป๋า',
      'ร้านเครื่องสำอาง/ความงาม',
      'ร้านเฟอร์นิเจอร์/ของแต่งบ้าน',
      'ร้านอิเล็กทรอนิกส์/มือถือ',
      'ร้านหนังสือ/เครื่องเขียน',
      'ร้านกีฬา/อุปกรณ์กีฬา',
      'ร้านของเล่น/ของสะสม',
      'ร้านดอกไม้/ของขวัญ',
      'ร้านเครื่องประดับ',
      'Minimart/ร้านสะดวกซื้อ',
    ],
  },
  {
    id: 'service',
    icon: '🛠',
    label: 'บริการ',
    description: 'ซ่อม ช่าง ที่ปรึกษา ขนส่ง ดูแล',
    industries: [
      'ซ่อมรถ/อู่',
      'ซ่อมเครื่องใช้ไฟฟ้า/มือถือ',
      'ช่างไฟ/ช่างประปา',
      'ทำความสะอาด/แม่บ้าน',
      'ขนส่ง/delivery',
      'ที่ปรึกษาธุรกิจ/การเงิน',
      'กฎหมาย/ทนาย',
      'บัญชี/สอบบัญชี',
      'ล้างรถ',
      'รับ-ส่งสนามบิน',
      'ถ่ายภาพ/วิดีโอ',
      'จัดงานแต่ง/อีเวนต์',
      'รถเช่า',
      'คาร์แคร์',
    ],
  },
  {
    id: 'manufacturing',
    icon: '🏭',
    label: 'การผลิต',
    description: 'โรงงาน OEM ODM ผลิตสินค้า',
    industries: [
      'เสื้อผ้า/สิ่งทอ/แฟชั่น',
      'อาหาร/เครื่องดื่ม',
      'เฟอร์นิเจอร์/ไม้',
      'เครื่องสำอาง/ผลิตภัณฑ์ดูแลผิว',
      'ของเล่น/เกม',
      'อิเล็กทรอนิกส์/IoT',
      'ชิ้นส่วนยานยนต์',
      'บรรจุภัณฑ์',
      'เครื่องจักรกล/อุตสาหกรรม',
      'เคมีภัณฑ์',
      'พลาสติก/ยาง',
      'อัญมณี/เครื่องประดับ',
    ],
  },
  {
    id: 'tech_digital',
    icon: '💻',
    label: 'เทคโนโลยี/ดิจิทัล',
    description: 'SaaS แอป เว็บไซต์ ระบบอัจฉริยะ E-commerce',
    industries: [
      'SaaS / Cloud',
      'แอปพลิเคชันมือถือ',
      'เว็บไซต์/E-commerce',
      'ระบบอัจฉริยะ/ML/Data',
      'Fintech/การเงิน',
      'Edtech/การศึกษา',
      'Healthtech/สุขภาพ',
      'IoT/Hardware',
      'Cybersecurity',
      'Game/เกม',
      'IT Services/Outsource',
      'Digital Agency/โฆษณาออนไลน์',
      'Startup',
    ],
  },
  {
    id: 'education',
    icon: '📚',
    label: 'การศึกษา',
    description: 'โรงเรียน คอร์สออนไลน์ ติวเตอร์',
    industries: [
      'โรงเรียน/สถาบันการศึกษา',
      'คอร์สออนไลน์',
      'ติวเตอร์/กวดวิชา',
      'ศูนย์พัฒนาเด็กเล็ก',
      'สอนภาษา',
      'สอนดนตรี/ศิลปะ',
      'สอนทำอาหาร/เบเกอรี่',
      'Coding Bootcamp/สอนเขียนโปรแกรม',
      'Coaching/ที่ปรึกษา',
      'ศูนย์อบรม/สัมมนา',
    ],
  },
  {
    id: 'health_wellness',
    icon: '💊',
    label: 'สุขภาพ/ความงาม',
    description: 'คลินิก ร้านขายยา สปา ฟิตเนส',
    industries: [
      'คลินิกทั่วไป/คลินิกเฉพาะทาง',
      'โรงพยาบาล',
      'ร้านขายยา',
      'ทันตกรรม',
      'สปา/นวด',
      'ฟิตเนส/ยิม',
      'โภชนาการ/อาหารเสริม',
      'สมุนไพร/แพทย์แผนไทย',
      'ความงาม/เสริมความงาม',
      'ดูแลผู้สูงอายุ',
      'จิตแพทย์/ให้คำปรึกษา',
      'กายภาพบำบัด',
      'สัตวแพทย์/คลินิกสัตว์เลี้ยง',
    ],
  },
  {
    id: 'beauty_fashion',
    icon: '💄',
    label: 'แฟชั่น/ไลฟ์สไตล์',
    description: 'เสื้อผ้า เครื่องสำอาง สตูดิโอ',
    industries: [
      'แบรนด์เสื้อผ้า/แฟชั่น',
      'เครื่องสำอาง/สกินแคร์',
      'ซาลอน/ร้านตัดผม',
      'สปา/นวด',
      'สตูดิโอถ่ายภาพ',
      'ออกแบบเสื้อผ้า/ดีไซเนอร์',
      'เครื่องประดับ/อัญมณี',
      'ร้านรองเท้า/กระเป๋า',
      'ร้านเล็บ/ทำเล็บ',
      'Streetwear/Sneaker',
      'แฟชั่นมือสอง',
    ],
  },
  {
    id: 'real_estate',
    icon: '🏠',
    label: 'อสังหาริมทรัพย์/ก่อสร้าง',
    description: 'นายหน้า ที่ปรึกษา ก่อสร้าง ตกแต่ง',
    industries: [
      'นายหน้าอสังหาริมทรัพย์',
      'ที่ปรึกษาซื้อ-ขาย/ให้เช่า',
      'บริหารจัดการอาคาร/ห้องเช่า',
      'ก่อสร้าง/รับเหมา',
      'ตกแต่งภายใน/Interior',
      'พัฒนาอสังหาริมทรัพย์/Developer',
      'โรงงาน/คลังสินค้าให้เช่า',
      'Co-working space',
      'โรงแรม/ที่พัก',
    ],
  },
  {
    id: 'tourism_hospitality',
    icon: '✈️',
    label: 'ท่องเที่ยว/โรงแรม',
    description: 'โรงแรม รีสอร์ท ทัวร์ ร้านอาหาร',
    industries: [
      'โรงแรม',
      'รีสอร์ท',
      'เกสต์เฮาส์/โฮมสเตย์',
      'ทัวร์/ไกด์',
      'รถเช่า/รถตู้',
      'สายการบิน',
      'เรือ/แพ/ที่พักริมน้ำ',
      'ร้านอาหารในโรงแรม',
      'Hostel',
      'Camping/Glamping',
    ],
  },
  {
    id: 'agriculture',
    icon: '🌾',
    label: 'เกษตร/ปศุสัตว์',
    description: 'ฟาร์ม สวน ประมง ออร์แกนิก',
    industries: [
      'ปลูกพืช/ไร่/นา',
      'สวนผลไม้/ผัก',
      'เลี้ยงสัตว์/ฟาร์ม',
      'ประมง/เพาะเลี้ยงสัตว์น้ำ',
      'ออร์แกนิก/ปลอดสาร',
      'เกษตรแปรรูป',
      'ดอกไม้/ไม้ประดับ',
      'เห็ด/เพาะเห็ด',
    ],
  },
  {
    id: 'creative_media',
    icon: '🎨',
    label: 'สร้างสรรค์/สื่อ',
    description: 'โฆษณา PR ถ่ายภาพ ดนตรี content',
    industries: [
      'เอเจนซี่โฆษณา',
      'PR/ประชาสัมพันธ์',
      'สตูดิโอถ่ายภาพ/วิดีโอ',
      'ดนตรี/ค่ายเพลง',
      'งานฝีมือ/Handmade',
      'ออกแบบกราฟิก/Branding',
      'Content Creator/Influencer',
      'Podcast/YouTube',
      'สื่อสิ่งพิมพ์/นิตยสาร',
      'Motion graphic/Animation',
    ],
  },
  {
    id: 'finance_insurance',
    icon: '💰',
    label: 'การเงิน/ประกันภัย',
    description: 'ธนาคาร สินเชื่อ ประกัน การลงทุน',
    industries: [
      'ธนาคาร',
      'สินเชื่อ/สถาบันการเงิน',
      'ประกันภัย/ประกันชีวิต',
      'การลงทุน/กองทุน',
      'บัญชี/ที่ปรึกษาภาษี',
      'Fintech/Payment',
      'ที่ปรึกษาการเงิน',
      'Wealth management',
      'Cryptocurrency',
    ],
  },
  {
    id: 'logistics',
    icon: '🚚',
    label: 'ขนส่ง/โลจิสติกส์',
    description: 'ขนส่งสินค้า delivery คลังสินค้า',
    industries: [
      'ขนส่งสินค้า/รถบรรทุก',
      'Delivery/Last mile',
      'คลังสินค้า/Warehouse',
      'Freight/นำเข้า-ส่งออก',
      'Supply chain/3PL',
      'พัสดุ/Courier',
      'Cold chain',
    ],
  },
  {
    id: 'other',
    icon: '🌀',
    label: 'อื่น ๆ / ไม่แน่ใจ',
    description: 'ไม่เข้าหมวดข้างบน หรือธุรกิจเฉพาะทาง',
    industries: [
      'องค์กรไม่แสวงหากำไร/NGO',
      'สมาคม/ชมรม',
      'ภาครัฐ/ราชการ',
      'ศาสนา/วัด',
      'การศึกษา/วิจัย',
      'อื่น ๆ (พิมพ์เอง)',
    ],
  },
];

/**
 * Get industries for a specific business type
 */
export function getIndustriesForType(typeId: string): string[] {
  return BUSINESS_TYPES.find(t => t.id === typeId)?.industries ?? [];
}

/**
 * Get a business type by id
 */
export function getBusinessTypeById(id: string): BusinessType | undefined {
  return BUSINESS_TYPES.find(t => t.id === id);
}
