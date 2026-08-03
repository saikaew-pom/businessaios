/**
 * Presentation Tool Presets (server-side mirror)
 * Keep in sync with /apps/web/src/lib/presets/presentationPresets.ts
 */

export interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textMuted: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: 'business_blue', name: 'Business Blue', primary: '#1d4ed8', secondary: '#3b82f6', accent: '#06b6d4', background: '#ffffff', text: '#0f172a', textMuted: '#64748b', chart1: '#1d4ed8', chart2: '#3b82f6', chart3: '#06b6d4', chart4: '#0ea5e9', chart5: '#0284c7' },
  { id: 'corporate_navy', name: 'Corporate Navy', primary: '#0f172a', secondary: '#1e293b', accent: '#f59e0b', background: '#f8fafc', text: '#0f172a', textMuted: '#475569', chart1: '#0f172a', chart2: '#1e293b', chart3: '#f59e0b', chart4: '#fbbf24', chart5: '#92400e' },
  { id: 'modern_teal', name: 'Modern Teal', primary: '#0d9488', secondary: '#14b8a6', accent: '#f97316', background: '#ffffff', text: '#134e4a', textMuted: '#5b8c85', chart1: '#0d9488', chart2: '#14b8a6', chart3: '#f97316', chart4: '#fb923c', chart5: '#fdba74' },
  { id: 'warm_sunset', name: 'Warm Sunset', primary: '#dc2626', secondary: '#f97316', accent: '#fbbf24', background: '#fffbeb', text: '#7c2d12', textMuted: '#9a3412', chart1: '#dc2626', chart2: '#f97316', chart3: '#fbbf24', chart4: '#fde047', chart5: '#84cc16' },
  { id: 'forest_green', name: 'Forest Green', primary: '#15803d', secondary: '#22c55e', accent: '#eab308', background: '#f7fee7', text: '#14532d', textMuted: '#4d7c0f', chart1: '#15803d', chart2: '#22c55e', chart3: '#84cc16', chart4: '#eab308', chart5: '#facc15' },
  { id: 'royal_purple', name: 'Royal Purple', primary: '#7c3aed', secondary: '#a855f7', accent: '#ec4899', background: '#faf5ff', text: '#3b0764', textMuted: '#6b21a8', chart1: '#7c3aed', chart2: '#a855f7', chart3: '#ec4899', chart4: '#f472b6', chart5: '#fb7185' },
  { id: 'minimal_mono', name: 'Minimal Mono', primary: '#000000', secondary: '#404040', accent: '#dc2626', background: '#ffffff', text: '#0a0a0a', textMuted: '#737373', chart1: '#000000', chart2: '#404040', chart3: '#737373', chart4: '#a3a3a3', chart5: '#dc2626' },
  { id: 'ocean_blue', name: 'Ocean Blue', primary: '#0369a1', secondary: '#0ea5e9', accent: '#06b6d4', background: '#f0f9ff', text: '#0c4a6e', textMuted: '#0369a1', chart1: '#0369a1', chart2: '#0ea5e9', chart3: '#06b6d4', chart4: '#22d3ee', chart5: '#67e8f9' },
  { id: 'bold_magenta', name: 'Bold Magenta', primary: '#be185d', secondary: '#db2777', accent: '#facc15', background: '#fff1f2', text: '#500724', textMuted: '#9f1239', chart1: '#be185d', chart2: '#db2777', chart3: '#facc15', chart4: '#fde047', chart5: '#fb923c' },
  { id: 'earth_tone', name: 'Earth Tone', primary: '#92400e', secondary: '#b45309', accent: '#65a30d', background: '#fef3c7', text: '#451a03', textMuted: '#78350f', chart1: '#92400e', chart2: '#b45309', chart3: '#65a30d', chart4: '#a16207', chart5: '#ca8a04' },
];

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

export interface CommunicationStyle {
  id: 'analytical' | 'intuitive' | 'functional' | 'personal';
  name: string;
  description: string;
  typical_questions: string[];
  handling_tips: string[];
}

