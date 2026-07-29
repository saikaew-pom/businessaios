/**
 * Objection Handler Tool Presets
 * For tool: /tools/objection-handler
 */

export const SALES_CHANNELS = [
  {
    id: 'dm',
    label: '💬 Direct Message (DM)',
    desc: 'ขายผ่าน LINE/IG/Facebook DM',
  },
  {
    id: 'phone',
    label: '📞 Phone Call (โทร)',
    desc: 'โทรขาย ปิดการขายทางโทรศัพท์',
  },
  {
    id: 'in_store',
    label: '🏬 In-Store (หน้าร้าน)',
    desc: 'ขายที่หน้าร้าน พนักงานแนะนำ',
  },
  {
    id: 'web',
    label: '🌐 Website (ออนไลน์)',
    desc: 'ขายผ่านเว็บไซต์ FAQ/landing page',
  },
  {
    id: 'webinar',
    label: '🎤 Webinar (สัมมนา)',
    desc: 'ขายผ่าน webinar/zoom',
  },
  {
    id: 'consult',
    label: '🛎️ Consultation (ปรึกษา)',
    desc: 'ขายผ่านการปรึกษา 1-on-1',
  },
];

export const PRICE_POSITIONS = [
  { id: 'premium', label: '💎 Premium (ราคาสูง)' },
  { id: 'mid', label: '⚖️ Mid-Range (ราคากลาง)' },
  { id: 'budget', label: '💰 Budget (ราคาถูก)' },
  { id: 'free', label: '🆓 Free (ฟรี)' },
];

export const OBJECTION_CATEGORIES = [
  { id: 'price', label: '💰 Price', desc: 'แพงไป / ไม่มีงบ / มีที่ถูกกว่า' },
  { id: 'trust', label: '🤝 Trust', desc: 'ไม่เคยใช้ / กลัวโกง / ไม่มีรีวิว' },
  { id: 'need', label: '🎯 Need', desc: 'ไม่จำเป็น / มีอยู่แล้ว / ใช้ของเก่า' },
  { id: 'time', label: '⏱️ Time', desc: 'ไม่มีเวลา / ยุ่งอยู่ / ไว้ก่อน' },
  { id: 'authority', label: '👤 Authority', desc: 'ต้องถามหัวหน้า / ต้องปรึกษาเมีย' },
  { id: 'comparison', label: '⚖️ Comparison', desc: 'เทียบกับคู่แข่ง / ทำไม่เหมือนคนอื่น' },
  { id: 'risk', label: '⚠️ Risk', desc: 'กลัวล้มเหลว / กลัวเสียเงิน' },
];

export const REFRAME_STRATEGIES = [
  {
    id: 'value',
    label: '💎 Reframe to Value',
    desc: 'เทียบราคา vs คุณค่ารวม (Value Stack)',
  },
  {
    id: 'cost_of_inaction',
    label: '⚠️ Reframe to Cost of Inaction',
    desc: 'ไม่ทำ = เสียมากกว่า (เสียโอกาส/เสียรายได้)',
  },
  {
    id: 'comparison',
    label: '🔄 Reframe to Comparison',
    desc: 'เทียบกับทางเลือกอื่น (คู่แข่ง / ไม่ทำอะไร)',
  },
  {
    id: 'risk_reversal',
    label: '🛡️ Reframe to Risk Reversal',
    desc: 'guarantee ลดความเสี่ยง 100%',
  },
  {
    id: 'identity',
    label: '👥 Reframe to Identity',
    desc: 'ลูกค้าแบบไหนใช้สินค้านี้ (social proof)',
  },
  {
    id: 'time',
    label: '⏰ Reframe to Time',
    desc: 'เวลา = เงิน (ค่าเสียโอกาสถ้ารอ)',
  },
  {
    id: 'roi',
    label: '📈 Reframe to ROI',
    desc: 'ลงทุนเท่าไหร่ ได้คืนเท่าไหร่',
  },
];
