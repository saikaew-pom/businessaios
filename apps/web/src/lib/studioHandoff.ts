/**
 * Shared "send this content item to Studio" helpers — used by the
 * ContentItemDrawer, /works, and /inbox "สร้าง/เปลี่ยน Creative" buttons.
 * Previously duplicated three times (and had already drifted: inbox's aspect
 * ratio check was missing the 'short' format case the other two copies had).
 */
import type { ContentItem } from './api';

/**
 * Build the image-generation prompt for a content item. Deliberately does
 * NOT pass the item's hook/caption/CTA copy to the model as text to render —
 * image models (MiniMax included) cannot reliably draw legible text, and
 * asking them to produces garbled pseudo-text baked into the photo. Real
 * headline/CTA text belongs in the separate Composition Renderer template
 * overlay (the "+ ใส่ Template" step on a generated asset), which uses an
 * actual font instead of AI-drawn glyphs. The explicit "no text" instruction
 * also helps suppress cases where visual_suggestion itself describes an
 * on-image UI element (a labeled button, a logo, a price) that would
 * otherwise get the same garbled-text treatment.
 */
export function buildStudioPrompt(item: ContentItem): string {
  return [
    `สร้างภาพพื้นหลัง/องค์ประกอบภาพ (ไม่มีตัวอักษร) สำหรับโพสต์ ${item.platform || 'social media'} format ${item.format || 'post'}`,
    item.visual_suggestion,
    // "ถ้าคำอธิบายด้านบนพูดถึง..." explicitly overrides rather than just
    // restating the constraint — content items created before this fix have
    // a visual_suggestion that may itself describe a labeled button/logo/
    // price, and a parallel negation left the model to arbitrate between an
    // abstract rule and a concrete noun phrase (concrete usually won).
    'ห้ามมีตัวอักษร คำ ป้าย โลโก้ หรือตัวเลขในภาพเด็ดขาด — ถ้าคำอธิบายด้านบนพูดถึงตัวอักษร ป้าย ปุ่มมีข้อความ โลโก้ หรือราคา ให้ตัดสิ่งเหล่านั้นออกและวาดเฉพาะฉาก/องค์ประกอบภาพ แสง สี และบรรยากาศเท่านั้น จะใส่หัวข้อ/CTA ทีหลังด้วยเครื่องมือแยกต่างหาก',
  ].filter(Boolean).join('\n');
}

export function suggestedAspectRatio(item: ContentItem): string {
  if (item.format.includes('story') || item.format.includes('reel') || item.format.includes('short')) return '9:16';
  if (item.platform.includes('youtube')) return '16:9';
  return '1:1';
}