export const COMMUNICATION_STYLES: CommunicationStyle[] = [
  { id: 'analytical', name: 'Analytical (นักวิเคราะห์)', description: 'เน้นข้อเท็จจริง ตัวเลข ข้อมูล', typical_questions: ['ตัวเลขนี้ได้มาจากไหน?', 'ข้อมูลนี้มาจากแหล่งไหน?', 'Sample size เท่าไหร่?'], handling_tips: ['ใส่ data source ในทุกสไลด์', 'ใช้ตัวเลขจริง', 'มี footnote อ้างอิง'] },
  { id: 'intuitive', name: 'Intuitive (นักมองภาพรวม)', description: 'เน้นภาพรวม ผลลัพธ์ปลายทาง', typical_questions: ['แล้วรูปรวมจะได้อะไร?', 'ปลายทางคืออะไร?', 'ข้ามไปดูรูปเลยได้ไหม?'], handling_tips: ['เปิดด้วย big picture', 'สรุป conclusion ก่อน', 'ไม่ต้องลงรายละเอียดทุกข้อ'] },
  { id: 'functional', name: 'Functional (นักปฏิบัติ)', description: 'เน้นกระบวนการ ขั้นตอน รายละเอียด', typical_questions: ['Process มีอะไรบ้าง?', 'ขั้นตอนแรกคืออะไร?', 'ใช้เวลานานเท่าไหร่?'], handling_tips: ['มี timeline ชัดเจน', 'แสดง responsibility matrix', 'มี Plan B'] },
  { id: 'personal', name: 'Personal (นักสัมพันธ์)', description: 'เน้นความสัมพันธ์ ความรู้สึก คน', typical_questions: ['พวกเขารู้สึกอย่างไร?', 'คุณคิดว่ายังไง?', 'ทีมโอเคไหม?'], handling_tips: ['เปิดด้วยเรื่องเล่าของคน', 'ใส่ quote จากลูกค้า', 'พูดถึง impact ต่อคน'] },
];

export interface AudienceConcern {
  id: string;
  name: string;
}

export const AUDIENCE_CONCERNS: AudienceConcern[] = [
  { id: 'clarity', name: 'ความชัดเจน' },
  { id: 'time', name: 'เวลา' },
  { id: 'money', name: 'เงินทุน' },
  { id: 'quality', name: 'คุณภาพ' },
  { id: 'risk', name: 'ความเสี่ยง' },
  { id: 'reputation', name: 'ชื่อเสียง' },
  { id: 'people', name: 'ทีม/คน' },
  { id: 'execution', name: 'การปฏิบัติจริง' },
];

export const FRAMEWORK_NAMES: Record<string, { name: string; name_th: string }> = {
  scqa_minto: { name: 'SCQA + Minto Pyramid', name_th: 'SCQA + Minto Pyramid (Informative)' },
  '5m_mission': { name: '5M Mission Flow', name_th: '5M Mission Flow (Persuasive)' },
  popup_pitch: { name: 'Pop-Up Pitch (Dan Roam)', name_th: 'Pop-Up Pitch by Dan Roam (Story)' },
};

// The single source of truth for objective -> framework mapping. Lives in
// this leaf module (no imports of its own) so both presentationRoutes.ts and
// presentationPrompts.ts can import it without a circular dependency between
// those two files. Used at project creation, whenever `objective` is edited,
// and as the last-resort fallback when computing a step's generation input.
export function frameworkVariantForObjective(objective: string | undefined): string {
  return objective === 'informative' ? 'scqa_minto'
    : objective === 'story' ? 'popup_pitch'
    : '5m_mission';
}

// =====================================================
// Presentation Objectives
// =====================================================
export interface PresentationObjective {
  id: 'informative' | 'persuasive' | 'story';
  name: string;
  icon: string;
  description: string;
  framework: 'scqa_minto' | '5m_mission' | 'popup_pitch';
  framework_name: string;
  best_for: string[];
}

export const PRESENTATION_OBJECTIVES: PresentationObjective[] = [
  { id: 'informative', name: 'ให้ข้อมูล (Informative)', icon: '📊', description: 'รายงาน สรุปงาน อธิบายข้อมูล', framework: 'scqa_minto', framework_name: 'SCQA + Minto', best_for: ['Status report', 'Quarterly review', 'Training', 'Brief executive'] },
  { id: 'persuasive', name: 'โน้มน้าว (Persuasive)', icon: '🎯', description: 'Pitch ขออนุมัติ เสนอไอเดีย', framework: '5m_mission', framework_name: '5M Mission', best_for: ['Investment pitch', 'Budget approval', 'New idea proposal', 'Sales pitch'] },
  { id: 'story', name: 'เล่าเรื่อง (Story)', icon: '🎤', description: 'TED Talk Keynote', framework: 'popup_pitch', framework_name: 'Pop-Up Pitch', best_for: ['TED Talk', 'Keynote', 'Conference talk', 'Brand story'] },
];

// =====================================================
// Slide Types
// =====================================================
export interface SlideType {
  id: 'flat' | 'story' | 'visual';
  name: string;
  description: string;
  best_for: string[];
}

