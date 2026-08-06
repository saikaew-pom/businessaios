/**
 * Hook Library Tool Presets
 * For tool: /tools/hook-library
 */

export const PLATFORMS = [
  {
    id: 'facebook',
    label: '📘 Facebook',
    desc: 'ยาว 1-2 บรรทัด, ใช้ emotion ได้, engagement ads',
    best_hook_length: '40-80 ตัวอักษร',
  },
  {
    id: 'instagram',
    label: '📷 Instagram',
    desc: 'สั้น กระชับ, ใช้ emoji, เน้น visual, reels',
    best_hook_length: '20-50 ตัวอักษร',
  },
  {
    id: 'youtube',
    label: '▶️ YouTube',
    desc: 'ยาวได้, ตั้งคำถาม + promise, video title',
    best_hook_length: '50-100 ตัวอักษร',
  },
  {
    id: 'tiktok',
    label: '🎵 TikTok',
    desc: 'สั้นมาก, ตรง + ตลก + pattern interrupt',
    best_hook_length: '10-30 ตัวอักษร',
  },
  {
    id: 'email',
    label: '📧 หัวข้ออีเมล',
    desc: '≤ 60 ตัวอักษร, urgency + curiosity, เปิดอ่าน',
    best_hook_length: '30-60 ตัวอักษร',
  },
  {
    id: 'landing_page',
    label: '🌐 หน้าเว็บปิดการขาย (Landing Page)',
    desc: '≤ 10 คำ, benefit + audience, hero section',
    best_hook_length: '5-10 คำ',
  },
];

export const HOOK_CATEGORIES = [
  { id: 'curiosity', label: '🔍 ความอยากรู้', desc: 'สร้างความอยากรู้ "สิ่งที่คุณไม่เคยรู้..."' },
  { id: 'pain', label: '😰 ปัญหาที่เจอ', desc: 'ชี้ปัญหาให้ชัด "เบื่อไหมกับ X?"' },
  { id: 'story', label: '📖 เล่าเรื่องจริง', desc: 'เล่าเรื่องจริง "เมื่อวานลูกค้าโทรมาบอกฉัน..."' },
  { id: 'stat', label: '📊 ตัวเลข/สถิติ', desc: 'ตัวเลข "87% ของ X ทำพลาด..."' },
  { id: 'question', label: '❓ คำถาม', desc: 'คำถามปลายเปิด "คุณรู้ไหมว่าทำไม...?"' },
  { id: 'contrarian', label: '⚡ พูดสวนทาง', desc: 'ตรงข้าม "อย่าทำ X แบบนี้ (ผิด)"' },
  { id: 'listicle', label: '📋 แบบลิสต์รายการ', desc: 'รายการ "5 วิธีทำ X ให้ Y"' },
  { id: 'pattern_interrupt', label: '⛔ หยุดสายตาคนเลื่อนจอ', desc: 'หยุด scroll "หยุด! X ไม่ใช่แบบที่คุณคิด"' },
  { id: 'big_promise', label: '🎯 สัญญาใหญ่', desc: 'สัญญาใหญ่ "วิธีทำ X ใน 7 วัน"' },
  { id: 'identity', label: '👤 เจาะกลุ่มคนเฉพาะ', desc: 'กลุ่มเป้าหมาย "ถ้าคุณเป็น X คุณต้องอ่านนี่"' },
];

export const CAMPAIGN_GOALS = [
  { id: 'awareness', label: '👀 สร้างการรับรู้' },
  { id: 'engagement', label: '💬 กระตุ้นคนมามีส่วนร่วม' },
  { id: 'traffic', label: '🚀 ดึงคนเข้าเว็บ' },
  { id: 'leads', label: '📝 เก็บเบอร์ลูกค้าที่สนใจ' },
  { id: 'conversion', label: '💰 ปิดการขาย' },
  { id: 'retention', label: '🔁 รักษาลูกค้าเก่า' },
];

export const BRAND_VOICE_OPTIONS = [
  { id: 'friendly', label: '😊 เป็นกันเอง อบอุ่น' },
  { id: 'professional', label: '👔 มืออาชีพ น่าเชื่อถือ' },
  { id: 'playful', label: '🎈 สนุก ตลก มีชีวิตชีวา' },
  { id: 'inspiring', label: '🌟 สร้างแรงบันดาลใจ' },
  { id: 'authoritative', label: '🎓 พูดแบบผู้เชี่ยวชาญ' },
  { id: 'caring', label: '💝 เอาใจใส่' },
];
