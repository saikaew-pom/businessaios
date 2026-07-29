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
    label: '📧 Email Subject',
    desc: '≤ 60 ตัวอักษร, urgency + curiosity, เปิดอ่าน',
    best_hook_length: '30-60 ตัวอักษร',
  },
  {
    id: 'landing_page',
    label: '🌐 Landing Page',
    desc: '≤ 10 คำ, benefit + audience, hero section',
    best_hook_length: '5-10 คำ',
  },
];

export const HOOK_CATEGORIES = [
  { id: 'curiosity', label: '🔍 Curiosity', desc: 'สร้างความอยากรู้ "สิ่งที่คุณไม่เคยรู้..."' },
  { id: 'pain', label: '😰 Pain Point', desc: 'ชี้ปัญหาให้ชัด "เบื่อไหมกับ X?"' },
  { id: 'story', label: '📖 Story', desc: 'เล่าเรื่องจริง "เมื่อวานลูกค้าโทรมาบอกฉัน..."' },
  { id: 'stat', label: '📊 Stat/Number', desc: 'ตัวเลข "87% ของ X ทำพลาด..."' },
  { id: 'question', label: '❓ Question', desc: 'คำถามปลายเปิด "คุณรู้ไหมว่าทำไม...?"' },
  { id: 'contrarian', label: '⚡ Contrarian', desc: 'ตรงข้าม "อย่าทำ X แบบนี้ (ผิด)"' },
  { id: 'listicle', label: '📋 Listicle', desc: 'รายการ "5 วิธีทำ X ให้ Y"' },
  { id: 'pattern_interrupt', label: '⛔ Pattern Interrupt', desc: 'หยุด scroll "หยุด! X ไม่ใช่แบบที่คุณคิด"' },
  { id: 'big_promise', label: '🎯 Big Promise', desc: 'สัญญาใหญ่ "วิธีทำ X ใน 7 วัน"' },
  { id: 'identity', label: '👤 Identity', desc: 'กลุ่มเป้าหมาย "ถ้าคุณเป็น X คุณต้องอ่านนี่"' },
];

export const CAMPAIGN_GOALS = [
  { id: 'awareness', label: '👀 Awareness (สร้างการรับรู้)' },
  { id: 'engagement', label: '💬 Engagement (กระตุ้น engagement)' },
  { id: 'traffic', label: '🚀 Traffic (ดึง traffic เข้าเว็บ)' },
  { id: 'leads', label: '📝 Leads (เก็บ lead)' },
  { id: 'conversion', label: '💰 Conversion (ปิดการขาย)' },
  { id: 'retention', label: '🔁 Retention (รักษาลูกค้า)' },
];

export const BRAND_VOICE_OPTIONS = [
  { id: 'friendly', label: '😊 เป็นกันเอง อบอุ่น' },
  { id: 'professional', label: '👔 Professional น่าเชื่อถือ' },
  { id: 'playful', label: '🎈 สนุก ตลก มีชีวิตชีวา' },
  { id: 'inspiring', label: '🌟 Inspiring สร้างแรงบันดาลใจ' },
  { id: 'authoritative', label: '🎓 Authoritative ผู้เชี่ยวชาญ' },
  { id: 'caring', label: '💝 Caring เอาใจใส่' },
];