export const SLIDE_TYPES: SlideType[] = [
  { id: 'flat', name: 'Flat (เน้นข้อความ)', description: 'เรียบ ตรงประเด็น เน้นข้อความ', best_for: ['ภาคผนวก', 'สไลด์ Report', 'สรุปท้าย'] },
  { id: 'story', name: 'Story (เล่าเรื่อง)', description: 'Title แบบสรุป + สถิติ/กราฟ/ไอคอน', best_for: ['สไลด์หลัก', 'Key points', 'เนื้อหาทั่วไป'] },
  { id: 'visual', name: 'Visual (เล่าด้วยภาพ)', description: 'ภาพ/อินโฟกราฟิก text น้อย', best_for: ['Pitch', 'Persuasive', 'Section divider'] },
];

// =====================================================
// Layout Patterns
// =====================================================
export interface LayoutPattern {
  id: 'quadrant' | '3column' | 'chart_text' | 'full_bleed' | 'comparison';
  name: string;
  description: string;
  best_for: string[];
}

export const LAYOUT_PATTERNS: LayoutPattern[] = [
  { id: 'quadrant', name: '4 Quadrant', description: 'แบ่ง 4 ส่วนเท่ากัน', best_for: ['4 เสาหลัก', '3-4 ปัจจัยสำคัญ'] },
  { id: '3column', name: '3 Column', description: '3 คอลัมน์ + icon', best_for: ['Agenda', '3 ขั้นตอน', 'Before-During-After'] },
  { id: 'chart_text', name: 'Chart + Text', description: 'กราฟซ้าย + คำอธิบายขวา', best_for: ['KPI', 'Before/After comparison'] },
  { id: 'full_bleed', name: 'Full-bleed', description: 'รูปเต็มสไลด์ + hook text', best_for: ['Persuasive', 'Sales', 'Section divider'] },
  { id: 'comparison', name: 'Before vs After', description: 'เปรียบเทียบ 2 สถานการณ์', best_for: ['แสดงการเปลี่ยนแปลง', 'ROI', 'ปัญหา vs ทางออก'] },
];

// =====================================================
// Chart Types
// =====================================================
export interface ChartType {
  id: string;
  name: string;
  category: 'composition' | 'comparison' | 'change';
  category_name: string;
  description: string;
  best_for: string;
}

export const CHART_TYPES: ChartType[] = [
  // Composition
  { id: 'pie', name: 'Pie Chart', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'วงกลมแบ่งสัดส่วน', best_for: '<5 หมวด' },
  { id: 'stacked_bar', name: 'Stacked Bar', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'แท่งแบ่งสีตามสัดส่วน', best_for: '5+ หมวด + เปรียบเทียบ' },
  { id: 'treemap', name: 'Treemap', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'พื้นที่ขนาดตามค่า', best_for: 'Hierarchy' },
  { id: 'sankey', name: 'Sankey', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'กระแสการไหล', best_for: 'Flow / Conversion' },
  // Comparison
  { id: 'grouped_bar', name: 'Grouped Bar', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'แท่งเปรียบเทียบหลายกลุ่ม', best_for: 'เปรียบเทียบ 2-3 ตัวแปร' },
  { id: 'clustered_bar', name: 'Clustered Bar', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'แท่งกลุ่มใกล้กัน', best_for: 'หลายกลุ่ม หลายช่วงเวลา' },
  { id: 'bullet', name: 'Bullet Chart', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'Actual vs Target', best_for: 'KPI + เป้า' },
  { id: 'heatmap', name: 'Heatmap', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'ตารางสีตามค่า', best_for: 'Matrix ขนาดใหญ่' },
  // Change
  { id: 'line', name: 'Line Chart', category: 'change', category_name: 'โต (Change)', description: 'เส้นแสดงแนวโน้ม', best_for: 'Time series 4+ จุด' },
  { id: 'area', name: 'Area Chart', category: 'change', category_name: 'โต (Change)', description: 'พื้นที่ใต้เส้น', best_for: 'Volume + trend' },
  { id: 'dot_plot', name: 'Dot Plot', category: 'change', category_name: 'โต (Change)', description: 'จุดตามค่า', best_for: 'เปรียบเทียบค่าจำนวนน้อย' },
  { id: 'slope', name: 'Slope Chart', category: 'change', category_name: 'โต (Change)', description: 'เส้นเชื่อม 2 จุดเวลา', best_for: 'Before/After 2 ช่วง' },
];
