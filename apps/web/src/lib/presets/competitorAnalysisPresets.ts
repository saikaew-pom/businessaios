/**
 * Competitor Analysis Presets — focus areas + auto-find hints
 */

export type CompetitorFocusArea = {
  id: 'pricing' | 'positioning' | 'product' | 'marketing' | 'distribution';
  icon: string;
  label: string;
  description: string;
  context_hint: string;
};

export const COMPETITOR_FOCUS_AREAS: CompetitorFocusArea[] = [
  {
    id: 'pricing',
    icon: '💰',
    label: 'Pricing',
    description: 'ราคา ช่วงราคา กลยุทธ์ราคา',
    context_hint: 'วิเคราะห์ pricing strategy, price positioning, value-for-money ของคู่แข่ง',
  },
  {
    id: 'positioning',
    icon: '🎯',
    label: 'Positioning',
    description: 'คู่แข่ง position ตัวเองว่าอะไร',
    context_hint: 'วิเคราะห์ tagline, brand positioning, key message ของคู่แข่ง',
  },
  {
    id: 'product',
    icon: '📦',
    label: 'Product',
    description: 'จุดแข็ง-อ่อนของสินค้า/บริการคู่แข่ง',
    context_hint: 'วิเคราะห์ features, quality, USP ของสินค้าคู่แข่ง',
  },
  {
    id: 'marketing',
    icon: '📣',
    label: 'Marketing',
    description: 'ช่องทางการตลาด คอนเทนต์ โฆษณา',
    context_hint: 'วิเคราะห์ channels, content style, ad spend ของคู่แข่ง',
  },
  {
    id: 'distribution',
    icon: '🏬',
    label: 'Distribution',
    description: 'ช่องทางขาย หน้าร้าน ออนไลน์',
    context_hint: 'วิเคราะห์จุดขาย ช่องทางจัดจำหน่าย ความครอบคลุม',
  },
];

export function getFocusAreaById(id: string): CompetitorFocusArea | undefined {
  return COMPETITOR_FOCUS_AREAS.find(f => f.id === id);
}
