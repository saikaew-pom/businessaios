/**
 * Strategic Tool Chain — guides users through a logical sequence
 * of tools that build on each other's outputs.
 *
 * Chain: Pain Point → Persona → JTBD → VPC → BMC → Million Dollar Offer
 * Tactical: Brand Voice, Competitor, Objection Handler, Hook Library (used as inputs)
 */

export interface ChainTool {
  id: string;             // tool_type in DB
  slug: string;           // URL slug
  label: string;          // Thai short name
  emoji: string;          // icon
  color: string;          // hex color
  hint: string;           // 1-line why this tool matters next
}

export const STRATEGIC_CHAIN: ChainTool[] = [
  { id: 'pain_generator', slug: 'pain-generator', label: 'Pain Point', emoji: '🎯', color: '#3b82f6', hint: 'ค้นหาความเจ็บปวดจริง ๆ ของลูกค้า' },
  { id: 'persona_builder', slug: 'persona-builder', label: 'Persona', emoji: '👥', color: '#10b981', hint: 'สร้างลูกค้าในอุดมคติที่ชัดเจน' },
  { id: 'jtbd_generator', slug: 'jtbd-generator', label: 'JTBD', emoji: '🎯', color: '#f97316', hint: 'เข้าใจงานที่ลูกค้าจ้างผลิตภัณฑ์มาทำ' },
  { id: 'value_proposition_canvas', slug: 'value-proposition-canvas', label: 'VPC', emoji: '💎', color: '#8b5cf6', hint: 'จับคู่ Value กับ Customer jobs/pains' },
  { id: 'business_model_canvas', slug: 'business-model-canvas', label: 'BMC', emoji: '📊', color: '#6366f1', hint: 'ออกแบบ Business Model 9 building blocks' },
  { id: 'million_dollar_offer', slug: 'million-dollar-offer', label: 'Offer', emoji: '💎', color: '#f59e0b', hint: 'สร้างข้อเสนอที่ปฏิเสธไม่ได้' },
];

const CHAIN_ORDER_KEY = 'businessaios.tool_chain_order';

/**
 * Get user-customized chain order. Falls back to default if not set.
 * Stored in localStorage. Reorderable from dashboard widget.
 */
export function getUserChainOrder(): ChainTool[] {
  if (typeof localStorage === 'undefined') return STRATEGIC_CHAIN;
  try {
    const raw = localStorage.getItem(CHAIN_ORDER_KEY);
    if (!raw) return STRATEGIC_CHAIN;
    const order: string[] = JSON.parse(raw);
    if (!Array.isArray(order) || order.length !== STRATEGIC_CHAIN.length) return STRATEGIC_CHAIN;
    // Map ids to full tool objects
    const ordered: ChainTool[] = [];
    for (const id of order) {
      const tool = STRATEGIC_CHAIN.find(t => t.id === id);
      if (tool) ordered.push(tool);
    }
    return ordered.length === STRATEGIC_CHAIN.length ? ordered : STRATEGIC_CHAIN;
  } catch {
    return STRATEGIC_CHAIN;
  }
}

/**
 * Save user-customized chain order to localStorage.
 */
export function saveUserChainOrder(order: ChainTool[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const ids = order.map(t => t.id);
    localStorage.setItem(CHAIN_ORDER_KEY, JSON.stringify(ids));
  } catch {}
}

/**
 * Reset to default order.
 */
export function resetUserChainOrder(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(CHAIN_ORDER_KEY);
}

/**
 * Get chain tools after the current tool (what to do next).
 * Returns empty array if no next tool.
 */
export function getNextTools(currentToolId: string): ChainTool[] {
  const chain = getUserChainOrder();
  const idx = chain.findIndex(t => t.id === currentToolId);
  if (idx === -1 || idx === chain.length - 1) return [];
  return chain.slice(idx + 1);
}

/**
 * Get chain tools before the current tool (what user should have done first).
 */
export function getPrevTools(currentToolId: string): ChainTool[] {
  const chain = getUserChainOrder();
  const idx = chain.findIndex(t => t.id === currentToolId);
  if (idx <= 0) return [];
  return chain.slice(0, idx);
}

/**
 * Get current tool position info.
 */
export function getChainPosition(currentToolId: string): { current: ChainTool; index: number; total: number } | null {
  const chain = getUserChainOrder();
  const idx = chain.findIndex(t => t.id === currentToolId);
  if (idx === -1) return null;
  return { current: chain[idx], index: idx, total: chain.length };
}

/**
 * Tactical tools (used as inputs to other tools, not part of main chain)
 */
export const TACTICAL_TOOLS: ChainTool[] = [
  { id: 'brand_voice', slug: 'brand-voice', label: 'Brand Voice', emoji: '🎙️', color: '#a855f7', hint: 'น้ำเสียงแบรนด์' },
  { id: 'competitor_analysis', slug: 'competitor-analysis', label: 'Competitor', emoji: '🔍', color: '#ef4444', hint: 'วิเคราะห์คู่แข่ง' },
  { id: 'objection_handler', slug: 'objection-handler', label: 'Objections', emoji: '🛡️', color: '#f43f5e', hint: 'จัดการข้อโต้แย้ง' },
  { id: 'hook_library', slug: 'hook-library', label: 'Hooks', emoji: '🎣', color: '#14b8a6', hint: 'คลัง Hook & Headlines' },
];
